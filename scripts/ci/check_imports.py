#!/usr/bin/env python3
"""Vérifie que chaque import relatif ou par alias des sources pointe vers un fichier existant.

Couvre ce que `tsc` ne voit pas : imports CSS/JSON/assets (`import './x.css'`, `@import`, `url()`),
`vi.mock('./x')`, `require()`, `import()` dynamiques. Un fichier supprimé par erreur fait échouer
la CI ici, avant le build. Les paquets npm (`react`, `@mui/...`) ne sont pas vérifiés.

Usage : python3 scripts/ci/check_imports.py [racine-du-dépôt]
Sortie : code 1 et la liste « fichier -> import » si au moins un import ne se résout pas.
"""
import os
import re
import sys
from pathlib import Path

# (dossier, alias {préfixe: dossier cible}) — aligné sur vite.config.ts / tsconfig.json de chaque projet.
SCAN = (
    ("client/src", {}), ("client/site", {}), ("client/tests", {}), ("client/tooling", {}),
    ("mobile/src", {"@/": "mobile/src/", "@shared/": "shared/src/"}),
    ("shared/src", {}), ("booking-sdk/src", {}), ("copilot-runtime", {}),
)
EXTS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".scss", ".d.ts")
SKIP_DIRS = {"node_modules", "dist", "build", ".expo", "coverage"}
SOURCE_SUFFIXES = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".scss", ".html")
EXTERNAL = ("http:", "https:", "data:", "//", "#", "virtual:", "node:")

RE_JS = re.compile(
    r"""(?:^|[\s;(,{}])(?:import\s+(?:[^'"()]*?\s+from\s+)?|export\s+[^'"()]*?\s+from\s+"""
    r"""|import\s*\(\s*|require\s*\(\s*|vi\.mock\(\s*|jest\.mock\(\s*)['"]([^'"]+)['"]""", re.M)
RE_CSS = re.compile(r"""(?:@import\s+(?:url\()?|url\()\s*['"]?([^'")\s]+)['"]?""")
RE_HTML = re.compile(r"""(?:src|href)=["'](\.[^"']+)["']""")


def exists(base: Path) -> bool:
    if base.is_file() or any(Path(str(base) + ext).is_file() for ext in EXTS):
        return True
    return base.is_dir() and any((base / f"index{ext}").is_file() for ext in EXTS)


def resolves(spec: str, source: Path, root: Path, alias: dict) -> bool:
    if spec.startswith(EXTERNAL):
        return True
    spec = spec.split("?")[0].split("#")[0]
    if spec.startswith("."):
        return exists((source.parent / spec).resolve())
    for prefix, target in alias.items():
        if spec.startswith(prefix):
            return exists((root / target / spec[len(prefix):]).resolve())
    return True  # paquet npm ou chemin absolu servi par le serveur : hors périmètre


def specifiers(path: Path, text: str):
    if path.suffix == ".html":
        return RE_HTML.findall(text)
    if path.suffix in (".css", ".scss"):
        return RE_CSS.findall(text)
    return RE_JS.findall(text)


def check(root: Path):
    """Retourne (nombre d'imports analysés, [(fichier, import)] non résolus)."""
    total, broken = 0, set()
    for folder, alias in SCAN:
        base = root / folder
        if not base.is_dir():
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for name in filenames:
                path = Path(dirpath) / name
                if path.suffix not in SOURCE_SUFFIXES:
                    continue
                for spec in specifiers(path, path.read_text(errors="ignore")):
                    total += 1
                    if not resolves(spec, path, root, alias):
                        broken.add((str(path.relative_to(root)), spec))
    return total, sorted(broken)


def main(argv=None):
    root = Path((argv or sys.argv[1:] or [Path(__file__).resolve().parents[2]])[0]).resolve()
    total, broken = check(root)
    print(f"Imports analysés : {total} ; non résolus : {len(broken)}")
    for source, spec in broken:
        print(f"  ERREUR {source} -> {spec}")
    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main())
