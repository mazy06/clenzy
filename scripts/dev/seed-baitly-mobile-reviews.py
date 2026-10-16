"""Seed local fictional reviews and export the DB snapshot used by the demo app."""
import argparse
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "mobile/src/features/marketplace/baitlyDemoReviews.json"
CLIENTS_TARGET = ROOT / "mobile/src/features/marketplace/baitlyDemoClients.json"
PSQL = ["rtk", "proxy", "docker", "exec", "clenzy-postgres-dev",
        "psql", "-X", "-U", "clenzy", "-d", "clenzy_dev", "-v", "ON_ERROR_STOP=1"]


def run_sql(sql):
    return subprocess.run(PSQL + ["-qAt", "-c", sql], text=True,
                          check=True, capture_output=True).stdout.strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Compare the snapshot with the local DB without changes")
    args = parser.parse_args()
    if run_sql("SELECT current_database();") != "clenzy_dev":
        raise RuntimeError("Local development database required")
    if not args.check:
        run_sql(Path(__file__).with_suffix(".sql").read_text())
    rows = json.loads(run_sql("""
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'providerId', provider_id, 'clientName', client_name,
        'clientRole', client_role, 'clientOrganization', client_organization,
        'portraitIndex', portrait_index, 'clientProfileId', 'baitly-demo-client-' || portrait_index,
        'rating', rating, 'feedback', feedback,
        'serviceLabel', service_label, 'reviewedOn', reviewed_on, 'demo', is_demo
      ) ORDER BY reviewed_on DESC, id), '[]'::jsonb)
      FROM baitly_demo.provider_reviews;
    """))
    if not rows or any(not row["demo"] or row["providerId"] not in range(-5, 0) for row in rows):
        raise RuntimeError("Only explicit fictional demo reviews can be exported")
    clients = json.loads(run_sql("SELECT COALESCE(jsonb_agg(payload ORDER BY id), '[]'::jsonb) FROM baitly_demo.client_profiles;"))
    if len(clients) != 6 or any(not client["demo"] for client in clients):
        raise RuntimeError("Six explicit fictional client profiles required")
    if args.check:
        if json.loads(TARGET.read_text()) != rows:
            raise RuntimeError("Mobile snapshot differs from the local database; rerun the seed/export")
        if json.loads(CLIENTS_TARGET.read_text()) != clients:
            raise RuntimeError("Client snapshot differs from the local database")
    else:
        TARGET.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
        CLIENTS_TARGET.write_text(json.dumps(clients, ensure_ascii=False, indent=2) + "\n")
    print(f"Baitly: {len(rows)} fictional reviews and {len(clients)} client profiles {'verified' if args.check else 'seeded and exported'}.")


if __name__ == "__main__":
    main()
