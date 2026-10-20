#!/usr/bin/env python3
"""Charge une recette locale vérifiée ; --apply est réservé à l'opérateur humain.

Sans --apply : contrôles uniquement. Aucun secret n'est affiché.
La seule cible modifiable est le service local pms-server ; aucune image reconstruite.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess

from stripe_sandbox_local import private_configuration, require_recreation_safe

ROOT = Path(__file__).resolve().parents[2]
INFRA = ROOT.parent / 'clenzy-infra'
ARTIFACT = ROOT / 'tmp/baitly-booking-recipe/backend-other-services-tested.jar'
EXPECTED_SHA256 = '981da319f2a69e2ffedf4927a05c1f0135b4c174e38ef22338e5caeb203c6525'

def require(condition, message):
    if not condition:
        raise ValueError(message)

def check_artifact(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    require(digest.hexdigest() == EXPECTED_SHA256, 'TESTED_ARTIFACT_MISMATCH')

def check_target(container):
    labels = container['Config']['Labels']
    require(container['Name'] == '/clenzy-server-dev'
            and labels.get('com.docker.compose.project') == 'clenzy-infra'
            and labels.get('com.docker.compose.service') == 'pms-server'
            and Path(labels.get('com.docker.compose.project.working_dir', '')) == INFRA,
            'LOCAL_DEVELOPMENT_TARGET_REQUIRED')

def recipe_mount(container):
    # Docker Desktop traduit le chemin macOS dans sa VM Linux.
    sources = {str(ARTIFACT), '/host_mnt' + str(ARTIFACT)}
    return any(m.get('Type') == 'bind' and m.get('Destination') == '/app/app.jar'
        and m.get('Source') in sources and m.get('RW') is False for m in container['Mounts'])

def docker(arguments, environment):
    result = subprocess.run(['docker', *arguments], env=environment,
        capture_output=True, text=True, timeout=180)
    require(result.returncode == 0, 'DOCKER_COMMAND_FAILED')
    return result.stdout

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Opérateur : charger le JAR testé et la configuration sandbox.')
    args = parser.parse_args()
    check_artifact(ARTIFACT)
    private = private_configuration(ROOT / '.env.baitly-stripe.local')
    environment = {**os.environ, **private, 'BAITLY_BOOKING_RECIPE_JAR': str(ARTIFACT)}
    current = json.loads(docker(['inspect', 'clenzy-server-dev'], environment))[0]
    check_target(current)
    compose = ['compose', '--project-directory', str(INFRA), '--project-name', 'clenzy-infra',
        '--env-file', str(INFRA / '.env.dev'), '--env-file', str(ROOT / '.env.baitly-stripe.local'),
        '-f', str(INFRA / 'docker-compose.dev.yml'),
        '-f', str(ROOT / 'scripts/payments/docker-compose.baitly-booking-recipe.yml')]
    desired = json.loads(docker([*compose, 'config', '--format', 'json'], environment))['services']['pms-server']
    require(desired['container_name'] == 'clenzy-server-dev'
            and desired['environment'].get('SPRING_PROFILES_ACTIVE') == 'dev'
            and str(desired['environment'].get('CLENZY_BOOKING_ALLOW_LOCAL_RETURN')).lower() == 'true'
            and all(desired['environment'].get(k) == v for k, v in private.items()),
            'DEVELOPMENT_SANDBOX_CONFIGURATION_REQUIRED')
    image = desired.get('image') or 'clenzy-infra-pms-server'
    image_id = json.loads(docker(['image', 'inspect', image], environment))[0]['Id']
    require(image_id == current['Image'], 'IMAGE_CHANGED_REVIEW_REQUIRED')
    active = dict(entry.split('=', 1) for entry in current['Config']['Env'] if '=' in entry)
    matches = recipe_mount(current) and active.get('CLENZY_BOOKING_ALLOW_LOCAL_RETURN') == 'true' and all(active.get(k) == v for k, v in private.items())
    print(json.dumps({'tested_jar_verified': True, 'sandbox_configuration_verified': True,
        'active_matches_recipe': matches, 'read_only': not args.apply}), flush=True)
    if not args.apply:
        return
    if not matches:
        require_recreation_safe(docker(['diff', 'clenzy-server-dev'], environment))
        docker([*compose, 'up', '-d', '--no-deps', '--no-build', '--pull', 'never', 'pms-server'], environment)
    after = json.loads(docker(['inspect', 'clenzy-server-dev'], environment))[0]
    check_target(after)
    active = dict(entry.split('=', 1) for entry in after['Config']['Env'] if '=' in entry)
    require(after['Image'] == image_id and recipe_mount(after) and active.get('CLENZY_BOOKING_ALLOW_LOCAL_RETURN') == 'true'
            and all(active.get(k) == v for k, v in private.items()),
            'POST_RELOAD_VERIFICATION_FAILED')
    print('JAR testé et Stripe sandbox chargés ensemble. Laisser le backend terminer son démarrage.')

if __name__ == '__main__':
    try:
        main()
    except ValueError as error:
        raise SystemExit(str(error)) from None
    except (OSError, subprocess.TimeoutExpired, KeyError, IndexError):
        raise SystemExit('LOCAL_RECIPE_CHECK_FAILED') from None
