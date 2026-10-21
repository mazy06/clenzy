"""Verify anonymous access to the exact published country edition before CD imports it."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request

ORIGIN = "https://baitly-cartes.s3.gra.io.cloud.ovh.net/maps/directory/"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def verify(country, folder, opener=None):
    if country not in {"MA", "SA"}:
        raise ValueError("Unsupported country")
    expected = json.loads((Path(folder) / "latest.json").read_text())
    manifest = expected["manifest"]
    digest = manifest["sha256"]
    size = expected["bytes"]
    if (manifest["country"] != country or manifest["source"] != country + "_PUBLIC"
            or not manifest["complete"] or not manifest["publishable"]
            or len(digest) != 64 or any(char not in "0123456789abcdef" for char in digest)
            or not 0 < size <= 512 * 1024 * 1024):
        raise ValueError("Invalid expected public edition")
    opener = opener or urllib.request.build_opener(NoRedirect())

    def fetch(filename):
        # Fixed origin and internally constructed names only. No credentials or redirects.
        request = urllib.request.Request(ORIGIN + country.lower() + "/" + filename,
                                         headers={"User-Agent": "Baitly-Directory-CI/1.0", "Cache-Control": "no-cache"})
        return opener.open(request, timeout=60)

    with fetch("latest.json") as response:
        body = response.read(32001)
        if len(body) > 32000 or json.loads(body) != expected:
            raise ValueError("Published manifest differs from the built edition")
    checksum = hashlib.sha256()
    count = 0
    with fetch("public-" + digest + ".jsonl") as response:
        while block := response.read(65536):
            count += len(block)
            if count > size:
                raise ValueError("Published snapshot exceeds its manifest size")
            checksum.update(block)
    if count != size or checksum.hexdigest() != digest:
        raise ValueError("Published snapshot is incomplete or corrupted")
    return manifest["count"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--country", choices=["MA", "SA"], required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    count = verify(args.country, args.out)
    print(f"BAITLY_PUBLIC_SOURCE_VERIFIED country={args.country} records={count}")
