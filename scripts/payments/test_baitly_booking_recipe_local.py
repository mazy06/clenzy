import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path
from baitly_booking_recipe_local import check_artifact, check_target, recipe_mount, INFRA, ARTIFACT
from stripe_sandbox_local import require_recreation_safe

class BookingRecipeGuardsTest(unittest.TestCase):
    def target(self):
        return {'Name': '/clenzy-server-dev', 'Config': {'Labels': {
            'com.docker.compose.project': 'clenzy-infra',
            'com.docker.compose.service': 'pms-server',
            'com.docker.compose.project.working_dir': str(INFRA)}}}

    def test_only_local_development_target_is_accepted(self):
        check_target(self.target())
        target = self.target()
        target['Name'] = '/clenzy-server-prod'
        with self.assertRaisesRegex(ValueError, 'LOCAL_DEVELOPMENT_TARGET_REQUIRED'):
            check_target(target)

    def test_foreign_compose_project_is_rejected(self):
        target = self.target()
        target['Config']['Labels']['com.docker.compose.project.working_dir'] = '/tmp/other-project'
        with self.assertRaisesRegex(ValueError, 'LOCAL_DEVELOPMENT_TARGET_REQUIRED'):
            check_target(target)

    def test_unverified_artifact_cannot_be_loaded(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / 'changed.jar'
            artifact.write_bytes(b'unverified build')
            with self.assertRaisesRegex(ValueError, 'TESTED_ARTIFACT_MISMATCH'):
                check_artifact(artifact)

    def test_verified_artifact_uses_portable_streaming_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / 'tested.jar'
            artifact.write_bytes(b'abc')
            with patch('baitly_booking_recipe_local.EXPECTED_SHA256',
                    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'):
                check_artifact(artifact)

    def test_recreation_cannot_discard_custom_config_or_jar(self):
        for change in ['C /app/app.jar', 'A /app/config/application-dev.yml']:
            with self.assertRaisesRegex(ValueError, 'LOCAL_ARTIFACT_REQUIRES_PRESERVED_RELOAD'):
                require_recreation_safe(change)

    def test_desktop_translation_preserves_exact_read_only_artifact(self):
        for source in [str(ARTIFACT), '/host_mnt' + str(ARTIFACT)]:
            self.assertTrue(recipe_mount({'Mounts': [{'Type': 'bind', 'Source': source,
                'Destination': '/app/app.jar', 'RW': False}]}))

    def test_wrong_or_writable_artifact_is_rejected(self):
        for source, writable in [(str(ARTIFACT), True), ('/tmp/other.jar', False)]:
            self.assertFalse(recipe_mount({'Mounts': [{'Type': 'bind', 'Source': source,
                'Destination': '/app/app.jar', 'RW': writable}]}))

if __name__ == '__main__':
    unittest.main()
