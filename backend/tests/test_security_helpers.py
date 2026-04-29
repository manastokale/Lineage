import sys
import time
import unittest
from pathlib import Path

from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from security import clip_text, normalize_episode_id, require_rate_limit, require_safe_name  # noqa: E402


class SecurityHelperTests(unittest.TestCase):
    def test_episode_id_is_strict_and_normalized(self):
        self.assertEqual(normalize_episode_id("S07E10"), "s07e10")
        self.assertIsNone(normalize_episode_id("../s07e10"))
        self.assertIsNone(normalize_episode_id("season-7-episode-10"))

    def test_safe_name_blocks_control_or_path_like_values(self):
        self.assertEqual(require_safe_name(" Dr. Green ", label="character"), "Dr. Green")
        with self.assertRaises(HTTPException):
            require_safe_name("../Ross", label="character")
        with self.assertRaises(HTTPException):
            require_safe_name("Ross\nGeller", label="character")

    def test_clip_text_bounds_prompt_context(self):
        self.assertEqual(clip_text("short", 20), "short")
        self.assertEqual(len(clip_text("x" * 50, 10)), 10)

    def test_rate_limiter_raises_after_window_is_full(self):
        key = f"test-{time.monotonic_ns()}"
        require_rate_limit(key, "unit_test", max_requests=2, window_seconds=60)
        require_rate_limit(key, "unit_test", max_requests=2, window_seconds=60)
        with self.assertRaises(HTTPException) as context:
            require_rate_limit(key, "unit_test", max_requests=2, window_seconds=60)
        self.assertEqual(context.exception.status_code, 429)


if __name__ == "__main__":
    unittest.main()
