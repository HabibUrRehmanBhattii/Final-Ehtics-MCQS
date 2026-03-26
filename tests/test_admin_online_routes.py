import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_text(rel_path):
    return (ROOT / rel_path).read_text(encoding='utf-8')


class AdminOnlineRoutesTests(unittest.TestCase):
    """Regression tests for online admin content manager routes"""

    def test_worker_exposes_admin_content_routes(self):
        worker = read_text('src/worker.js')
        required = [
            "/api/admin/questions",
            "/api/admin/questions/bulk-import",
            "/api/admin/validate",
            "/api/admin/stats",
            "/api/admin/export",
        ]
        for route in required:
            self.assertIn(route, worker)

    def test_admin_api_uses_questions_array_contract(self):
        admin_api = read_text('js/admin-api.js')
        self.assertIn("Array.isArray(data?.questions) ? data.questions : []", admin_api)
        self.assertIn("Authorization': `Bearer ${localStorage.getItem('admin_token')}`", admin_api)


if __name__ == '__main__':
    unittest.main()
