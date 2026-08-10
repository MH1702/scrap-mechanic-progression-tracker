import json
import os
import tempfile
import unittest
import zipfile

from progression_tracker import web_bundle


class WebBundleTests(unittest.TestCase):
    def test_bundle_contains_only_browser_decoder_modules(self):
        with tempfile.TemporaryDirectory() as folder:
            path = os.path.join(folder, "progression-tracker.zip")
            web_bundle.build(path)
            with zipfile.ZipFile(path) as archive:
                expected = [
                    "smmap/" + name for name in web_bundle.UPSTREAM_MODULES
                ] + [
                    "progression_tracker/" + name
                    for name in web_bundle.APP_MODULES
                ]
                self.assertEqual(sorted(archive.namelist()), sorted(expected))
                self.assertNotIn("smmap/render.py", archive.namelist())


if __name__ == "__main__":
    unittest.main()
