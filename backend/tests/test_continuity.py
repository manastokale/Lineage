import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from data.continuity import (  # noqa: E402
    _dedupe_references,
    _episode_key,
    _json_from_model_text,
    _normalize_claims,
    _normalize_llm_flags,
)


class ContinuityTests(unittest.TestCase):
    def test_episode_key_uses_structured_episode_id(self):
        self.assertEqual(_episode_key("s07e10"), (7, 10))
        self.assertEqual(_episode_key("bad"), (0, 0))

    def test_json_from_model_text_accepts_fenced_json_object(self):
        payload = _json_from_model_text('```json\n{"claims":[{"id":"one"}]}\n```')
        self.assertEqual(payload, {"claims": [{"id": "one"}]})

    def test_dedupe_references_preserves_first_reference(self):
        references = _dedupe_references(
            [
                {"episode_id": "s02e20", "title": "A", "summary": "Richard shows the money pass."},
                {"episode_id": "s02e20", "title": "A", "summary": "Richard shows the money pass."},
                {"episode_id": "s07e10", "title": "B", "summary": "Chandler fails the money pass."},
            ]
        )
        self.assertEqual([item["episode_id"] for item in references], ["s02e20", "s07e10"])

    def test_normalize_claims_requires_real_scene_and_line(self):
        scene_lookup = {
            "s07e10_sc06": {
                "scene_id": "s07e10_sc06",
                "scene_label": "Michelle's",
                "lines": [{"line_index": 70, "speaker": "Chandler", "text": "Had the money in the wrong hand."}],
            }
        }
        claims = _normalize_claims(
            "s07e10",
            {
                "claims": [
                    {
                        "scene_id": "s07e10_sc06",
                        "line_index": 70,
                        "speaker": "Chandler",
                        "claim": "Chandler fails a handoff he may have seen before.",
                        "query": "Chandler prior handoff money technique",
                        "subjects": ["Chandler", "Richard"],
                    }
                ]
            },
            scene_lookup,
        )
        self.assertEqual(claims[0]["line_index"], 70)
        self.assertEqual(claims[0]["subjects"], ["Chandler", "Richard"])

    def test_normalize_llm_flags_filters_rejected_candidates(self):
        candidates = [
            {
                "id": "flag-1",
                "episode_id": "s01e01",
                "scene_id": "s01e01_sc01",
                "line_index": 1,
                "speaker": "Ross",
                "severity": "medium",
                "category": "continuity",
                "title": "Continuity check",
                "explanation": "maybe",
                "current_text": "I never met her.",
                "references": [],
                "status": "candidate",
            }
        ]
        flags = _normalize_llm_flags(candidates, [{"id": "flag-1", "is_plot_hole": False}])
        self.assertEqual(flags, [])


if __name__ == "__main__":
    unittest.main()
