"""Generate kitchen_train_colab.ipynb with the local scripts embedded, so
Colab needs no uploads: open it, pick a T4 GPU, Run all."""

import base64
import json
from pathlib import Path

HERE = Path(__file__).parent
LABELLED = HERE.parent / "datasets" / "labelled"
SCRIPTS = ["kitchen_classes.py", "download.py", "autolabel.py", "train.py"]


def md(text: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": text.strip().splitlines(True)}


def code(text: str) -> dict:
    return {
        "cell_type": "code",
        "metadata": {},
        "execution_count": None,
        "outputs": [],
        "source": text.strip().splitlines(True),
    }


def main() -> None:
    cells = [
        md(
            """
# Kitchen zone AI - training

1. **Runtime > Change runtime type > T4 GPU**, then **Save**.
2. **Runtime > Run all**.
3. At the end the browser downloads `kitchen_model.zip` (~10 MB).
   Unzip it into `Interior/backend/models/` on your PC.

Steps: download free-licence kitchen photos (Openverse) > auto-label with
SegFormer ADE20K > train YOLO11n-seg > export ONNX.
Takes about 30-60 minutes on the free T4.
"""
        ),
        code(
            """
MAX_IMAGES = 600   # photos to download
EPOCHS = 80
UPLOAD_OWN_PHOTOS = False  # True = pick your own kitchen photos to add
"""
        ),
        code("!nvidia-smi --query-gpu=name,memory.total --format=csv\n!pip -q install ultralytics"),
    ]
    for name in SCRIPTS:
        cells.append(code(f"%%writefile {name}\n" + (HERE / name).read_text(encoding="utf-8")))

    labelled = {
        p.name: base64.b64encode(p.read_bytes()).decode()
        for p in sorted(LABELLED.glob("*"))
        if p.suffix.lower() in {".json", ".jpg", ".jpeg", ".png"}
    }
    cells.append(md(f"Hand-labelled site photos embedded from `datasets/labelled` ({len(labelled) // 2} photos)."))
    cells.append(
        code(
            "import base64, os\n"
            "os.makedirs('labelled', exist_ok=True)\n"
            f"LABELLED = {json.dumps(labelled)}\n"
            "for name, data in LABELLED.items():\n"
            "    open(os.path.join('labelled', name), 'wb').write(base64.b64decode(data))\n"
            "print(len(LABELLED), 'files')"
        )
    )
    cells += [
        code(
            """
import os
os.makedirs('own', exist_ok=True)
if UPLOAD_OWN_PHOTOS:
    from google.colab import files
    for name, data in files.upload().items():
        open(os.path.join('own', name), 'wb').write(data)
print(len(os.listdir('own')), 'own photos')
"""
        ),
        code("!python download.py --out data/raw --max {MAX_IMAGES} --extra own"),
        code("!python autolabel.py --images data/raw --out data/dataset --manual labelled --manual-repeat 20"),
        md("Check the auto-labels look sensible (colours = wall / floor / cabinet / countertop ...)."),
        code(
            """
from IPython.display import Image, display
import glob
for p in sorted(glob.glob('data/dataset/previews/*.jpg'))[:8]:
    display(Image(filename=p, width=480))
"""
        ),
        code("!python train.py --data data/dataset/data.yaml --epochs {EPOCHS} --batch 16"),
        code(
            """
import shutil
shutil.copy('data/raw/attribution.csv', 'export/attribution.csv')
shutil.make_archive('kitchen_model', 'zip', 'export')
from google.colab import files
files.download('kitchen_model.zip')
"""
        ),
    ]
    nb = {
        "cells": cells,
        "metadata": {
            "accelerator": "GPU",
            "colab": {"provenance": [], "gpuType": "T4"},
            "kernelspec": {"display_name": "Python 3", "name": "python3"},
            "language_info": {"name": "python"},
        },
        "nbformat": 4,
        "nbformat_minor": 0,
    }
    target = HERE / "kitchen_train_colab.ipynb"
    target.write_text(json.dumps(nb, indent=1), encoding="utf-8")
    print(f"wrote {target}")


if __name__ == "__main__":
    main()
