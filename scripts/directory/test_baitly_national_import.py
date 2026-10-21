import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("baitly_import", Path(__file__).with_name("baitly_national_import.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class NationalImportTest(unittest.TestCase):
    def test_retry_preserves_bytes_from_the_failed_attempt(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "source.pbf"
            calls = []

            def download(*args, **kwargs):
                calls.append(target.stat().st_size if target.exists() else 0)
                self.assertIn("--continue-at", args)
                self.assertNotIn("--retry", args)
                if len(calls) == 1:
                    target.write_bytes(b"abc")
                    raise subprocess.CalledProcessError(18, "curl")
                target.write_bytes(b"abcdef")

            source = {"url": "https://download.geofabrik.de/europe/france-latest.osm.pbf", "size": 6, "etag": "edition"}
            with patch.object(module, "run", download), patch.object(module.time, "sleep"):
                module.download(source, target)
            self.assertEqual(calls, [0, 3])
            self.assertEqual(target.read_bytes(), b"abcdef")

    def test_never_appends_a_new_edition_to_an_old_partial_file(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "source.pbf"
            target.write_bytes(b"old")
            target.with_suffix(".pbf.source.json").write_text(json.dumps({"etag": "old"}))
            with patch.object(module, "run") as run, self.assertRaises(ValueError):
                module.download({"etag": "new", "size": 6, "url": "https://download.geofabrik.de/source"}, target)
            run.assert_not_called()

    def test_extracts_exact_sirets_and_only_real_node_positions(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "fixture.osm"
            source.write_text('''<osm version="0.6">
              <node id="1" lat="47.2" lon="-1.5"><tag k="ref:FR:SIRET" v="12345678900011"/><tag k="phone" v="0102030405"/></node>
              <node id="2" lat="48" lon="2"><tag k="ref:FR:SIRET" v="12345678900011;22345678900022"/></node>
              <way id="3"><nd ref="1"/><tag k="ref:FR:SIRET" v="32345678900033"/><tag k="email" v="contact@example.com"/></way>
            </osm>''')
            target = Path(directory) / "snapshot.jsonl"
            module.extract_osm([source], target)
            rows = [json.loads(line) for line in target.read_text().splitlines()]
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0]["lat"], 47.2)
            self.assertEqual(rows[1]["type"], "way")
            self.assertNotIn("lat", rows[1])

    def test_rejects_redirects_to_untrusted_or_plain_http_sources(self):
        for url in ["http://download.geofabrik.de/source", "https://localhost/source", "https://user@download.geofabrik.de/source"]:
            with self.assertRaises(ValueError):
                module.check_url(url, {"download.geofabrik.de"})


if __name__ == "__main__":
    unittest.main()
