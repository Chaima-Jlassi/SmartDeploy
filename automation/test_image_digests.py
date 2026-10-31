import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from automation import image_digests
from automation.image_digests import replace_digest


class ImageDigestTests(unittest.TestCase):
    def test_digest_is_updated(self):
        digest = f"sha256:{'a' * 64}"
        updated = replace_digest('image:\n  digest: ""\n', digest)
        self.assertIn(f'digest: "{digest}"', updated)

    def test_invalid_digest_is_rejected(self):
        with self.assertRaises(ValueError):
            replace_digest('image:\n  digest: ""\n', "latest")

    def test_rollback_restores_previous_digest(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            values = root / "helm" / "values-product-catalog-dev.yaml"
            values.parent.mkdir()
            values.write_text('image:\n  digest: "sha256:' + "a" * 64 + '"\n', encoding="utf-8")
            self.initialize_git(root)
            self.commit_values(root, values, "initial digest")
            values.write_text('image:\n  digest: "sha256:' + "b" * 64 + '"\n', encoding="utf-8")
            self.commit_values(root, values, "release digest")

            with patch.object(image_digests, "ROOT", root):
                image_digests.rollback("product-catalog", "dev")

            self.assertIn("sha256:" + "a" * 64, values.read_text(encoding="utf-8"))

    def test_merged_rollback_commit_is_idempotent(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            values = root / "helm" / "values-product-catalog-prod.yaml"
            values.parent.mkdir()
            previous_digest = "sha256:" + "a" * 64
            deployed_digest = "sha256:" + "b" * 64
            values.write_text(f'image:\n  digest: "{previous_digest}"\n', encoding="utf-8")
            self.initialize_git(root)
            self.commit_values(root, values, "initial digest")
            values.write_text(f'image:\n  digest: "{deployed_digest}"\n', encoding="utf-8")
            self.commit_values(root, values, "promoted digest")
            values.write_text(f'image:\n  digest: "{previous_digest}"\n', encoding="utf-8")
            self.commit_values(
                root,
                values,
                "Merge pull request #4 from owner/rollback/product-catalog-prod",
            )

            with patch.object(image_digests, "ROOT", root):
                image_digests.rollback("product-catalog", "prod")

            self.assertIn(previous_digest, values.read_text(encoding="utf-8"))

    @staticmethod
    def initialize_git(root):
        subprocess.run(["git", "init"], cwd=root, check=True, capture_output=True)
        subprocess.run(["git", "config", "user.name", "Test"], cwd=root, check=True)
        subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=root, check=True)

    @staticmethod
    def commit_values(root, values, subject):
        subprocess.run(["git", "add", str(values)], cwd=root, check=True)
        subprocess.run(["git", "commit", "-m", subject], cwd=root, check=True, capture_output=True)


if __name__ == "__main__":
    unittest.main()
