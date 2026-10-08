import tempfile
import unittest
from pathlib import Path

import check_imports


def write(root: Path, rel: str, text: str = ""):
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


class CheckImportsTest(unittest.TestCase):
    def run_check(self, files):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for rel, text in files.items():
                write(root, rel, text)
            return check_imports.check(root)

    def test_resolved_imports_pass(self):
        total, broken = self.run_check({
            "client/src/A.tsx": "import './a.css';\nimport { b } from './b';\nimport x from './sub';\n",
            "client/src/a.css": "@import './c.css';\n.a { background: url('./i.svg'); }",
            "client/src/c.css": "", "client/src/i.svg": "<svg/>", "client/src/b.ts": "export const b = 1;",
            "client/src/sub/index.ts": "export default 1;",
        })
        self.assertEqual(broken, [])
        self.assertGreaterEqual(total, 5)

    def test_deleted_css_is_reported(self):
        # Cas d'origine : documentStatusIcon.css supprimé alors que le composant l'importe encore.
        _, broken = self.run_check({"client/src/modules/DocumentStatusIcon.tsx": "import './documentStatusIcon.css';\n"})
        self.assertEqual(broken, [("client/src/modules/DocumentStatusIcon.tsx", "./documentStatusIcon.css")])

    def test_mobile_aliases_are_checked(self):
        _, broken = self.run_check({
            "mobile/src/Screen.tsx": "import { A } from '@shared/types/a';\nimport { B } from '@/api/b';\n",
            "shared/src/types/a.ts": "export const A = 1;",
        })
        self.assertEqual(broken, [("mobile/src/Screen.tsx", "@/api/b")])

    def test_mock_dynamic_and_require_are_checked(self):
        _, broken = self.run_check({"client/src/T.test.ts": "vi.mock('./gone');\nconst m = await import('./gone2');\nconst r = require('./gone3');\n"})
        self.assertEqual([spec for _, spec in broken], ["./gone", "./gone2", "./gone3"])

    def test_packages_urls_and_node_modules_are_ignored(self):
        total, broken = self.run_check({
            "client/src/A.tsx": "import React from 'react';\nimport 'https://x.test/a.css';\n",
            "client/src/node_modules/p/i.js": "import './missing';\n",
        })
        self.assertEqual(broken, [])


if __name__ == "__main__":
    unittest.main()
