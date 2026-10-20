"""Build only the licensed public OSM source bundle, without Docker or application databases."""
import argparse
import hashlib
import json
from pathlib import Path
from baitly_national_import import REGIONS, resource, download, extract_osm


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    paths, sources = [], []
    for region in ["france"] + REGIONS:
        url = ("https://download.geofabrik.de/europe/france-latest.osm.pbf" if region == "france"
               else "https://download.geofabrik.de/europe/france/" + region + "-latest.osm.pbf")
        source = resource(url, {"download.geofabrik.de"})
        path = args.out / (region + ".osm.pbf")
        download(source, path)
        paths.append(path)
        sources.append(source)
    snapshot = args.out / "osm.jsonl"
    extract_osm(paths, snapshot)
    fingerprint = hashlib.sha256(snapshot.read_bytes()).hexdigest()
    immutable = snapshot.with_name("osm-" + fingerprint + ".jsonl")
    snapshot.replace(immutable)
    (args.out / "latest.json").write_text(json.dumps({"sha256": fingerprint,
        "bytes": immutable.stat().st_size, "licence": "ODbL 1.0", "sources": sources,
        "attribution": "© OpenStreetMap contributors, Geofabrik extracts",
        "licence_url": "https://www.openstreetmap.org/copyright"}))


if __name__ == "__main__":
    main()
