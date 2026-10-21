import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock
from urllib.error import HTTPError
from verify_baitly_public_source import verify


class PublicSourceDeliveryTest(unittest.TestCase):
    def test_anonymous_delivery_matches_country_manifest_and_immutable_body(self):
        with tempfile.TemporaryDirectory() as folder:
            body = b'{"name":"Baitly fixture"}\n'
            manifest = {"manifest": {"country": "MA", "source": "MA_PUBLIC", "count": 1,
                                    "sha256": hashlib.sha256(body).hexdigest(), "complete": True, "publishable": True}, "bytes": len(body)}
            (Path(folder) / "latest.json").write_text(json.dumps(manifest))
            opener = Mock()
            opener.open.side_effect = [io.BytesIO(json.dumps(manifest).encode()), io.BytesIO(body)]
            self.assertEqual(verify("MA", folder, opener), 1)
            self.assertTrue(opener.open.call_args_list[0].args[0].full_url.endswith("/ma/latest.json"))
            opener.open.side_effect = HTTPError("https://example.org", 403, "Denied", {}, None)
            with self.assertRaises(HTTPError):
                verify("MA", folder, opener)
            opener.open.side_effect = [io.BytesIO(json.dumps(manifest).encode()), io.BytesIO(b"corrupt")]
            with self.assertRaisesRegex(ValueError, "incomplete or corrupted"):
                verify("MA", folder, opener)
            opener.open.side_effect = [io.BytesIO(b"{}")]
            with self.assertRaisesRegex(ValueError, "differs"):
                verify("MA", folder, opener)


if __name__ == "__main__":
    unittest.main()
