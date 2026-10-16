"""Appliquer la migration et vérifier le lien sur un PostgreSQL CI isolé."""
import json
import os
from pathlib import Path
import subprocess
from urllib.parse import urlsplit

url = os.environ["BAITLY_SQL_TEST_DB_URL"]
parsed = urlsplit(url)
if parsed.hostname not in {"localhost", "127.0.0.1"} or parsed.path != "/baitly_planning_index_test":
    raise SystemExit("Refus : base PostgreSQL CI locale dédiée requise")

def sql(statement):
    # Aucun URL ni mot de passe publié dans les sorties de diagnostic.
    result = subprocess.run(["psql", url, "-XqAt", "-v", "ON_ERROR_STOP=1"],
            input=statement, text=True, capture_output=True)
    if result.returncode:
        raise SystemExit("Échec PostgreSQL CI ; aucune URL ni donnée privée publiée")
    return result.stdout.strip()

sql("""CREATE TABLE reservations(id bigint PRIMARY KEY, organization_id bigint NOT NULL,
 intervention_id bigint, hidden_from_planning boolean NOT NULL, status varchar NOT NULL);
INSERT INTO reservations SELECT n,1+(n-1)/4000,
 CASE WHEN n%8=0 THEN n/8 ELSE NULL END, n%160=0,
 CASE WHEN n%160=0 THEN 'cancelled' ELSE 'pending' END FROM generate_series(1,18000) n;
ANALYZE reservations;""")
read = """SELECT intervention_id,min(id) AS reservation_id FROM reservations
 WHERE organization_id=1 AND intervention_id IN (1,2,3,4,5,6,7,8,9,10)
 GROUP BY intervention_id ORDER BY intervention_id"""
wrapped = "SELECT coalesce(json_agg(q),'[]'::json) FROM (" + read + ") q;"
before = json.loads(sql(wrapped))
root = Path(__file__).resolve().parents[2]
sql((root / "server/src/main/resources/db/changelog/changes/0547__baitly_planning_reservation_intervention_index.sql").read_text())
sql("ANALYZE reservations;")
assert json.loads(sql(wrapped)) == before
valid = sql("SELECT indisvalid FROM pg_index WHERE indexrelid='idx_baitly_reservation_org_intervention'::regclass;")
assert valid == "t"
plan = json.loads(sql("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + read + ";"))[0]
def indexes(node):
    return ([node['Index Name']] if 'Index Name' in node else []) + [
        name for child in node.get('Plans', []) for name in indexes(child)]
assert "idx_baitly_reservation_org_intervention" in indexes(plan['Plan'])
print(json.dumps({"migrationValid": True, "sameLinks": True, "indexUsed": True,
    "executionMs": plan['Execution Time']}))
