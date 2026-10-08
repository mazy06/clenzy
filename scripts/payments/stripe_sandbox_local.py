#!/usr/bin/env python3
"""Contrôle local Baitly ; rechargement du serveur seulement sur demande explicite.

Par défaut : lecture seule. --reload-server est destiné à l'opérateur local.
Ni reconstruction d'image, ni remplacement de JAR, ni affichage de secrets.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shlex
import subprocess


ROOT = Path(__file__).resolve().parents[2]
INFRA = ROOT.parent / "clenzy-infra"
FIELDS = {
    "STRIPE_SECRET_KEY": r"(?:sk|rk)_test_[A-Za-z0-9]+",
    "STRIPE_PUBLISHABLE_KEY": r"pk_test_[A-Za-z0-9]+",
    "STRIPE_WEBHOOK_SECRET": r"whsec_[A-Za-z0-9]+",
    "STRIPE_CONNECT_CLIENT_ID": r"ca_[A-Za-z0-9]+",
}


def require(condition, code):
    if not condition:
        raise ValueError(code)


def private_configuration(path):
    values = {}
    for line in path.read_text().splitlines():
        line = line.strip().removeprefix("export ")
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() in FIELDS:
            parts = shlex.split(value, comments=True)
            require(len(parts) == 1, "INVALID_PRIVATE_CONFIGURATION")
            values[name.strip()] = parts[0]
    for name, pattern in FIELDS.items():
        require(bool(re.fullmatch(pattern, values.get(name, ""))), "TEST_CONFIGURATION_REQUIRED")
    return values


def docker(args, environment):
    result = subprocess.run(["rtk", "proxy", "docker", *args], env=environment,
                            capture_output=True, text=True, timeout=180)
    # Docker peut citer des variables dans ses diagnostics : ne pas les réimprimer.
    require(result.returncode == 0, "DOCKER_COMMAND_FAILED")
    return result.stdout


def require_recreation_safe(changes):
    # Compose conserve l'image, mais détruit les fichiers installés ensuite dans
    # le conteneur. Ne pas perdre un JAR testé ou une configuration de recette.
    for line in changes.splitlines():
        parts = line.split(maxsplit=1)
        require(len(parts) == 2 and parts[0] in {"A", "C", "D"}, "INVALID_CONTAINER_DIFF")
        path = parts[1]
        require(path != "/app/app.jar" and path != "/app/config"
                and not path.startswith("/app/config/"), "LOCAL_ARTIFACT_REQUIRES_PRESERVED_RELOAD")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reload-server", action="store_true",
                        help="Recréer uniquement le serveur local avec la configuration sandbox préparée.")
    args = parser.parse_args()
    prepared = private_configuration(ROOT / ".env.baitly-stripe.local")
    # L'environnement du shell a priorité sur --env-file dans Compose.
    # Les quatre valeurs explicitement préparées doivent donc aussi le remplacer.
    environment = {**os.environ, **prepared}
    current = json.loads(docker(["inspect", "clenzy-server-dev"], environment))[0]
    labels = current["Config"]["Labels"]
    require(labels.get("com.docker.compose.project") == "clenzy-infra"
            and labels.get("com.docker.compose.service") == "pms-server"
            and Path(labels.get("com.docker.compose.project.working_dir", "")) == INFRA,
            "LOCAL_COMPOSE_REQUIRED")
    require(not any(mount["Destination"] == "/app/app.jar" for mount in current["Mounts"]),
            "IMAGE_JAR_REQUIRED_USE_EXISTING_MOUNT_WORKFLOW")
    compose = ["compose", "--project-directory", str(INFRA), "--project-name", "clenzy-infra",
               "--env-file", str(INFRA / ".env.dev"),
               "--env-file", str(ROOT / ".env.baitly-stripe.local"),
               "-f", str(INFRA / "docker-compose.dev.yml"),
               "-f", str(ROOT / "scripts/payments/docker-compose.stripe-sandbox-env.yml")]
    desired = json.loads(docker([*compose, "config", "--format", "json"], environment))
    server = desired["services"]["pms-server"]
    require(all(server["environment"].get(k) == v for k, v in prepared.items()),
            "COMPOSE_CONFIGURATION_MISMATCH")
    require(server.get("container_name") == "clenzy-server-dev"
            and not any(m.get("target") == "/app/app.jar" for m in server.get("volumes", [])),
            "IMAGE_JAR_REQUIRED")
    image = server.get("image") or "clenzy-infra-pms-server"
    image_id = json.loads(docker(["image", "inspect", image], environment))[0]["Id"]
    require(image_id == current["Image"], "IMAGE_CHANGED_REVIEW_REQUIRED")
    active = dict(entry.split("=", 1) for entry in current["Config"]["Env"] if "=" in entry)
    matches = all(active.get(k) == v for k, v in prepared.items())
    print("Configuration préparée valide ; image actuelle conservée. Aucun secret affiché.", flush=True)
    if not args.reload_server:
        print("Lecture seule : aucun conteneur modifié. Configuration active "
              + ("conforme." if matches else "à recharger avec --reload-server."))
        return
    if not matches:
        require_recreation_safe(docker(["diff", "clenzy-server-dev"], environment))
        docker([*compose, "up", "-d", "--no-deps", "--no-build", "--pull", "never", "pms-server"], environment)
    after = json.loads(docker(["inspect", "clenzy-server-dev"], environment))[0]
    after_env = dict(entry.split("=", 1) for entry in after["Config"]["Env"] if "=" in entry)
    require(after["Image"] == current["Image"] and all(after_env.get(k) == v for k, v in prepared.items()),
            "POST_RELOAD_VERIFICATION_FAILED")
    print("Configuration Stripe Baitly chargée. Frontend et autres conteneurs inchangés.")
    print("Laissez le serveur terminer son démarrage, puis signalez-le dans Codex.")


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        raise SystemExit(str(error)) from None
    except (OSError, subprocess.TimeoutExpired, KeyError, IndexError):
        raise SystemExit("LOCAL_CONFIGURATION_CHECK_FAILED") from None
