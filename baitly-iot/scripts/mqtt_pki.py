#!/usr/bin/env python3
"""Offline MQTT certificate issuance; init-test creates disposable LOCAL TEST authorities only."""

import argparse
import os
from pathlib import Path
import re
import secrets
import subprocess


def openssl(*arguments):
    result = subprocess.run(["openssl", *map(str, arguments)], capture_output=True)
    if result.returncode:
        raise RuntimeError("OpenSSL certificate operation failed (details suppressed)")


def authority(root, name):
    openssl("req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:P-256", "-nodes",
            "-keyout", root / (name + ".key"), "-out", root / (name + ".crt"), "-days", "2",
            "-subj", "/CN=Baitly TEST " + name,
            "-addext", "basicConstraints=critical,CA:TRUE",
            "-addext", "keyUsage=critical,keyCertSign,cRLSign")


def certificate(root, name, ca, cn, usage, days=1):
    key, csr, cert = (root / (name + suffix) for suffix in (".key", ".csr", ".crt"))
    if any(path.exists() for path in (key, csr, cert, root / (name + ".p12"))):
        raise ValueError("Refusing to overwrite an existing identity")
    ext = root / (name + ".ext")
    ext.write_text("basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\n"
                   + "extendedKeyUsage=" + usage + "\n"
                   + ("subjectAltName=DNS:localhost,IP:127.0.0.1\n" if usage == "serverAuth" else ""))
    openssl("req", "-new", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:P-256", "-nodes",
            "-keyout", key, "-out", csr, "-subj", "/CN=" + cn)
    openssl("x509", "-req", "-in", csr, "-CA", root / (ca + ".crt"),
            "-CAkey", root / (ca + ".key"), "-set_serial", "0x" + secrets.token_hex(16),
            "-out", cert, "-days", str(days), "-extfile", ext)
    openssl("pkcs12", "-export", "-in", cert, "-inkey", key,
            "-out", root / (name + ".p12"), "-passout", "env:BAITLY_MQTT_P12_PASSWORD")
    csr.unlink()
    ext.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["init-test", "issue-device"])
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--fingerprint", help="SHA-256 hex of the current device credential; never the token itself")
    parser.add_argument("--days", type=int, default=30)
    args = parser.parse_args()
    if not os.environ.get("BAITLY_MQTT_P12_PASSWORD"):
        parser.error("Set BAITLY_MQTT_P12_PASSWORD; do not pass passwords as CLI arguments")
    os.umask(0o077)
    root = args.directory.resolve()
    if args.action == "init-test":
        root.mkdir(mode=0o700, parents=True, exist_ok=False)
        for name in ("server-ca", "devices-ca", "ingestion-ca"):
            authority(root, name)
        certificate(root, "server", "server-ca", "localhost", "serverAuth")
        certificate(root, "ingestor", "ingestion-ca", "baitly-ingestor", "clientAuth")
    else:
        if not args.fingerprint or not re.fullmatch("[a-f0-9]{64}", args.fingerprint):
            parser.error("A lowercase SHA-256 fingerprint is required")
        if not 1 <= args.days <= 90:
            parser.error("Certificate lifetime must be 1..90 days")
        certificate(root, "device-" + args.fingerprint, "devices-ca", args.fingerprint, "clientAuth", args.days)


if __name__ == "__main__":
    main()
