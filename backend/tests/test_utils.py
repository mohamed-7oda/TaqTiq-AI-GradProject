"""
Unit tests for pure utility functions in server.py.
No database or ML models are used — these run instantly.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from server import allowed_file, _merge_intervals, enrich_event_results, _to_python


# ── allowed_file ──────────────────────────────────────────────────────────────

class TestAllowedFile:
    def test_mp4_accepted(self):
        assert allowed_file("match.mp4") is True

    def test_mkv_accepted(self):
        assert allowed_file("clip.mkv") is True

    def test_avi_accepted(self):
        assert allowed_file("video.avi") is True

    def test_mov_accepted(self):
        assert allowed_file("game.mov") is True

    def test_webm_accepted(self):
        assert allowed_file("stream.webm") is True

    def test_uppercase_extension_accepted(self):
        assert allowed_file("MATCH.MP4") is True

    def test_exe_rejected(self):
        assert allowed_file("bad.exe") is False

    def test_pdf_rejected(self):
        assert allowed_file("report.pdf") is False

    def test_no_extension_rejected(self):
        assert allowed_file("no_extension") is False

    def test_empty_string_rejected(self):
        assert allowed_file("") is False


# ── _merge_intervals ──────────────────────────────────────────────────────────

class TestMergeIntervals:
    def test_empty_list(self):
        assert _merge_intervals([]) == []

    def test_single_interval(self):
        assert _merge_intervals([(0.0, 5.0)]) == [(0.0, 5.0)]

    def test_non_overlapping(self):
        result = _merge_intervals([(0.0, 3.0), (5.0, 8.0)])
        assert result == [(0.0, 3.0), (5.0, 8.0)]

    def test_overlapping_intervals(self):
        result = _merge_intervals([(0.0, 5.0), (3.0, 9.0)])
        assert result == [(0.0, 9.0)]

    def test_adjacent_intervals(self):
        result = _merge_intervals([(0.0, 5.0), (5.0, 10.0)])
        assert result == [(0.0, 10.0)]

    def test_multiple_merges(self):
        result = _merge_intervals([(0.0, 4.0), (2.0, 6.0), (8.0, 12.0)])
        assert result == [(0.0, 6.0), (8.0, 12.0)]

    def test_unsorted_input_sorted_output(self):
        result = _merge_intervals([(10.0, 15.0), (0.0, 5.0)])
        assert result == [(0.0, 5.0), (10.0, 15.0)]

    def test_fully_contained_interval(self):
        result = _merge_intervals([(0.0, 10.0), (2.0, 4.0)])
        assert result == [(0.0, 10.0)]


# ── enrich_event_results ──────────────────────────────────────────────────────

class TestEnrichEventResults:
    def test_empty_predictions(self):
        enriched, counts = enrich_event_results({"predictions": []})
        assert enriched == []
        assert counts == {}

    def test_missing_predictions_key(self):
        enriched, counts = enrich_event_results({})
        assert enriched == []

    def test_valid_prediction_parsed_correctly(self):
        preds = {"predictions": [{
            "label": "Goal",
            "gameTime": "1 - 00:32",
            "position": "32000",
            "half": 1,
            "confidence": "0.85",
            "team": "Team 1",
            "team_color": "red",
        }]}
        enriched, counts = enrich_event_results(preds)
        assert len(enriched) == 1
        assert enriched[0]["label"] == "Goal"
        assert enriched[0]["position_seconds"] == 32.0
        assert enriched[0]["confidence"] == 0.85
        assert enriched[0]["team"] == "Team 1"
        assert counts == {"Goal": 1}

    def test_negative_confidence_filtered_out(self):
        preds = {"predictions": [{
            "label": "Goal", "gameTime": "1-00:10",
            "position": "10000", "half": 1, "confidence": "-1.0",
        }]}
        enriched, _ = enrich_event_results(preds)
        assert len(enriched) == 0

    def test_events_sorted_chronologically(self):
        preds = {"predictions": [
            {"label": "Foul",  "gameTime": "1-02:00", "position": "120000",
             "half": 1, "confidence": "0.70"},
            {"label": "Goal",  "gameTime": "1-01:00", "position": "60000",
             "half": 1, "confidence": "0.90"},
        ]}
        enriched, _ = enrich_event_results(preds)
        assert enriched[0]["label"] == "Goal"
        assert enriched[1]["label"] == "Foul"

    def test_event_counts_multiple_types(self):
        preds = {"predictions": [
            {"label": "Goal",  "gameTime": "1-01:00", "position": "60000",
             "half": 1, "confidence": "0.9"},
            {"label": "Goal",  "gameTime": "1-02:00", "position": "120000",
             "half": 1, "confidence": "0.8"},
            {"label": "Foul",  "gameTime": "1-03:00", "position": "180000",
             "half": 1, "confidence": "0.7"},
        ]}
        _, counts = enrich_event_results(preds)
        assert counts["Goal"] == 2
        assert counts["Foul"] == 1


# ── _to_python ────────────────────────────────────────────────────────────────

class TestToPython:
    def test_string_unchanged(self):
        assert _to_python("hello") == "hello"

    def test_int_unchanged(self):
        assert _to_python(42) == 42

    def test_float_unchanged(self):
        assert _to_python(3.14) == 3.14

    def test_dict_unchanged(self):
        d = {"key": "value", "num": 1}
        assert _to_python(d) == d

    def test_nested_dict(self):
        d = {"outer": {"inner": 99}}
        assert _to_python(d) == {"outer": {"inner": 99}}

    def test_list_unchanged(self):
        assert _to_python([1, 2, 3]) == [1, 2, 3]
