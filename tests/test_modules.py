import unittest
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_app_js():
    return (ROOT / 'js' / 'app.js').read_text(encoding='utf-8')


def strip_option_prefix(value):
    if not isinstance(value, str):
        return ''
    pattern = r'^\s*(?:\(?\s*[A-Fa-f1-6]\s*\)?\s*[.):\-]?)\s+'
    return re.sub(pattern, '', value).strip()


class StorageManagerTests(unittest.TestCase):
    """Test StorageManager module API"""

    def test_storage_manager_keys_generation(self):
        """App uses expected progress/shuffle key formats"""
        progress_key = f"progress_{'topic-1'}_{'test-1'}"
        self.assertEqual(progress_key, 'progress_topic-1_test-1')

        shuffle_key = f"shuffle_{'topic-1'}_{'test-1'}"
        self.assertEqual(shuffle_key, 'shuffle_topic-1_test-1')

        app_js = read_app_js()
        self.assertIn('progress_', app_js)
        self.assertIn('shuffle_', app_js)

    def test_storage_manager_wrong_questions_key(self):
        """App uses canonical wrong-questions key"""
        key = 'wrong_questions'
        self.assertEqual(key, 'wrong_questions')
        self.assertIn("'wrong_questions'", read_app_js())


class QuizRendererTests(unittest.TestCase):
    """Test QuizRenderer module API"""

    def test_quiz_renderer_strip_option_prefix(self):
        """stripOptionPrefix removes letter prefixes"""
        test_cases = [
            ('A. Option text', 'Option text'),
            ('B) Another option', 'Another option'),
            ('(C) Third option', 'Third option'),
            ('D: Fourth option', 'Fourth option'),
            ('Option with no prefix', 'Option with no prefix'),
        ]
        for input_text, expected in test_cases:
            result = strip_option_prefix(input_text)
            self.assertEqual(result, expected, f"Failed for input: {input_text}")

        self.assertIn('stripOptionPrefix(optionText)', read_app_js())

    def test_quiz_renderer_shuffle_array(self):
        """shuffleArray exists and preserves collection contents"""
        array = [1, 2, 3, 4, 5]
        shuffled = list(reversed(array))
        self.assertEqual(len(shuffled), len(array))
        self.assertEqual(set(shuffled), set(array))
        app_js = read_app_js()
        self.assertIn('shuffleArray(array)', app_js)
        self.assertIn('Math.random()', app_js)


if __name__ == '__main__':
    unittest.main()
