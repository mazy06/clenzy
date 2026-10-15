"""Stage or apply Baitly packshot cutouts; photographs and existing alpha are excluded.

Requires rembg[cpu]. Original files are backed up under --output before replacement.
Usage: python baitly-transparent-artwork.py [--apply] [--output /private/tmp/baitly-cutouts]
"""
import argparse
import hashlib
import json
import os
import shutil
from pathlib import Path

from PIL import Image, ImageDraw
import numpy as np
from scipy.ndimage import binary_fill_holes

ROOT = Path(__file__).resolve().parents[2]
GROUPS = ("hitl", "inventory", "stock", "notifications")
MOBILE = {
    "contract": "hitl/management-contract.webp", "property": "notifications/property.webp",
    "calendar": "hitl/calendar.webp", "welcome": "hitl/welcome-guide.webp",
    "report": "hitl/owner-report.webp", "distribution": "hitl/distribution.webp",
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def preserve_ivory(original, alpha):
    """Restore warm ivory surfaces incorrectly classified as holes in a packshot.

    The studio background is cool blue. Only warm pixels within the inferred
    silhouette (including enclosed holes) are restored; exterior stays clear.
    """
    rgb = np.asarray(original.convert("RGB")).astype(np.int16)
    mask = np.asarray(alpha).copy()
    support = binary_fill_holes(mask > 16)
    warm = (rgb[:, :, 0] >= rgb[:, :, 2] - 7) & (rgb.mean(axis=2) > 110)
    mask[support & warm] = 255
    return Image.fromarray(mask)


def restore_small_house(relative, alpha):
    # The pale house is an independent object omitted by the segmentation model.
    # This checked 320px contour restores it without changing the foreground RGB.
    if relative == "client/public/images/notifications/booking-unmapped.webp":
        contour = [(143, 88), (188, 34), (216, 61), (256, 93), (250, 102),
                   (242, 96), (242, 157), (214, 174), (159, 166), (151, 156),
                   (151, 110), (145, 100)]
        shape = Image.new("L", (alpha.width * 4, alpha.height * 4))
        ImageDraw.Draw(shape).polygon([(x * 4, y * 4) for x, y in contour], fill=255)
        shape = shape.resize(alpha.size, Image.Resampling.LANCZOS)
        alpha = Image.fromarray(np.maximum(np.asarray(alpha), np.asarray(shape)))
    return alpha


def save_webp(image, destination):
    # Preserve alpha losslessly while keeping UI thumbnails within the PMS budget.
    budget = 35_000 if max(image.size) <= 320 else 300_000
    candidate = destination.with_name(f".{destination.name}.staged.webp")
    for quality in (92, 88, 84, 80):
        image.save(candidate, format="WEBP", quality=quality, method=6, exact=True)
        if candidate.stat().st_size < budget:
            candidate.replace(destination)
            return
    candidate.unlink(missing_ok=True)
    raise RuntimeError(f"Artwork exceeds size budget: {destination}")


def sheets(rows, output):
    for start in range(0, len(rows), 24):
        batch = rows[start:start + 24]
        canvas = Image.new("RGB", (1200, 6 * 160), "#f4f6f8")
        draw = ImageDraw.Draw(canvas)
        for index, row in enumerate(batch):
            x, y = index % 4 * 300, index // 4 * 160
            im = Image.open(output / "cutouts" / row["path"]).convert("RGBA")
            im.thumbnail((130, 130))
            for offset, background in ((0, "#f4f6f8"), (150, "#1e2931")):
                draw.rectangle((x + offset, y, x + offset + 149, y + 139), fill=background)
                canvas.paste(im, (x + offset + (150 - im.width) // 2, y + (140 - im.height) // 2), im)
            draw.text((x + 4, y + 141), Path(row["path"]).stem[:38], fill="#263843")
        canvas.save(output / f"review-{start // 24 + 1}.jpg", quality=95)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("/private/tmp/baitly-cutouts"))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    manifest = output / "manifest.json"
    if args.apply:
        rows = json.loads(manifest.read_text())
        # Validate every source before mutating any file, preserving intervening changes.
        for row in rows:
            if digest(ROOT / row["path"]) != row["sourceSha256"]:
                raise RuntimeError(f"Source changed: {row['path']}")
            with Image.open(output / "cutouts" / row["path"]) as image:
                if image.size != tuple(row["size"]) or image.getchannel("A").getextrema() != (0, 255):
                    raise RuntimeError(f"Invalid cutout: {row['path']}")
        for row in rows:
            shutil.copyfile(output / "cutouts" / row["path"], ROOT / row["path"])
        for name, source in MOBILE.items():
            shutil.copyfile(ROOT / "client/public/images" / source,
                            ROOT / "mobile/assets/baitly/public-profiles" / f"{name}.webp")
        print(f"Applied {len(rows)} PMS cutouts and synchronized {len(MOBILE)} mobile assets.")
        return

    os.environ.setdefault("U2NET_HOME", str(output / "models"))
    os.environ.setdefault("OMP_NUM_THREADS", "4")
    from rembg import new_session, remove
    session = new_session("isnet-general-use", providers=["CPUExecutionProvider"])
    rows = []
    sources = sorted(path for group in GROUPS for path in (ROOT / "client/public/images" / group).glob("*.webp"))
    for path in sources:
        with Image.open(path) as original:
            original = original.convert("RGBA")
            if original.getchannel("A").getextrema()[0] < 255:
                continue
            relative = str(path.relative_to(ROOT))
            dest = output / "cutouts" / relative
            backup = output / "originals" / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, backup)
            result = remove(original, session=session)
            alpha = restore_small_house(relative, preserve_ivory(original, result.getchannel("A")))
            # Keep foreground RGB exactly as supplied; only the alpha mask changes.
            original.putalpha(alpha)
            save_webp(original, dest)
            occupied = np.count_nonzero(np.asarray(alpha) > 127) / (original.width * original.height)
            if not 0.03 < occupied < 0.95:
                raise RuntimeError(f"Suspicious foreground area {occupied:.2f}: {relative}")
            rows.append({"path": relative, "sourceSha256": digest(path), "size": list(original.size),
                         "foregroundFraction": round(occupied, 4)})
            manifest.write_text(json.dumps(rows, indent=2) + "\n")
            print(f"Staged {len(rows)}: {relative}", flush=True)
    sheets(rows, output)
    print(f"Review {len(rows)} cutouts in {output}; use --apply after visual inspection.")


if __name__ == "__main__":
    main()
