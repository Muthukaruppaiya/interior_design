"""Train the kitchen zone segmenter (YOLO-seg) and export it to ONNX."""

import argparse
import json
import shutil
from pathlib import Path

from ultralytics import YOLO

from kitchen_classes import KITCHEN_CLASSES, PAINT_ORDER


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/dataset/data.yaml")
    ap.add_argument("--base", default="yolo11n-seg.pt")
    ap.add_argument("--epochs", type=int, default=80)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--device", default=None)
    ap.add_argument("--out", default="export")
    args = ap.parse_args()

    model = YOLO(args.base)
    model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        project="runs",
        name="kitchen_seg",
        exist_ok=True,
        patience=25,
        fliplr=0.5,
        degrees=3.0,
        perspective=0.0005,
        plots=True,
    )

    best = Path(model.trainer.save_dir) / "weights" / "best.pt"
    trained = YOLO(str(best))
    metrics = trained.val(data=args.data, imgsz=args.imgsz, device=args.device)
    onnx_path = Path(trained.export(format="onnx", imgsz=args.imgsz, opset=12, simplify=True))

    out = Path(args.out)
    out.mkdir(exist_ok=True)
    shutil.copy(best, out / "kitchen_seg.pt")
    shutil.copy(onnx_path, out / "kitchen_seg.onnx")
    (out / "kitchen_seg.json").write_text(
        json.dumps(
            {
                "classes": KITCHEN_CLASSES,
                "paintOrder": PAINT_ORDER,
                "imgsz": args.imgsz,
                "maskMap50_95": float(metrics.seg.map),
                "boxMap50_95": float(metrics.box.map),
            },
            indent=2,
        )
    )
    print(f"exported to {out.resolve()}  mask mAP50-95={metrics.seg.map:.3f}")


if __name__ == "__main__":
    main()
