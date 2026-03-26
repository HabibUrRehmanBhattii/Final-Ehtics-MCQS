import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_text(rel_path: str) -> str:
    return (ROOT / rel_path).read_text(encoding="utf-8")


def read_json(rel_path: str):
    return json.loads(read_text(rel_path))


def topic_projection(payload):
    topics = payload.get("topics", [])
    projected = []
    for topic in topics:
        tests = topic.get("practiceTests", [])
        projected_tests = [
            (
                test.get("id"),
                test.get("questionCount"),
                test.get("dataFile"),
            )
            for test in tests
        ]
        projected.append(
            (
                topic.get("id"),
                topic.get("status"),
                tuple(projected_tests),
            )
        )
    return projected


class RepoConsistencyTests(unittest.TestCase):
    def test_topics_files_are_aligned(self):
        primary = read_json("data/topics.json")
        mirror = read_json("data/topics-updated.json")
        self.assertEqual(
            topic_projection(primary),
            topic_projection(mirror),
            "topics.json and topics-updated.json are out of sync",
        )

    def test_index_local_asset_versions_match_app_build_version(self):
        index_html = read_text("index.html")
        app_js = read_text("js/app.js")

        build_match = re.search(r"appBuildVersion:\s*'([^']+)'", app_js)
        self.assertIsNotNone(build_match, "appBuildVersion not found in js/app.js")
        app_build_version = build_match.group(1)

        local_version_tags = re.findall(
            r"""(?:href|src)=\"((?:manifest\.webmanifest|css/[^\"]+|js/[^\"]+)\?v=([^\"]+))\" """,
            index_html,
            flags=re.VERBOSE,
        )
        self.assertTrue(local_version_tags, "No local ?v= tags found in index.html")

        mismatches = []
        for _, version in local_version_tags:
            if version != app_build_version:
                mismatches.append(version)

        self.assertFalse(
            mismatches,
            f"Local asset version tags in index.html do not match appBuildVersion={app_build_version}: {mismatches}",
        )

    def test_cache_version_matches_service_worker(self):
        app_js = read_text("js/app.js")
        sw_js = read_text("sw.js")

        app_cache_match = re.search(r"cacheVersion:\s*'([^']+)'", app_js)
        sw_cache_match = re.search(r"const\s+CACHE_VERSION\s*=\s*'([^']+)'", sw_js)

        self.assertIsNotNone(app_cache_match, "cacheVersion not found in js/app.js")
        self.assertIsNotNone(sw_cache_match, "CACHE_VERSION not found in sw.js")

        self.assertEqual(
            app_cache_match.group(1),
            sw_cache_match.group(1),
            "cacheVersion in js/app.js must match CACHE_VERSION in sw.js",
        )

    def test_index_does_not_load_test_scripts(self):
        index_html = read_text("index.html")
        self.assertNotIn(
            'src="tests/',
            index_html,
            "Production index.html should not load scripts from tests/",
        )


if __name__ == "__main__":
    unittest.main()
