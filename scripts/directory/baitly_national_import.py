#!/usr/bin/env python3
"""Development operator: verified bulk stocks, exact SIRET enrichment, no container restart.

Dependencies: Python 3.11+, osmium==4.3.0, Docker CLI, curl, compiled server classes.
Production execution must use the reviewed CI/CD import workflow, never this local command.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import ssl
import sys
import time
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
SERVER = "clenzy-server-dev"
REGIONS = ["guadeloupe", "guyane", "martinique", "mayotte", "reunion"]


def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def database(sql):
    # Credentials stay in the existing local container environment, never in arguments or logs.
    result = run("docker", "exec", "-i", "clenzy-postgres-dev", "sh", "-c",
                 'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At',
                 input=sql, text=True, capture_output=True)
    return result.stdout.strip()


def resource(url, hosts):
    import certifi
    class TrustedRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, request, fp, code, message, headers, target):
            check_url(target, hosts)
            return super().redirect_request(request, fp, code, message, headers, target)
    check_url(url, hosts)
    opener = urllib.request.build_opener(TrustedRedirect(), urllib.request.HTTPSHandler(context=ssl.create_default_context(cafile=certifi.where())))
    with opener.open(urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Baitly-Directory/1.0"}), timeout=60) as response:
        final = response.url
        check_url(final, hosts)
        size, etag = int(response.headers["Content-Length"]), response.headers["ETag"]
        if size <= 0 or size > 10_000_000_000:
            raise ValueError("Unexpected source size")
        return {"url": final, "size": size, "etag": etag}


def check_url(url, hosts):
    from urllib.parse import urlsplit
    value = urlsplit(url)
    if value.scheme != "https" or value.hostname not in hosts or value.username or value.port:
        raise ValueError("Untrusted source URL")


def download(source, target):
    stamp = target.with_suffix(target.suffix + ".source.json")
    if target.exists() and (not stamp.exists() or json.loads(stamp.read_text()) != source):
        raise ValueError(f"Unversioned or changed partial download: {target.name}")
    stamp.write_text(json.dumps(source))
    if target.exists() and target.stat().st_size == source["size"]:
        return
    print(f"Downloading {target.name} ({source['size']} bytes)", flush=True)
    # Each new process recalculates the range from the bytes actually saved. curl --retry
    # would restore the initial offset on retry, discarding gigabytes after a late failure.
    with target.with_suffix(target.suffix + ".download.log").open("a") as log:
        for attempt in range(13):
            try:
                run("curl", "--fail", "--http1.1", "--proto", "=https", "--connect-timeout", "20",
                    "--no-progress-meter", "--max-time", "14400", "--continue-at", "-",
                    "--header", "If-Match: " + source["etag"], "--output", str(target), source["url"],
                    stdout=log, stderr=log)
                break
            except subprocess.CalledProcessError:
                if attempt == 12:
                    raise
                print(f"Resuming {target.name} from {target.stat().st_size if target.exists() else 0} bytes", flush=True)
                time.sleep(min(120, 10 * (attempt + 1)))
    if target.stat().st_size != source["size"]:
        raise ValueError(f"Incomplete source: {target.name}")


def extract_osm(paths, output):
    import osmium
    temporary = output.with_suffix(".partial")
    keys = ["ref:FR:SIRET", "phone", "mobile", "email", "website",
            "contact:phone", "contact:mobile", "contact:email", "contact:website"]
    count = 0
    with temporary.open("w", encoding="utf-8") as stream:
        for path in paths:
            print("Reading OSM " + path.name, flush=True)
            for obj in osmium.FileProcessor(str(path)).with_filter(osmium.filter.KeyFilter("ref:FR:SIRET")):
                siret = obj.tags.get("ref:FR:SIRET", "").strip()
                if not re.fullmatch(r"[0-9]{14}", siret):
                    continue
                kind = {"n": "node", "w": "way", "r": "relation"}[obj.type_str()]
                tags = {key: obj.tags[key] for key in keys if key in obj.tags and len(obj.tags[key]) <= 500}
                row = {"type": kind, "id": obj.id, "tags": tags}
                if kind == "node" and obj.location.valid():
                    row.update(lat=obj.location.lat, lon=obj.location.lon)
                stream.write(json.dumps(row, ensure_ascii=False) + "\n")
                count += 1
    if not count:
        raise ValueError("Empty OSM snapshot")
    temporary.replace(output)
    print(f"OSM snapshot: {count} exact SIRET objects", flush=True)


def operator_jar(target):
    classes = ROOT / "server/target/classes"
    files = list(classes.glob("com/baitly/ops/BaitlyDirectoryImport*.class"))
    files += list(classes.glob("com/clenzy/marketplace/service/BaitlyNationalOsmEnrichment*.class"))
    files += list(classes.glob("com/clenzy/marketplace/service/BaitlyNationalDirectorySync*.class"))
    if len(files) < 4:
        raise ValueError("Compile the directory operator first")
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as jar:
        for path in files:
            jar.write(path, str(path.relative_to(classes)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--osm-france-url", default="https://download.geofabrik.de/europe/france-latest.osm.pbf")
    args = parser.parse_args()
    if not re.fullmatch(r"https://download\.geofabrik\.de/europe/france-(?:latest|[0-9]{6})\.osm\.pbf", args.osm_france_url):
        raise ValueError("Only the official France extract is supported")
    cache = args.cache.resolve()
    cache.mkdir(parents=True, exist_ok=True)
    import fcntl
    lock = (cache / "operator.lock").open("w")
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    # The only permitted destination is the named local development stack.
    run("docker", "inspect", "--format", "{{.State.Running}}", SERVER, stdout=subprocess.DEVNULL)
    status = database("SELECT json_build_object('phase',phase,'scanned',scanned,'selected',selected,'published',published) FROM baitly_directory_sync;")
    print("Existing national checkpoint: " + status, flush=True)
    official = {"www.data.gouv.fr", "static.data.gouv.fr"}
    etab = resource("https://www.data.gouv.fr/api/1/datasets/r/0651fb76-bcf3-4f6a-a38d-bc04fa708576", official)
    units = resource("https://www.data.gouv.fr/api/1/datasets/r/825f4199-cadd-486c-ac46-a65a8ea1a047", official)
    download(etab, cache / "establishments.zip")
    download(units, cache / "units.zip")
    # Bounded workers below independently validate aligned editions and resume durable checkpoints.
    (cache / "sirene.json").write_text(json.dumps({"establishments": etab["url"], "units": units["url"],
        "establishmentsEtag": etab["etag"], "unitsEtag": units["etag"]}))
    operator_jar(cache / "operator.jar")
    remote = "/app/tmp/baitly-directory"
    run("docker", "exec", SERVER, "mkdir", "-p", remote)
    for name in ["operator.jar", "sirene.json", "establishments.zip", "units.zip"]:
        run("docker", "cp", str(cache / name), SERVER + ":" + remote + "/" + name)
    # An explicit local operator request may resume immediately from complete cached
    # archives instead of waiting for a network-failure backoff. Keep failure history.
    database("UPDATE baitly_directory_sync SET retry_at=NULL WHERE phase<>'COMPLETED';")
    java = ["docker", "exec", SERVER, "java", "-Xmx768m", "-Dloader.path=" + remote + "/operator.jar",
        "-Dloader.main=com.baitly.ops.BaitlyDirectoryImport", "-cp", "/app/app.jar",
        "org.springframework.boot.loader.launch.PropertiesLauncher", "--baitly.directory.national.enabled=true",
        "--spring.datasource.hikari.maximum-pool-size=4", "--spring.datasource.hikari.minimum-idle=1"]
    # Sirene can publish while the independent OSM bulk file is downloading.
    sirene_log = (cache / "sirene-operator.log").open("a")
    sirene_worker = subprocess.Popen(java + ["--baitly.directory.operator.sirene-only=true"], stdout=sirene_log, stderr=sirene_log)
    print("Sirene operator launched; preparing the OSM snapshot in parallel", flush=True)
    osm_paths, sources = [], []
    for region in ["france"] + REGIONS:
        url = args.osm_france_url if region == "france" else "https://download.geofabrik.de/europe/france/" + region + "-latest.osm.pbf"
        source = resource(url, {"download.geofabrik.de"})
        path = cache / (region + ".osm.pbf")
        download(source, path)
        osm_paths.append(path)
        sources.append(source)
    extract_osm(osm_paths, cache / "osm.jsonl")
    (cache / "osm.sources.json").write_text(json.dumps({"licence": "ODbL 1.0", "sources": sources,
        "sha256": hashlib.sha256((cache / "osm.jsonl").read_bytes()).hexdigest()}))
    for name in ["osm.jsonl", "osm.sources.json"]:
        run("docker", "cp", str(cache / name), SERVER + ":" + remote + "/" + name)
    print("Launching resumable Sirene publication and exact-SIRET OSM enrichment", flush=True)
    if sirene_worker.wait() != 0:
        raise RuntimeError("Sirene operator failed; see sirene-operator.log")
    run(*java)
    print("BAITLY_NATIONAL_IMPORT_COMPLETED", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("BAITLY_NATIONAL_IMPORT_FAILED: " + str(error), file=sys.stderr, flush=True)
        raise
