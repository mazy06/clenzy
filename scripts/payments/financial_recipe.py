#!/usr/bin/env python3
"""Recette Baitly isolée, sans clé PSP, serveur applicatif ni mutation sandbox."""
import argparse
import fnmatch
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).with_suffix(".json")


def validate_jdbc(value):
    match = re.fullmatch(r"jdbc:postgresql://(?:127\.0\.0\.1|localhost):(\d+)/([a-zA-Z0-9_]+)", value or "")
    if not match:
        raise ValueError("Fournir une URL PostgreSQL locale de test, sans identifiants ni paramètres.")
    port, database = match.groups()
    if not re.search(r"(?:^|_)(?:test|recipe|ci)(?:_|$)", database) and (port, database) != ("55439", "postgres"):
        raise ValueError("Base refusée : utiliser une base dédiée nommée *_test ou *_recipe, jamais la base Baitly.")
    return value


def validate_pdf_url(value):
    # Moteur PDF (Gotenberg) éphémère du poste ou du runner : jamais un service partagé.
    if not re.fullmatch(r"http://(?:127\.0\.0\.1|localhost):\d+", value or ""):
        raise ValueError("Fournir --pdf-url : moteur PDF local de test (http://127.0.0.1:<port>), requis par les rendus réels.")
    return value


def required_backend(selectors, files):
    names = {path.stem for path in files}
    required = set()
    for selector in selectors:
        matches = {name for name in names if fnmatch.fnmatchcase(name, selector)}
        if not matches:
            raise ValueError(f"Sélection backend vide : {selector}")
        required.update(matches)
    return required


def verify_reports(paths, required, frontend=False):
    suites = []
    for path in paths:
        root = ET.parse(path).getroot()
        suites.extend([root] if root.tag == "testsuite" else root.iter("testsuite"))
    if not suites:
        raise ValueError("Aucun rapport de la présente exécution.")
    totals = {key: sum(int(suite.get(key, "0")) for suite in suites) for key in ("tests", "failures", "errors", "skipped")}
    names = {suite.get("name", "").replace("\\", "/"): int(suite.get("tests", "0")) for suite in suites}
    for name in required:
        present = any(count > 0 and (key == name or key.endswith("/" + name) if frontend
                                    else key.rsplit(".", 1)[-1].split("$", 1)[0] == name)
                      for key, count in names.items())
        if not present:
            raise ValueError(f"Recette requise absente ou vide : {name}")
    if totals["tests"] == 0 or any(totals[key] for key in ("failures", "errors", "skipped")):
        raise ValueError(f"Recette incomplète : {totals}")
    return totals


def validate_frontend_typecheck(required, config):
    # La compilation applicative exclut les tests. Chaque suite de recette doit donc
    # figurer explicitement dans le second projet TypeScript, sans exclusions héritées.
    missing = set(required) - set(config.get("include", []))
    if missing or config.get("exclude") != []:
        raise ValueError(f"Typage de la recette incomplet : {sorted(missing)} ; aucune exclusion n'est autorisée.")


def run(command, cwd, log):
    # RTK local quand disponible ; les runners CI n'ont pas besoin de l'installer.
    import shutil
    if shutil.which("rtk"):
        command = ["rtk", "proxy", *command]
    print(f"Exécution {cwd.name} ; journal : {log}", flush=True)
    with log.open("w") as output:
        result = subprocess.run(command, cwd=cwd, stdout=output, stderr=subprocess.STDOUT, timeout=1800, check=False)
    if result.returncode:
        # Les rapports restent disponibles pour le diagnostic, même en échec.
        raise RuntimeError(f"Commande échouée ({result.returncode}), consulter {log}")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope", choices=("all", "backend", "frontend"), default="all")
    parser.add_argument("--jdbc", help="Base PostgreSQL éphémère déjà démarrée ; aucun conteneur n'est géré.")
    parser.add_argument("--pdf-url", help="Moteur PDF (Gotenberg) local déjà démarré, requis pour le backend.")
    parser.add_argument("--output", type=Path, help="Dossier de rapports neuf (doit ne pas exister).")
    parser.add_argument("--list", action="store_true", help="Lister les suites sans les exécuter.")
    args = parser.parse_args(argv)
    manifest = json.loads(MANIFEST.read_text())
    validate_frontend_typecheck(manifest["frontend"], json.loads((ROOT / "client/tsconfig.finance-tests.json").read_text()))
    backend = required_backend(manifest["backend"], (ROOT / "server/src/test").rglob("*.java"))
    for path in manifest["frontend"]:
        if not (ROOT / "client" / path).is_file():
            raise ValueError(f"Test frontend absent : {path}")
    if args.list:
        print(json.dumps({"backend": sorted(backend), "frontend": manifest["frontend"]}, indent=2))
        return 0
    if args.scope != "frontend":
        validate_jdbc(args.jdbc)
        validate_pdf_url(args.pdf_url)
    if args.output:
        output = args.output.resolve(); output.mkdir(parents=True, exist_ok=False)
    else:
        (ROOT / "tmp").mkdir(exist_ok=True)
        output = Path(tempfile.mkdtemp(prefix="baitly-financial-recipe-", dir=ROOT / "tmp"))
    results = {"scope": args.scope, "sandbox": "NON EXECUTE", "reports": str(output)}
    # Un rapport isolé par lancement empêche une vieille suite verte de masquer un test absent.
    try:
        if args.scope != "frontend":
            reports = output / "backend"
            run(["mvn", "-B", "-Dtest=" + ",".join(manifest["backend"]), "-Dbaitly.test.jdbc=" + args.jdbc, "-Dbaitly.test.pdf-url=" + args.pdf_url,
                 "-Dbaitly.test.reportsDirectory=" + str(reports), "test"], ROOT / "server", output / "backend.log")
            results["backend"] = verify_reports(reports.glob("TEST-*.xml"), backend)
        if args.scope != "backend":
            node = os.environ.get("BAITLY_TEST_NODE", "node")
            run([node, "node_modules/typescript/bin/tsc", "--noEmit", "-p", "tsconfig.json"], ROOT / "client", output / "typecheck.log")
            run([node, "node_modules/typescript/bin/tsc", "--noEmit", "-p", "tsconfig.finance-tests.json"], ROOT / "client", output / "test-typecheck.log")
            report = output / "frontend.xml"
            # Les suites HTTP/jsdom chargent de gros écrans ; borner les workers évite la saturation
            # et les faux timeouts de rendu lorsque les vérifications mobiles tournent aussi.
            run([node, "node_modules/vitest/vitest.mjs", "run", *manifest["frontend"], "--maxWorkers=2", "--reporter=default",
                 "--reporter=junit", "--outputFile=" + str(report)], ROOT / "client", output / "frontend.log")
            results["frontend"] = verify_reports([report], manifest["frontend"], frontend=True)
        results["status"] = "passed"
    except (ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
        results["status"] = "failed"; results["error"] = str(error)
        raise
    finally:
        (output / "summary.json").write_text(json.dumps(results, indent=2) + "\n")
        print(json.dumps(results, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, RuntimeError, subprocess.TimeoutExpired) as failure:
        print(str(failure), file=sys.stderr); sys.exit(1)
