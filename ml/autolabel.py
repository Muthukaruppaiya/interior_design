"""Auto-label kitchen photos with a pretrained ADE20K SegFormer and write a
YOLO-seg dataset (polygons per kitchen class) plus preview overlays."""

import argparse
import hashlib
import json
import shutil
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, SegformerForSemanticSegmentation

from kitchen_classes import ADE_TO_KITCHEN, KITCHEN_CLASSES, KITCHEN_EVIDENCE

IGNORE = 255
PALETTE = np.array(
    [
        [200, 200, 200],
        [120, 80, 40],
        [240, 240, 180],
        [30, 144, 255],
        [255, 140, 0],
        [220, 20, 60],
        [0, 206, 209],
        [148, 0, 211],
        [173, 255, 47],
        [255, 20, 147],
        [139, 69, 19],
        [255, 215, 0],
    ],
    dtype=np.uint8,
)


def build_lut(id2label: dict) -> np.ndarray:
    lut = np.full(256, IGNORE, dtype=np.uint8)
    found = set()
    for ade_id, name in id2label.items():
        kc = ADE_TO_KITCHEN.get(name.strip().lower())
        if kc is not None:
            lut[int(ade_id)] = KITCHEN_CLASSES.index(kc)
            found.add(name.strip().lower())
    missing = set(ADE_TO_KITCHEN) - found
    if missing:
        print(f"warning: ADE labels not in model config: {sorted(missing)}")
    return lut


def mask_to_polygons(mask: np.ndarray, min_area: float) -> list[np.ndarray]:
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    polys = []
    for c in contours:
        if cv2.contourArea(c) < min_area:
            continue
        eps = 0.0015 * cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, eps, True).reshape(-1, 2)
        if len(approx) >= 3:
            polys.append(approx)
    return polys


def split_of(name: str, val_ratio: float) -> str:
    h = int(hashlib.md5(name.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
    return "val" if h < val_ratio else "train"


def add_manual(out: Path, folder: str | None, repeat: int) -> int:
    """Copy LabelMe-labelled photos into train, repeated so they outweigh
    the noisier auto-labels."""
    if not folder or not Path(folder).is_dir():
        return 0
    count = 0
    for js in sorted(Path(folder).glob("*.json")):
        data = json.loads(js.read_text(encoding="utf-8"))
        img = Image.open(js.parent / data["imagePath"]).convert("RGB")
        w, h = img.size
        lines = []
        for shape in data["shapes"]:
            if shape["label"] not in KITCHEN_CLASSES:
                print(f"  {js.name}: unknown label '{shape['label']}' skipped")
                continue
            pts = shape["points"]
            if shape.get("shape_type") == "rectangle":
                (x0, y0), (x1, y1) = pts
                pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
            coords = " ".join(
                f"{min(max(x / w, 0), 1):.5f} {min(max(y / h, 0), 1):.5f}" for x, y in pts
            )
            lines.append(f"{KITCHEN_CLASSES.index(shape['label'])} {coords}")
        for i in range(repeat):
            stem = f"manual_{js.stem}_{i}"
            img.save(out / "images" / "train" / f"{stem}.jpg", "JPEG", quality=92)
            (out / "labels" / "train" / f"{stem}.txt").write_text("\n".join(lines))
        count += 1
    return count


@torch.inference_mode()
def segment(model, processor, img: Image.Image, device: str) -> np.ndarray:
    inputs = processor(images=img, return_tensors="pt").to(device)
    logits = model(**inputs).logits
    up = torch.nn.functional.interpolate(
        logits, size=(img.height, img.width), mode="bilinear", align_corners=False
    )
    return up.argmax(1)[0].to("cpu").numpy().astype(np.uint8)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", default="data/raw")
    ap.add_argument("--out", default="data/dataset")
    ap.add_argument("--model", default="nvidia/segformer-b5-finetuned-ade-640-640")
    ap.add_argument("--min-evidence", type=float, default=0.05)
    ap.add_argument("--min-shell", type=float, default=0.55)
    ap.add_argument("--val-ratio", type=float, default=0.15)
    ap.add_argument("--previews", type=int, default=40)
    ap.add_argument("--manual", default=None, help="folder of LabelMe JSON + photos")
    ap.add_argument("--manual-repeat", type=int, default=15)
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"loading {args.model} on {device}")
    processor = AutoImageProcessor.from_pretrained(args.model)
    model = SegformerForSemanticSegmentation.from_pretrained(args.model).to(device).eval()
    lut = build_lut(model.config.id2label)
    evidence_ids = [KITCHEN_CLASSES.index(c) for c in KITCHEN_EVIDENCE]
    shell_ids = [KITCHEN_CLASSES.index(c) for c in ("wall", "floor")]

    out = Path(args.out)
    if out.exists():
        shutil.rmtree(out)
    for split in ("train", "val"):
        (out / "images" / split).mkdir(parents=True)
        (out / "labels" / split).mkdir(parents=True)
    preview_dir = out / "previews"
    preview_dir.mkdir()

    files = sorted(
        p for p in Path(args.images).iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"}
    )
    kept, rejected, previews = 0, [], 0
    for i, path in enumerate(files, 1):
        img = Image.open(path).convert("RGB")
        kmap = lut[segment(model, processor, img, device)]
        evidence = np.isin(kmap, evidence_ids).mean()
        # Empty "before" rooms have no cabinets yet but a clear wall + floor shell.
        shell = np.isin(kmap, shell_ids).mean()
        if evidence < args.min_evidence and shell < args.min_shell:
            rejected.append(path.name)
            continue

        h, w = kmap.shape
        min_area = 0.004 * h * w
        lines = []
        for cls_id in range(len(KITCHEN_CLASSES)):
            mask = (kmap == cls_id).astype(np.uint8)
            if mask.sum() < min_area:
                continue
            for poly in mask_to_polygons(mask, min_area):
                coords = " ".join(f"{x / w:.5f} {y / h:.5f}" for x, y in poly)
                lines.append(f"{cls_id} {coords}")
        if not lines:
            rejected.append(path.name)
            continue

        split = split_of(path.name, args.val_ratio)
        img.save(out / "images" / split / f"{path.stem}.jpg", "JPEG", quality=92)
        (out / "labels" / split / f"{path.stem}.txt").write_text("\n".join(lines))
        kept += 1

        if previews < args.previews:
            color = np.zeros((h, w, 3), np.uint8)
            valid = kmap != IGNORE
            color[valid] = PALETTE[kmap[valid]]
            blend = (np.asarray(img) * 0.5 + color * 0.5).astype(np.uint8)
            Image.fromarray(blend).save(preview_dir / f"{path.stem}.jpg", quality=85)
            previews += 1
        if i % 20 == 0:
            print(f"{i}/{len(files)} processed, kept {kept}")

    manual = add_manual(out, args.manual, args.manual_repeat)
    print(f"hand-labelled photos: {manual} (x{args.manual_repeat} in train)")

    val_imgs = list((out / "images" / "val").iterdir())
    train_imgs = sorted((out / "images" / "train").iterdir())
    if not val_imgs and len(train_imgs) > 1:
        moved = train_imgs[0]
        shutil.move(moved, out / "images" / "val" / moved.name)
        label = out / "labels" / "train" / f"{moved.stem}.txt"
        shutil.move(label, out / "labels" / "val" / label.name)

    (out / "data.yaml").write_text(
        f"path: {out.resolve().as_posix()}\n"
        "train: images/train\n"
        "val: images/val\n"
        f"names: {json.dumps(KITCHEN_CLASSES)}\n"
    )
    (out / "rejected.txt").write_text("\n".join(rejected))
    print(f"done: kept {kept}, rejected {len(rejected)} (not kitchen / empty)")


if __name__ == "__main__":
    main()
