#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fusionne data/sections/*.json en un CSV maitre data/40-feature-evolution.csv."""
import csv, json, os, glob, re
from collections import Counter

BASE = os.path.dirname(os.path.abspath(__file__))
SEC = os.path.join(BASE, "data", "sections")
OUT = os.path.join(BASE, "data", "40-feature-evolution.csv")

KEYS = ["section", "fonctionnalite", "clenzy_actuel", "hostaway", "guesty", "cible",
        "evolution_fonctionnelle", "evolution_technique", "multipays", "composants", "effort", "priorite"]
HEADER = ["Section", "Fonctionnalite", "Clenzy_actuel", "Hostaway", "Guesty", "Cible",
          "Evolution_fonctionnelle", "Evolution_technique", "Multipays_FR_MA_KSA", "Composants_Clenzy", "Effort", "Priorite"]

def sec_order(s):
    m = re.match(r"\s*(\d+)", s or "")
    return int(m.group(1)) if m else 999

DIFF_KW = ["differenc", "différenc", "plafond", "au-del", "au dela", "au-dela", "moat",
           "avantage", "maintenir", "specialiste", "spécialiste", "superieur", "supérieur", "consolider"]

def norm_cible(v):
    s = (v or "").strip().lower()
    if any(k in s for k in DIFF_KW):
        return "Differenciation"
    if "parit" in s:
        return "Parite"
    if s.startswith("differ"):
        return "Differenciation"
    return "Parite"

rows, report = [], []
for path in sorted(glob.glob(os.path.join(SEC, "*.json"))):
    name = os.path.basename(path)
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        report.append("ERREUR JSON %s: %s" % (name, e))
        continue
    if not isinstance(data, list):
        report.append("ERREUR %s: pas un tableau" % name)
        continue
    n = 0
    for obj in data:
        missing = [k for k in KEYS if k not in obj]
        if missing:
            report.append("  %s: cle manquante %s sur '%s'" % (name, missing, obj.get("fonctionnalite", "?")[:40]))
        row = {k: str(obj.get(k, "")).replace("\n", " ").strip() for k in KEYS}
        row["cible"] = norm_cible(row["cible"])
        rows.append(row)
        n += 1
    report.append("%-28s %3d features" % (name, n))

rows.sort(key=lambda r: (sec_order(r["section"]), r["section"]))

with open(OUT, "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
    w.writerow(HEADER)
    for r in rows:
        w.writerow([r[k] for k in KEYS])

print("\n".join(report))
print("\n=== TOTAL: %d features -> %s ===" % (len(rows), os.path.relpath(OUT, BASE)))
print("Par priorite:", dict(Counter(r["priorite"] for r in rows)))
print("Par effort  :", dict(Counter(r["effort"] for r in rows)))
print("Par cible   :", dict(Counter(r["cible"] for r in rows)))
print("Sections    :", len(set(r["section"] for r in rows)))
# round-trip validation
with open(OUT, encoding="utf-8") as f:
    back = list(csv.DictReader(f))
print("Relecture CSV OK:", len(back), "lignes,", len(back[0]) if back else 0, "colonnes")
