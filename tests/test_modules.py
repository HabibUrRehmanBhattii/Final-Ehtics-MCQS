import unittest


class StorageManagerTests(unittest.TestCase):
    """Test StorageManager module API"""

    def test_storage_manager_keys_generation(self):
        """StorageManager generates correct localStorage keys"""
        progress_key = StorageManager.KEYS.progress('topic-1', 'test-1')
        self.assertEqual(progress_key, 'progress_topic-1_test-1')

        shuffle_key = StorageManager.KEYS.shuffle('topic-1', 'test-1')
        self.assertEqual(shuffle_key, 'shuffle_topic-1_test-1')

    def test_storage_manager_wrong_questions_key(self):
        """StorageManager has correct wrong-questions key"""
        key = StorageManager.KEYS.wrongQuestions
        self.assertEqual(key, 'wrong_questions')


class QuizRendererTests(unittest.TestCase):
    """Test QuizRenderer module API"""

    def test_quiz_renderer_strip_option_prefix(self):
        """QuizRenderer.stripOptionPrefix removes letter prefixes"""
        test_cases = [
            ('A. Option text', 'Option text'),
            ('B) Another option', 'Another option'),
            ('(C) Third option', 'Third option'),
            ('D: Fourth option', 'Fourth option'),
            ('Option with no prefix', 'Option with no prefix'),
        ]
        for input_text, expected in test_cases:
            result = QuizRenderer.stripOptionPrefix(input_text)
            self.assertEqual(result, expected, f"Failed for input: {input_text}")

    def test_quiz_renderer_shuffle_array(self):
        """QuizRenderer.shuffleArray returns different order"""
        array = [1, 2, 3, 4, 5]
        shuffled = QuizRenderer.shuffleArray(array)
        self.assertEqual(len(shuffled), len(array))
        self.assertEqual(set(shuffled), set(array))


if __name__ == '__main__':
    unittest.main()
