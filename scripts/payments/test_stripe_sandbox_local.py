"""Garde-fous du rechargement local : aucun appel Docker réel dans ces tests."""
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import stripe_sandbox_local as local


class LocalSandboxTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name) / "clenzy"
        self.root.mkdir()
        self.infra = self.root.parent / "clenzy-infra"
        self.prepared = {
            "STRIPE_SECRET_KEY": "sk_test_Fixture",
            "STRIPE_PUBLISHABLE_KEY": "pk_test_Fixture",
            "STRIPE_WEBHOOK_SECRET": "whsec_Fixture",
            "STRIPE_CONNECT_CLIENT_ID": "ca_Fixture",
        }
        self.env_file = self.root / ".env.baitly-stripe.local"
        self.env_file.write_text("\n".join(k + "=" + v for k, v in self.prepared.items()))
        self.current = {
            "Image": "sha256:tested-image",
            "Config": {
                "Labels": {
                    "com.docker.compose.project": "clenzy-infra",
                    "com.docker.compose.service": "pms-server",
                    "com.docker.compose.project.working_dir": str(self.infra),
                },
                "Env": [],
            },
            "Mounts": [],
        }
        self.desired = {"services": {"pms-server": {
            "container_name": "clenzy-server-dev",
            "environment": self.prepared,
            "volumes": [],
        }}}
        self.calls = []
        self.image = "sha256:tested-image"
        self.changes = "C /tmp\nA /tmp/runtime.log\n"

    def docker(self, args, environment):
        self.calls.append(args)
        self.assertTrue(all(environment[k] == v for k, v in self.prepared.items()))
        if args[0] == "inspect":
            return json.dumps([self.current])
        if args[:2] == ["image", "inspect"]:
            return json.dumps([{"Id": self.image}])
        if args[0] == "diff":
            return self.changes
        if "config" in args:
            return json.dumps(self.desired)
        if "up" in args:
            self.current["Config"]["Env"] = [k + "=" + v for k, v in self.prepared.items()]
            return ""
        self.fail("Commande Docker inattendue")

    def run_command(self, *args):
        with patch.object(local, "ROOT", self.root), patch.object(local, "INFRA", self.infra), \
                patch.object(local, "docker", self.docker), patch("sys.argv", ["script", *args]), \
                contextlib.redirect_stdout(io.StringIO()) as output:
            local.main()
        self.assertNotIn("sk_test_Fixture", output.getvalue())

    def test_default_never_reloads(self):
        self.run_command()
        self.assertFalse(any("up" in args for args in self.calls))

    def test_explicit_reload_only_changes_server_without_build_or_pull(self):
        self.run_command("--reload-server")
        mutations = [args for args in self.calls if "up" in args]
        self.assertEqual(len(mutations), 1)
        self.assertEqual(mutations[0][mutations[0].index("up"):],
                         ["up", "-d", "--no-deps", "--no-build", "--pull", "never", "pms-server"])

    def test_current_configuration_does_not_restart_again(self):
        self.current["Config"]["Env"] = [k + "=" + v for k, v in self.prepared.items()]
        self.run_command("--reload-server")
        self.assertFalse(any("up" in args for args in self.calls))

    def test_live_key_refused_before_docker(self):
        self.env_file.write_text(self.env_file.read_text().replace("sk_test_", "sk_live_"))
        with self.assertRaisesRegex(ValueError, "TEST_CONFIGURATION_REQUIRED"):
            self.run_command("--reload-server")
        self.assertEqual(self.calls, [])

    def test_different_image_refused_before_recreation(self):
        self.image = "sha256:not-the-tested-image"
        with self.assertRaisesRegex(ValueError, "IMAGE_CHANGED_REVIEW_REQUIRED"):
            self.run_command("--reload-server")
        self.assertFalse(any("up" in args for args in self.calls))

    def test_existing_jar_mount_is_not_silently_removed(self):
        self.current["Mounts"] = [{"Destination": "/app/app.jar"}]
        with self.assertRaisesRegex(ValueError, "IMAGE_JAR_REQUIRED"):
            self.run_command("--reload-server")
        self.assertFalse(any("up" in args for args in self.calls))

    def test_foreign_project_refused(self):
        self.current["Config"]["Labels"]["com.docker.compose.project"] = "production"
        with self.assertRaisesRegex(ValueError, "LOCAL_COMPOSE_REQUIRED"):
            self.run_command("--reload-server")
        self.assertFalse(any("up" in args for args in self.calls))

    def test_copied_jar_or_configuration_are_not_discarded_by_recreation(self):
        for change in ["C /app/app.jar", "A /app/config", "A /app/config/application.properties",
                       "D /app/config/application.yml"]:
            with self.subTest(change=change):
                self.calls.clear()
                self.changes = change
                with self.assertRaisesRegex(ValueError, "LOCAL_ARTIFACT_REQUIRES_PRESERVED_RELOAD"):
                    self.run_command("--reload-server")
                self.assertFalse(any("up" in args for args in self.calls))

    def test_installed_jar_does_not_prevent_read_only_or_noop(self):
        self.changes = "C /app/app.jar"
        self.run_command()
        self.current["Config"]["Env"] = [k + "=" + v for k, v in self.prepared.items()]
        self.run_command("--reload-server")
        self.assertFalse(any(args[0] == "diff" or "up" in args for args in self.calls))

    def test_unreadable_container_diff_blocks_recreation(self):
        self.changes = "unexpected"
        with self.assertRaisesRegex(ValueError, "INVALID_CONTAINER_DIFF"):
            self.run_command("--reload-server")
        self.assertFalse(any("up" in args for args in self.calls))


if __name__ == "__main__":
    unittest.main()
