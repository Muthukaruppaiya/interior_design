"""Draw LabelMe polygons over their photos to check hand labels."""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

from autolabel import PALETTE
from kitchen_classes import KITCHEN_CLASSES


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--labelled", default="../datasets/labelled")
    ap.add_argument("--out", default="diag/labels")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for js in sorted(Path(args.labelled).glob("*.json")):
        data = json.loads(js.read_text(encoding="utf-8"))
        img = Image.open(js.parent / data["imagePath"]).convert("RGB")
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        for shape in data["shapes"]:
            color = tuple(int(c) for c in PALETTE[KITCHEN_CLASSES.index(shape["label"])])
            pts = [tuple(p) for p in shape["points"]]
            draw.polygon(pts, fill=color + (110,), outline=color + (255,))
            draw.text(pts[0], shape["label"], fill=(0, 0, 0, 255))
        Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB").save(out / f"{js.stem}.jpg")
        print(out / f"{js.stem}.jpg")


if __name__ == "__main__":
    main()
