"""Vérifie la couverture et les extractions Baitly sans télécharger de cartes."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

HERE = Path(__file__).resolve().parent


class BaitlyTilesTest(unittest.TestCase):
    def test_middle_east_cities_are_inside_the_detailed_region(self):
        regions = json.loads((HERE / "baitly-region.geojson").read_text())["features"]
        cities = {
            "Doha": (51.53, 25.28), "Abu Dhabi": (54.37, 24.45),
            "Manama": (50.59, 26.22), "Kuwait": (47.98, 29.38),
            "Muscat": (58.41, 23.59), "Riyadh": (46.68, 24.71),
            "Sanaa": (44.21, 15.35), "Baghdad": (44.37, 33.32),
            "Tehran": (51.39, 35.69), "Ankara": (32.86, 39.93),
            "Beirut": (35.50, 33.89), "Damascus": (36.28, 33.51),
            "Amman": (35.93, 31.95), "Jerusalem": (35.21, 31.77),
            "Ramallah": (35.20, 31.90), "Cairo": (31.24, 30.04),
            "Nicosia": (33.38, 35.18),
        }
        for city, (lng, lat) in cities.items():
            with self.subTest(city=city):
                # Les régions de construction sont des rectangles explicites.
                self.assertTrue(any(
                    min(p[0] for p in feature["geometry"]["coordinates"][0]) <= lng <= max(p[0] for p in feature["geometry"]["coordinates"][0])
                    and min(p[1] for p in feature["geometry"]["coordinates"][0]) <= lat <= max(p[1] for p in feature["geometry"]["coordinates"][0])
                    for feature in regions
                ))

    def test_world_source_is_not_cut_to_the_regional_or_development_bounds(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            executable = root / "pmtiles"
            executable.write_text('''#!/usr/bin/env python3
import json, os, pathlib, sys
with open(os.environ["BAITLY_TEST_CALLS"], "a") as log:
    log.write(json.dumps(sys.argv[1:]) + "\\n")
if sys.argv[1] == "extract":
    pathlib.Path(sys.argv[3]).write_bytes(b"test archive")
''')
            executable.chmod(0o755)
            calls = root / "calls.jsonl"
            env = dict(os.environ, PATH=f"{root}:{os.environ['PATH']}", BAITLY_TEST_CALLS=str(calls))
            subprocess.run(["bash", str(HERE / "build-baitly-tiles.sh"), "--build", "20261010", "--bbox", "51,25,52,26", "--out", str(root / "out"), "--skip-assets"], env=env, check=True, capture_output=True)
            commands = [json.loads(line) for line in calls.read_text().splitlines()]
            world = next(command for command in commands if command[0] == "extract" and "world.pmtiles" in command[2])
            self.assertIn("--maxzoom=6", world)
            self.assertFalse(any(option.startswith(("--bbox", "--region")) for option in world))
            self.assertTrue((root / "out/world.pmtiles").is_file())


if __name__ == "__main__":
    unittest.main()
