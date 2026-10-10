"""Fixtures et plans SQL Baitly, exclusivement sur app.clenzy.fr, exécutés par CI."""
import argparse
import json
import os
from pathlib import Path
import shlex
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import date, timedelta

DOMAIN = "app.clenzy.fr"
AUTH = "https://auth.clenzy.fr/realms/clenzy/protocol/openid-connect/token"
REALM = "clenzy"
MARKER = "baitly-planning-performance-v1"
COMPOSE = ["docker", "compose", "-f", "docker-compose.prod.yml", "--env-file", ".env"]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


HTTP = urllib.request.build_opener(NoRedirect)


class FixtureError(RuntimeError):
    pass


def require_staging():
    if os.environ.get("APP_DOMAIN") != DOMAIN:
        raise FixtureError("Refus : APP_DOMAIN doit être exactement app.clenzy.fr")


def command(args, content=None):
    result = subprocess.run(args, input=content, text=True, capture_output=True, timeout=120)
    if result.returncode:
        raise FixtureError("Commande de fixture échouée ; sorties et secrets non journalisés")
    return result.stdout.strip()


class Staging:
    def keycloak(self, args, body=None):
        require_staging()
        script = """set -eu
set +x
umask 077
CONFIG=$(mktemp)
BODY=$(mktemp)
trap 'rm -f "$CONFIG" "$BODY"' EXIT
KCADM=/opt/keycloak/bin/kcadm.sh
$KCADM config credentials --config "$CONFIG" --server http://localhost:8080 \\
 --realm master --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null
"""
        if body is not None:
            script += "printf '%s' " + shlex.quote(json.dumps(body)) + ' > "$BODY"\n'
        script += "$KCADM " + shlex.join(args) + ' --config "$CONFIG"'
        if body is not None:
            script += ' -f "$BODY"'
        output = command(COMPOSE + ["exec", "-T", "keycloak", "sh", "-s"], script + "\n")
        return json.loads(output) if args[0] == "get" and output else None

    def sql(self, query, **variables):
        require_staging()
        args = ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"]
        for key, value in variables.items():
            args += ["-v", f"{key}={value}"]
        shell = shlex.join(args) + ' -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
        output = command(COMPOSE + ["exec", "-T", "postgres", "sh", "-c", "exec " + shell], query)
        return json.loads(output) if output else None

    def api(self, path, token, body=None):
        require_staging()
        if not path.startswith("/api/") or ".." in path or ":" in path:
            raise FixtureError("Chemin API de fixture invalide")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 Baitly-Staging-Perf"}
        request = urllib.request.Request(f"https://{DOMAIN}{path}",
                data=json.dumps(body).encode() if body is not None else None, headers=headers)
        try:
            with HTTP.open(request, timeout=30) as response:
                if urllib.parse.urlsplit(response.url).hostname != DOMAIN:
                    raise FixtureError("Redirection de fixture refusée")
                return json.load(response)
        except urllib.error.HTTPError as error:
            raise FixtureError(f"API de fixture {path} refusée (HTTP {error.code}) ; aucun corps journalisé") from None

    def token(self, client_id, secret):
        require_staging()
        request = urllib.request.Request(AUTH, data=urllib.parse.urlencode({
            "grant_type": "client_credentials", "client_id": client_id, "client_secret": secret,
        }).encode(), headers={"User-Agent": "Mozilla/5.0 Baitly-Staging-Perf"})
        try:
            with HTTP.open(request, timeout=30) as response:
                if response.url != AUTH:
                    raise FixtureError("Redirection d’authentification refusée")
                payload = json.load(response)
        except urllib.error.HTTPError as error:
            raise FixtureError(f"Authentification de fixture refusée (HTTP {error.code})") from None
        if not payload.get("access_token") or payload.get("expires_in", 0) < 240:
            raise FixtureError("Jeton de fixture absent ou trop court")
        return payload["access_token"]


def ensure_client(ops, name):
    clients = ops.keycloak(["get", "clients", "-r", REALM, "-q", f"clientId={name}"])
    if clients:
        if len(clients) != 1 or clients[0].get("clientId") != name or clients[0].get("attributes", {}).get("baitly_fixture") != MARKER:
            raise FixtureError("Client existant non reconnu ; aucune identité adoptée")
        ops.keycloak(["update", f"clients/{clients[0]['id']}", "-r", REALM], {
            "enabled": True, "attributes": {"baitly_fixture": MARKER, "access.token.lifespan": "300"}})
    else:
        ops.keycloak(["create", "clients", "-r", REALM], {
            "clientId": name, "name": name, "enabled": True, "protocol": "openid-connect",
            "publicClient": False, "serviceAccountsEnabled": True, "standardFlowEnabled": False,
            "directAccessGrantsEnabled": False, "fullScopeAllowed": True,
            "defaultClientScopes": ["profile", "email", "roles"],
            "attributes": {"baitly_fixture": MARKER, "access.token.lifespan": "300"},
        })
        clients = ops.keycloak(["get", "clients", "-r", REALM, "-q", f"clientId={name}"])
    client_id = str(uuid.UUID(clients[0]["id"]))
    # Le serveur exige cette audience pour tous les JWT, y compris les comptes de mesure.
    mappers = ops.keycloak(["get", f"clients/{client_id}/protocol-mappers/models", "-r", REALM])
    mapper = {"name": "baitly-planning-api-audience", "protocol": "openid-connect",
        "protocolMapper": "oidc-audience-mapper", "config": {
            "included.client.audience": "clenzy-api", "access.token.claim": "true", "id.token.claim": "false"}}
    existing_mapper = next((item for item in mappers if item["name"] == mapper["name"]), None)
    if existing_mapper:
        ops.keycloak(["update", f"clients/{client_id}/protocol-mappers/models/{existing_mapper['id']}", "-r", REALM], mapper)
    else:
        ops.keycloak(["create", f"clients/{client_id}/protocol-mappers/models", "-r", REALM], mapper)
    user = ops.keycloak(["get", f"clients/{client_id}/service-account-user", "-r", REALM])
    subject = str(uuid.UUID(user["id"]))
    # Comptes machine temporaires de staging, sans administrateur du realm Keycloak.
    ops.keycloak(["update", f"users/{subject}", "-r", REALM], {
        "email": f"{name}@example.invalid", "emailVerified": True, "firstName": "Baitly Perf", "lastName": name,
    })
    roles = ops.keycloak(["get", "roles", "-r", REALM])
    role = next((role for role in roles if role["name"] == "SUPER_ADMIN"), None)
    if role is None:
        raise FixtureError("Rôle applicatif SUPER_ADMIN absent ; aucun rôle du realm créé")
    ops.keycloak(["create", f"users/{subject}/role-mappings/realm", "-r", REALM], [{"id": role["id"], "name": role["name"]}])
    secret = ops.keycloak(["get", f"clients/{client_id}/client-secret", "-r", REALM])["value"]
    return subject, secret


def ensure_organization(ops, slug, user_id, subject):
    return ops.sql("""BEGIN;
SET LOCAL lock_timeout = '5s';
INSERT INTO organizations(name,type,slug,deferred_payment,has_voucher_contract,mfa_required,
 lead_capture_enabled,lead_capture_popup_enabled,abandoned_cart_recovery_enabled,created_at)
VALUES (:'slug','INDIVIDUAL',:'slug',false,false,false,false,false,false,CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO NOTHING;
UPDATE users SET organization_id = o.id FROM organizations o
 WHERE o.slug=:'slug' AND o.name=:'slug' AND users.id=:'user_id'::bigint
 AND users.keycloak_id=:'subject' AND users.role='SUPER_ADMIN'
 AND (users.organization_id IS NULL OR users.organization_id=o.id);
INSERT INTO organization_members(organization_id,user_id,role_in_org,joined_at)
 SELECT o.id,u.id,'OWNER',CURRENT_TIMESTAMP FROM organizations o JOIN users u ON u.organization_id=o.id
 WHERE o.slug=:'slug' AND o.name=:'slug' AND u.id=:'user_id'::bigint AND u.keycloak_id=:'subject'
ON CONFLICT (organization_id,user_id) DO NOTHING;
SELECT json_build_object('organizationId',o.id,'userId',u.id) FROM organizations o
 JOIN users u ON u.organization_id=o.id WHERE o.slug=:'slug' AND o.name=:'slug'
 AND u.id=:'user_id'::bigint AND u.keycloak_id=:'subject';
COMMIT;
""", slug=slug, user_id=user_id, subject=subject)


def fill_portfolio(ops, slug, count, user_id, token, start, end):
    existing = ops.sql("""BEGIN READ ONLY;
SELECT json_build_object('propertyIds',coalesce(json_agg(p.id ORDER BY p.id),'[]'::json))
 FROM properties p JOIN organizations o ON o.id=p.organization_id WHERE o.slug=:'slug' AND o.name=:'slug';
COMMIT;
""", slug=slug)["propertyIds"]
    if not existing:
        property_dto = ops.api("/api/properties", token, {
            "name": f"{slug}-property-1", "description": MARKER, "address": "1 Test Street",
            "city": "London", "country": "United Kingdom", "countryCode": "GB", "timezone": "Europe/London",
            "latitude": 51.5, "longitude": -0.12, "bedroomCount": 1, "bathroomCount": 1,
            "maxGuests": 4, "nightlyPrice": 100, "minimumNights": 1, "type": "APARTMENT", "ownerId": user_id,
        })
        existing = [property_dto["id"]]
    if len(existing) not in {1, count}:
        raise FixtureError("Portefeuille de fixture incomplet ; aucune donnée inconnue écrasée")
    guest_ids = ops.sql("""BEGIN READ ONLY;
SELECT coalesce(json_agg(g.id ORDER BY g.id),'[]'::json) FROM guests g
 JOIN organizations o ON o.id=g.organization_id WHERE o.slug=:'slug' AND o.name=:'slug';
COMMIT;
""", slug=slug)
    if not guest_ids:
        guest = ops.api("/api/guests", token, {"firstName": "Baitly", "lastName": "Fixture",
            "email": f"guest-{slug}@example.invalid", "phone": "+447700900001"})
        guest_ids = [guest["id"]]
    # Copier uniquement des données synthétiques : les colonnes chiffrées restent du ciphertext JPA.
    # Chaque séjour utilisera un ID voyageur distinct pour ne pas masquer le coût de déchiffrement.
    ops.sql("""BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
INSERT INTO properties SELECT (jsonb_populate_record(NULL::properties,to_jsonb(p) || jsonb_build_object(
 'id',nextval(pg_get_serial_sequence('properties','id')),'name',:'slug'||'-property-'||n))).*
 FROM properties p JOIN organizations o ON o.id=p.organization_id CROSS JOIN generate_series(2,:'count'::integer) n
 WHERE o.slug=:'slug' AND o.name=:'slug' AND p.id=:'property_id'::bigint
 AND (SELECT count(*) FROM properties WHERE organization_id=o.id)=1;
INSERT INTO guests SELECT (jsonb_populate_record(NULL::guests,to_jsonb(g) || jsonb_build_object(
 'id',nextval(pg_get_serial_sequence('guests','id'))))).*
 FROM guests g JOIN organizations o ON o.id=g.organization_id CROSS JOIN generate_series(2,:'guest_count'::integer) n
 WHERE o.slug=:'slug' AND o.name=:'slug' AND g.id=:'guest_id'::bigint
 AND (SELECT count(*) FROM guests WHERE organization_id=o.id)=1;
SELECT json_build_object('properties',(SELECT count(*) FROM properties p JOIN organizations o ON o.id=p.organization_id
 WHERE o.slug=:'slug' AND o.name=:'slug'),'guests',(SELECT count(*) FROM guests g JOIN organizations o ON o.id=g.organization_id
 WHERE o.slug=:'slug' AND o.name=:'slug'));
COMMIT;
""", slug=slug, count=count, property_id=existing[0], guest_id=guest_ids[0], guest_count=count * 4)
    reservations = ops.sql("""BEGIN READ ONLY;
SELECT count(*) FROM reservations r JOIN organizations o ON o.id=r.organization_id WHERE o.slug=:'slug' AND o.name=:'slug';
COMMIT;
""", slug=slug)
    if not reservations:
        ops.api("/api/reservations", token, {"propertyId": existing[0], "guestId": guest_ids[0],
            "guestName": "Baitly Fixture", "guestCount": 2, "checkIn": start,
            "checkOut": (date.fromisoformat(start) + timedelta(days=4)).isoformat(),
            "status": "pending", "totalPrice": 1000, "createCleaning": False, "notes": MARKER})
    return ops.sql("""BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
WITH properties_in_fixture AS (SELECT p.*,row_number() OVER (ORDER BY p.id) AS ordinal FROM properties p
 JOIN organizations o ON o.id=p.organization_id WHERE o.slug=:'slug' AND o.name=:'slug'),
guests_in_fixture AS (SELECT g.id,row_number() OVER (ORDER BY g.id) AS ordinal FROM guests g
 JOIN organizations o ON o.id=g.organization_id WHERE o.slug=:'slug' AND o.name=:'slug'),
template AS (SELECT r.* FROM reservations r JOIN organizations o ON o.id=r.organization_id
 WHERE o.slug=:'slug' AND o.name=:'slug' ORDER BY r.id LIMIT 1)
INSERT INTO reservations SELECT (jsonb_populate_record(NULL::reservations,to_jsonb(r) || jsonb_build_object(
 'id',nextval(pg_get_serial_sequence('reservations','id')),'property_id',p.id,'guest_id',g.id,
 'notes',:'marker','migration_automation_paused',true,
 'check_in',(:'start'::date+(n-1)*7)::text,'check_out',(:'start'::date+(n-1)*7+4)::text))).*
 FROM template r CROSS JOIN properties_in_fixture p CROSS JOIN generate_series(1,4) n
 JOIN guests_in_fixture g ON g.ordinal=(p.ordinal-1)*4+n
 WHERE NOT EXISTS (SELECT 1 FROM reservations present WHERE present.organization_id=p.organization_id
 AND present.property_id=p.id AND present.guest_id=g.id);
UPDATE reservations r SET migration_automation_paused=true FROM organizations o
 WHERE r.organization_id=o.id AND o.slug=:'slug' AND o.name=:'slug';
INSERT INTO interventions(organization_id,property_id,requestor_id,assigned_user_id,title,description,type,status,priority,
 scheduled_date,start_time,estimated_duration_hours,created_at,version,currency,notes)
 SELECT p.organization_id,p.id,:'user_id'::bigint,:'user_id'::bigint,'Baitly fixture',:'marker','CLEANING','PENDING','MEDIUM',
 :'start'::date + TIME '11:00',:'start'::date + TIME '11:00',3,CURRENT_TIMESTAMP,0,'GBP',:'marker'
 FROM properties p JOIN organizations o ON o.id=p.organization_id WHERE o.slug=:'slug' AND o.name=:'slug'
 AND NOT EXISTS (SELECT 1 FROM interventions i WHERE i.organization_id=o.id AND i.property_id=p.id AND i.notes=:'marker');
UPDATE reservations r SET intervention_id=i.id FROM interventions i JOIN organizations o ON o.id=i.organization_id
 WHERE o.slug=:'slug' AND o.name=:'slug' AND i.notes=:'marker' AND i.property_id%2=0
 AND r.organization_id=o.id AND r.property_id=i.property_id
 AND r.id=(SELECT min(r2.id) FROM reservations r2 WHERE r2.property_id=i.property_id AND r2.organization_id=o.id);
SELECT json_build_object('propertyIds',(SELECT json_agg(p.id ORDER BY p.id) FROM properties p WHERE p.organization_id=o.id),
 'reservations',(SELECT count(*) FROM reservations r WHERE r.organization_id=o.id),
 'interventions',(SELECT count(*) FROM interventions i WHERE i.organization_id=o.id))
 FROM organizations o WHERE o.slug=:'slug' AND o.name=:'slug';
COMMIT;
""", slug=slug, marker=MARKER, user_id=user_id, start=start)


def provision(ops, per_cohort, start, end):
    require_staging()
    first, last = date.fromisoformat(start), date.fromisoformat(end)
    if not 26 <= (last-first).days <= 62:
        raise FixtureError("La fixture requiert une fenêtre de 26 à 62 jours")
    actors = []
    for count in (10, 100, 1000):
        for ordinal in range(1, per_cohort + 1):
            name = f"baitly-perf-{count}-{ordinal:02d}"
            subject, secret = ensure_client(ops, name)
            token = ops.token(name, secret)
            profile = ops.api("/api/auth/me", token)
            if profile.get("role") != "SUPER_ADMIN" or profile.get("subject") != subject or not profile.get("id"):
                raise FixtureError("Profil applicatif de fixture absent ou inattendu")
            org = ensure_organization(ops, name, profile["id"], subject)
            if not org:
                raise FixtureError("Rattachement de fixture refusé")
            # Le contexte tenant est résolu depuis le profil BDD ; aucun token forgé ni filtre désactivé.
            data = fill_portfolio(ops, name, count, profile["id"], token, start, end)
            if len(data["propertyIds"]) != count or data["reservations"] != count * 4 or data["interventions"] != count:
                raise FixtureError("Volumes de fixture inattendus")
            actors.append({"clientId": name, "clientSecret": secret, "propertyIds": data["propertyIds"]})
            print(json.dumps({"cohort": count, "account": ordinal, "reservations": data["reservations"], "interventions": data["interventions"]}))
            time.sleep(0.2)
    return actors


def disable(ops, per_cohort):
    require_staging()
    for count in (10, 100, 1000):
        for ordinal in range(1, per_cohort + 1):
            name = f"baitly-perf-{count}-{ordinal:02d}"
            clients = ops.keycloak(["get", "clients", "-r", REALM, "-q", f"clientId={name}"])
            for client in clients:
                if client.get("clientId") != name or client.get("attributes", {}).get("baitly_fixture") != MARKER:
                    raise FixtureError("Désactivation refusée pour un client non marqué")
                ops.keycloak(["update", f"clients/{client['id']}", "-r", REALM], {"enabled": False})


def schema(ops):
    require_staging()
    return ops.sql("""BEGIN READ ONLY;
SELECT json_build_object('columns',(SELECT json_agg(c) FROM (
 SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('organizations','organization_members','properties','reservations','interventions','guests')
 AND is_nullable='NO' ORDER BY table_name,ordinal_position) c),
 'indexes',(SELECT json_agg(i) FROM (SELECT tablename,indexname,indexdef FROM pg_indexes
 WHERE schemaname='public' AND tablename IN ('properties','reservations','interventions','guests') ORDER BY tablename,indexname) i));
COMMIT;
""")


def stats(ops):
    require_staging()
    database = ops.sql("""BEGIN READ ONLY;
SELECT json_build_object('connections',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()),
 'active',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND state='active'),
 'waiting',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'),
 'buffers',(SELECT json_build_object('read',blks_read,'hit',blks_hit,'deadlocks',deadlocks)
 FROM pg_stat_database WHERE datname=current_database()));
COMMIT;
""")
    containers = command(COMPOSE + ["ps", "-q", "pms-server", "postgres", "redis"]).splitlines()
    output = command(["docker", "stats", "--no-stream", "--format", "{{json .}}", *containers]) if containers else ""
    return {"timestamp": time.time(), "database": database, "containers": [
        {"cpu": row.get("CPUPerc"), "memory": row.get("MemUsage"), "memoryPercent": row.get("MemPerc")}
        for row in (json.loads(line) for line in output.splitlines())]}


def explain(ops, actors, start, end):
    require_staging()
    plans = []
    for count in (10, 100, 1000):
        actor = next(actor for actor in actors if len(actor["propertyIds"]) == count)
        slug = actor["clientId"]
        for batch, offset in enumerate(range(0, count, 500)):
            ids = actor["propertyIds"][offset:offset + 500]
            variables = {"slug": slug, "ids": ",".join(str(value) for value in ids), "from": start, "to": end}
            queries = {
                "reservations": """SELECT r.id,r.property_id,r.check_in,r.check_out,r.status,r.source,r.total_price
 FROM reservations r JOIN organizations o ON o.id=r.organization_id
 WHERE o.slug=:'slug' AND o.name=:'slug' AND r.property_id=ANY(string_to_array(:'ids',',')::bigint[])
 AND r.check_out>:'from'::date AND r.check_in<=:'to'::date AND (r.hidden_from_planning IS NULL OR r.hidden_from_planning=false)""",
                "interventions": """SELECT i.id,p.id,p.name,i.type,i.status,i.scheduled_date,i.estimated_duration_hours,
 u.first_name,u.last_name,t.name,s.reservation_id FROM interventions i
 JOIN organizations o ON o.id=i.organization_id JOIN properties p ON p.id=i.property_id AND p.organization_id=o.id
 LEFT JOIN users u ON u.id=i.assigned_user_id AND u.organization_id=o.id
 LEFT JOIN service_requests s ON s.id=i.service_request_id AND s.organization_id=o.id
 LEFT JOIN teams t ON t.id=i.team_id AND t.organization_id=o.id
 WHERE o.slug=:'slug' AND o.name=:'slug' AND p.id=ANY(string_to_array(:'ids',',')::bigint[])
 AND i.scheduled_date>=:'from'::date AND i.scheduled_date<=:'to'::date+TIME '23:59:59.999999'
 AND NOT EXISTS(SELECT 1 FROM reservations r WHERE r.intervention_id=i.id AND r.organization_id=o.id
 AND r.hidden_from_planning=true AND r.status='cancelled') ORDER BY i.scheduled_date""",
            }
            for label, query in queries.items():
                plan = ops.sql("BEGIN READ ONLY; SET LOCAL statement_timeout='15s';\n"
                        + "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + query + ";\nCOMMIT;\n", **variables)
                plans.append({"cohort": count, "batch": batch, "query": label, "plan": plan})
    return plans


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["schema", "provision", "explain", "stats", "disable"])
    parser.add_argument("--actors", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--accounts-per-cohort", type=int, default=4)
    parser.add_argument("--from-date", default="2026-10-01")
    parser.add_argument("--to-date", default="2026-10-31")
    args = parser.parse_args()
    require_staging()
    if not 1 <= args.accounts_per_cohort <= 10:
        raise FixtureError("1 à 10 comptes par cohorte autorisés")
    if args.action == "stats":
        print(json.dumps(stats(Staging())))
    elif args.action in {"schema", "explain"}:
        if not args.report:
            raise FixtureError("Rapport de mesures requis")
        values = schema(Staging()) if args.action == "schema" else explain(Staging(),
                json.loads(args.actors.read_text()), args.from_date, args.to_date)
        args.report.write_text(json.dumps(values, indent=2))
    elif args.action == "disable":
        disable(Staging(), args.accounts_per_cohort)
    else:
        if not args.actors:
            raise FixtureError("Fichier privé de comptes requis")
        values = provision(Staging(), args.accounts_per_cohort, args.from_date, args.to_date)
        descriptor = os.open(args.actors, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w") as output:
            json.dump(values, output)


if __name__ == "__main__":
    try:
        main()
    except FixtureError as error:
        raise SystemExit(str(error)) from None
