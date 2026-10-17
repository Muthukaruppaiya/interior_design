"""Download commercially usable kitchen photos from Openverse (no API key).

Writes resized JPEGs plus attribution.csv (required by CC-BY / CC-BY-SA).
"""

import argparse
import csv
import io
import time
from pathlib import Path

import numpy as np
import requests
from PIL import Image

API = "https://api.openverse.org/v1/images/"
HEADERS = {"User-Agent": "InteriorKitchenAI/0.1 (kitchen layout dataset)"}
QUERIES = [
    "kitchen",
    "modular kitchen",
    "kitchen interior",
    "kitchen cabinets",
    "kitchen design",
    "indian kitchen",
    "kitchen counter",
    "small kitchen",
    "empty kitchen",
    "kitchen renovation",
    "open kitchen",
    "kitchen chimney",
]
MAX_PAGES = 12
MAX_SIDE = 1024
MIN_SIDE = 400


def dhash(img: Image.Image) -> int:
    g = np.asarray(img.convert("L").resize((9, 8), Image.BILINEAR), dtype=np.int16)
    bits = 0
    for b in (g[:, 1:] > g[:, :-1]).flatten():
        bits = (bits << 1) | int(b)
    return bits


def is_duplicate(h: int, seen: list[int], max_dist: int = 6) -> bool:
    return any(bin(h ^ s).count("1") <= max_dist for s in seen)


def save_resized(img: Image.Image, path: Path) -> None:
    img = img.convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    img.save(path, "JPEG", quality=90)


def fetch_image(session: requests.Session, item: dict) -> Image.Image | None:
    for url in (item.get("url"), item.get("thumbnail")):
        if not url:
            continue
        try:
            r = session.get(url, timeout=30)
            if r.status_code != 200:
                continue
            img = Image.open(io.BytesIO(r.content))
            img.load()
            return img
        except Exception:
            continue
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/raw")
    ap.add_argument("--max", type=int, default=600)
    ap.add_argument("--extra", default=None, help="folder of your own photos to include")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update(HEADERS)

    seen_ids: set[str] = set()
    seen_hashes: list[int] = []
    rows: list[dict] = []

    if args.extra and Path(args.extra).is_dir():
        for p in sorted(Path(args.extra).iterdir()):
            if p.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
                continue
            img = Image.open(p)
            seen_hashes.append(dhash(img))
            dest = out / f"own_{p.stem}.jpg"
            save_resized(img, dest)
            rows.append({"file": dest.name, "source": "own", "license": "own"})
        print(f"included {len(rows)} own photos from {args.extra}")

    for q in QUERIES:
        if len(rows) >= args.max:
            break
        for page in range(1, MAX_PAGES + 1):
            if len(rows) >= args.max:
                break
            params = {
                "q": q,
                "license_type": "commercial",
                "category": "photograph",
                "mature": "false",
                "page_size": 20,
                "page": page,
            }
            try:
                r = session.get(API, params=params, timeout=30)
            except requests.RequestException as e:
                print(f"  api error {e}; skipping")
                break
            if r.status_code != 200:
                print(f"  '{q}' page {page}: HTTP {r.status_code}, next query")
                break
            results = r.json().get("results", [])
            if not results:
                break
            for item in results:
                if len(rows) >= args.max:
                    break
                if item["id"] in seen_ids:
                    continue
                seen_ids.add(item["id"])
                if min(item.get("width") or 0, item.get("height") or 0) < MIN_SIDE and item.get("width"):
                    continue
                img = fetch_image(session, item)
                if img is None or min(img.size) < 256:
                    continue
                h = dhash(img)
                if is_duplicate(h, seen_hashes):
                    continue
                seen_hashes.append(h)
                name = f"ov_{item['id'][:12]}.jpg"
                save_resized(img, out / name)
                rows.append(
                    {
                        "file": name,
                        "source": item.get("source", ""),
                        "license": f"{item.get('license', '')} {item.get('license_version', '')}".strip(),
                        "license_url": item.get("license_url", ""),
                        "title": item.get("title", ""),
                        "creator": item.get("creator", ""),
                        "landing_url": item.get("foreign_landing_url", ""),
                    }
                )
                time.sleep(0.15)
            print(f"'{q}' page {page}: total {len(rows)}")
            time.sleep(1.0)

    fields = ["file", "source", "license", "license_url", "title", "creator", "landing_url"]
    with open(out / "attribution.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k, "") for k in fields})
    print(f"done: {len(rows)} images in {out}")


if __name__ == "__main__":
    main()
