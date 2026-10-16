#!/usr/bin/env python3
"""Verify the packaged, non-HTTP migration and retention entry points on an explicitly disposable test DB."""
import os
from pathlib import Path
import subprocess
import tempfile


def property_value(value):
    return value.replace("\\", "\\\\").replace("\n", "\\n").replace("\r", "\\r")


def main():
    credentials = {"url": os.environ["BAITLY_IOT_TEST_DATABASE_URL"],
                   "username": os.environ["BAITLY_IOT_TEST_DATABASE_USER"],
                   "password": os.environ.get("BAITLY_IOT_TEST_DATABASE_PASSWORD", "")}
    jar = Path(__file__).resolve().parents[1] / "target/baitly-iot-0.1.0-SNAPSHOT.jar"
    if not jar.is_file():
        raise ValueError("Run Maven verify before checking the packaged migration entry point")
    with tempfile.TemporaryDirectory(prefix="baitly-migration-test-") as directory:
        file = Path(directory) / "migration.properties"
        file.write_text("".join(key + "=" + property_value(value) + "\n" for key, value in credentials.items()))
        file.chmod(0o600)
        command = ["java", "-Dloader.main=com.baitly.iot.IotMigrationMain", "-cp", str(jar),
                   "org.springframework.boot.loader.launch.PropertiesLauncher", str(file)]
        for _ in range(2):
            result = subprocess.run(command, capture_output=True, timeout=60)
            if result.returncode:
                raise RuntimeError("Packaged migration entry point failed; credentials/output withheld")
        retention = Path(directory) / "retention.properties"
        retention.write_text(file.read_text() + "retentionDays=90\n")
        retention.chmod(0o600)
        result = subprocess.run(["java", "-Dloader.main=com.baitly.iot.IotRetentionMain", "-cp", str(jar),
                                 "org.springframework.boot.loader.launch.PropertiesLauncher", str(retention)],
                                capture_output=True, timeout=60)
        if result.returncode or not result.stdout.startswith(b"Baitly IoT retention:"):
            raise RuntimeError("Packaged retention entry point failed; credentials/output withheld")
    print("Packaged migration (twice) and retention entry points passed without starting an HTTP server")


if __name__ == "__main__":
    main()
