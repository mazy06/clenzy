#!/usr/bin/env python3
"""
Local development seed for the Baitly mobile app (never run against staging or production).

Creates, through the local API, one concierge (with a housekeeper and a technician) and one
independent owner, their homes and reservations, then clones existing interventions in the LOCAL
database to cover the states the app must show: to pay, running, awaiting review.

Idempotent: accounts and data are only created when missing. Credentials are written to
dev-test-accounts.json next to this script (git-ignored).

Usage: python3 mobile/scripts/seed-dev.py   (admin credentials: realm seed admin/admin)
"""
import hashlib, json, os, secrets, subprocess, sys, urllib.error, urllib.parse, urllib.request
from datetime import date, timedelta

API = os.environ.get('BAITLY_API', 'http://localhost:8084/api')
KEYCLOAK = os.environ.get('BAITLY_KEYCLOAK', 'http://localhost:8086/realms/clenzy/protocol/openid-connect/token')
PG = ['docker', 'exec', '-i', 'clenzy-postgres-dev', 'psql', '-U', 'clenzy', '-d', 'clenzy_dev', '-Atq', '-v', 'ON_ERROR_STOP=1']
HERE = os.path.dirname(os.path.abspath(__file__))
ACCOUNTS = os.path.join(HERE, 'dev-test-accounts.json')
if not API.startswith('http://localhost'):
    sys.exit('Refusing to seed anything but a localhost API.')


def http(method, path, token=None, body=None, form=None):
    data = urllib.parse.urlencode(form).encode() if form else json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(path if path.startswith('http') else API + path, data=data, method=method)
    req.add_header('Content-Type', 'application/x-www-form-urlencoded' if form else 'application/json')
    if token: req.add_header('Authorization', 'Bearer ' + token)
    try:
        with urllib.request.urlopen(req, timeout=180) as res:
            raw = res.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'{method} {path} -> {e.code}: {e.read().decode()[:300]}')


def token(username, password):
    return http('POST', KEYCLOAK, form={'grant_type': 'password', 'client_id': 'clenzy-web', 'username': username, 'password': password})['access_token']


def sql(query):
    return subprocess.run(PG, input=query, capture_output=True, text=True, check=True).stdout.strip()


accounts = json.load(open(ACCOUNTS)) if os.path.exists(ACCOUNTS) else {
    'password': 'Baitly-' + secrets.token_urlsafe(9) + '-9a',
    'accounts': {
        'concierge': {'email': 'conciergerie@baitly.test', 'firstName': 'Nadia', 'lastName': 'Test', 'role': 'HOST', 'org': 'Conciergerie Atlas (test)', 'orgType': 'CONCIERGE', 'orgRole': 'OWNER'},
        'owner': {'email': 'proprietaire@baitly.test', 'firstName': 'Sami', 'lastName': 'Test', 'role': 'HOST', 'org': 'Logements de Sami (test)', 'orgType': 'INDIVIDUAL', 'orgRole': 'OWNER'},
        'housekeeper': {'email': 'menage@baitly.test', 'firstName': 'Salma', 'lastName': 'Test', 'role': 'HOUSEKEEPER', 'org': 'Conciergerie Atlas (test)', 'orgRole': 'HOUSEKEEPER'},
        'technician': {'email': 'technicien@baitly.test', 'firstName': 'Amine', 'lastName': 'Test', 'role': 'TECHNICIAN', 'org': 'Conciergerie Atlas (test)', 'orgRole': 'TECHNICIAN'},
    },
}
password = accounts['password']
admin = token('admin', 'admin')

# 1. Organisations and accounts
orgs = {}
for key, acc in accounts['accounts'].items():
    if acc['org'] not in orgs:
        found = sql(f"select id from organizations where name = '{acc['org']}' limit 1")
        orgs[acc['org']] = int(found) if found else http('POST', '/organizations', admin, {'name': acc['org'], 'type': acc.get('orgType', 'INDIVIDUAL')})['id']
    org_id = orgs[acc['org']]
    # Emails are encrypted at rest: users are found by the same hash the server computes.
    email_hash = hashlib.sha256(acc['email'].strip().lower().encode()).hexdigest()
    user_id = sql(f"select id from users where email_hash = '{email_hash}'")
    if not user_id:
        user_id = http('POST', '/users', admin, {'email': acc['email'], 'firstName': acc['firstName'], 'lastName': acc['lastName'],
                                                 'password': password, 'role': acc['role'], 'status': 'ACTIVE'})['id']
    user_id = int(user_id)
    if sql(f"select organization_id from users where id = {user_id}") != str(org_id):
        http('POST', f'/organizations/{org_id}/members', admin, {'userId': user_id, 'role': acc['orgRole']})
        # The admin creates users in its own organisation first: keep only the intended membership.
        sql(f"delete from organization_members where user_id = {user_id} and organization_id <> {org_id};")
    acc.update(id=user_id, organizationId=org_id)
json.dump(accounts, open(ACCOUNTS, 'w'), indent=2, ensure_ascii=False)
# Field workers declare the services they deliver: submitting a mission requires that capability.
CAPABILITIES = {'housekeeper': ['cleaning-turnover'], 'technician': ['maintenance-hvac', 'maintenance-plumbing']}
for key, codes in CAPABILITIES.items():
    http('PUT', '/my-service-capabilities', token(accounts['accounts'][key]['email'], password), codes)
print('accounts ready:', {k: v['id'] for k, v in accounts['accounts'].items()})

# 2. Homes, created by their manager
HOMES = {
    'owner': [('Appartement Gueliz (test)', 'APARTMENT', 'Marrakech', '12 rue de la Liberte', 2, 1, 4, 90)],
    'concierge': [('Riad Mouassine (test)', 'RIAD', 'Marrakech', '7 derb Mouassine', 4, 3, 8, 220),
                  ('Villa Palmeraie (test)', 'VILLA', 'Marrakech', 'Route de Fes km 6', 5, 4, 10, 450)],
}
homes = {}
for key, items in HOMES.items():
    acc = accounts['accounts'][key]
    tok = token(acc['email'], password)
    for name, kind, city, address, bedrooms, bathrooms, guests, price in items:
        pid = sql(f"select id from properties where name = '{name}' and organization_id = {acc['organizationId']}")
        if not pid:
            pid = http('POST', '/properties', tok, {'name': name, 'type': kind, 'city': city, 'address': address, 'country': 'Maroc',
                       'countryCode': 'MA', 'postalCode': '40000', 'bedroomCount': bedrooms, 'bathroomCount': bathrooms,
                       'maxGuests': guests, 'nightlyPrice': price, 'defaultCurrency': 'EUR', 'ownerId': acc['id'], 'status': 'ACTIVE',
                       # Morocco requires the tourist tax to be declared when a home is created.
                       'touristTax': {'confirmed': True, 'noTax': False, 'calculationMode': 'PER_PERSON_PER_NIGHT', 'ratePerPerson': 2.5}})['id']
        homes[name] = (int(pid), key)
print('homes ready:', homes)

# 3. Reservations around today: arrivals, stays and departures make the calendar readable
today = date.today()
for i, (name, (pid, key)) in enumerate(homes.items()):
    tok = token(accounts['accounts'][key]['email'], password)
    if sql(f"select count(*) from reservations where property_id = {pid}") != '0':
        continue
    for start, nights, guest in [(-2, 3, 'Lucas Martin'), (3 + i, 4, 'Emma Bernard'), (10 + i, 2, 'Youssef Amrani')]:
        ci = today + timedelta(days=start)
        http('POST', '/reservations', tok, {'propertyId': pid, 'guestName': guest, 'guestCount': 2,
             'checkIn': ci.isoformat(), 'checkOut': (ci + timedelta(days=nights)).isoformat(),
             'checkInTime': '15:00', 'checkOutTime': '11:00', 'status': 'confirmed', 'totalPrice': 120.0 * nights})
print('reservations ready')

# 4. Interventions: clone a valid existing row, then set the fields each test state needs (local DB only)
template = sql("select id from interventions order by id limit 1")
columns = sql("select string_agg(quote_ident(column_name), ',' order by ordinal_position) from information_schema.columns "
              "where table_name = 'interventions' and column_name <> 'id'")
hk, tech, own, conc = (accounts['accounts'][k] for k in ('housekeeper', 'technician', 'owner', 'concierge'))
riad, villa, gueliz = homes['Riad Mouassine (test)'][0], homes['Villa Palmeraie (test)'][0], homes['Appartement Gueliz (test)'][0]
MISSIONS = [
    # title, type, service item, property, org, requestor, assignee, status, payment, cost, day offset
    ('Menage de depart Riad (test)', 'CLEANING', 'cleaning-turnover', riad, conc, conc, hk, 'IN_PROGRESS', 'PENDING', 60, 0),
    ('Menage avant arrivee Villa (test)', 'CLEANING', 'cleaning-turnover', villa, conc, conc, hk, 'PENDING', 'PENDING', 90, 1),
    ('Reparation climatisation Riad (test)', 'MAINTENANCE', 'maintenance-hvac', riad, conc, conc, tech, 'IN_PROGRESS', 'PENDING', 140, 0),
    ('Fuite salle de bain Villa (test)', 'MAINTENANCE', 'maintenance-plumbing', villa, conc, conc, tech, 'PENDING', 'PENDING', 110, 2),
    ('Menage Gueliz a valider (test)', 'CLEANING', 'cleaning-turnover', gueliz, own, own, None, 'AWAITING_VALIDATION', 'PENDING', 45, -1),
    ('Menage Gueliz a payer (test)', 'CLEANING', 'cleaning-turnover', gueliz, own, own, None, 'PENDING', 'PENDING', 55, 3),
]
for title, kind, item, pid, org, req, assignee, status, pay, cost, offset in MISSIONS:
    if sql(f"select count(*) from interventions where title = '{title}'") != '0':
        continue
    when = (today + timedelta(days=offset)).isoformat()
    new_id = sql(f"insert into interventions ({columns}) select {columns} from interventions where id = {template} returning id;").splitlines()[0]
    started = f"'{when} 09:00'" if status != 'PENDING' else f"'{when} 10:00'"
    sql(f"""update interventions set title = '{title}', description = 'Intervention de test seed-dev.', type = '{kind}',
        property_id = {pid}, organization_id = {org['organizationId']}, requestor_id = {req['id']},
        assigned_user_id = {assignee['id'] if assignee else 'null'}, assigned_technician_id = null, team_id = null,
        status = '{status}', payment_status = '{pay}', estimated_cost = {cost}, actual_cost = null, currency = 'EUR',
        scheduled_date = '{when}', start_time = {started}, end_time = {"'" + when + " 11:00'" if status == 'AWAITING_VALIDATION' else 'null'},
        assignment_response = {"'ACCEPTED'" if assignee else 'null'}, completed_steps = null, notes = null, technician_notes = null,
        materials_used = null, stripe_session_id = null, stripe_payment_intent_id = null, paid_at = null, completed_at = null,
        service_request_id = null, initial_acceptance_request_id = null, service_item_code = '{item}', baitly_paused_at = null, baitly_pause_seconds = 0,
        baitly_signature_status = null, baitly_signer_name = null, baitly_signed_at = null, validated_rooms = null,
        progress_percentage = 0, version = 0, created_at = now(), updated_at = now() where id = {new_id};""")
print('interventions ready')
print(f'Accounts and password: {ACCOUNTS}')
