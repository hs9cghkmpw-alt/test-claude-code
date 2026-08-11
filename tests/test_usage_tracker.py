from datetime import datetime, timezone

import pytest

from note_writer.usage_tracker import UsageTracker


def test_record_publication_and_retrieve(tmp_path):
    tracker = UsageTracker(tmp_path / "usage.json")
    tracker.record_publication(
        "art1", "topic", ["p1", "p2"], published_url="https://note.com/art1"
    )
    record = tracker.get("art1")
    assert record["used_pattern_ids"] == ["p1", "p2"]
    assert record["like_history"] == []


def test_record_likes_appends_history(tmp_path):
    tracker = UsageTracker(tmp_path / "usage.json")
    tracker.record_publication("art1", "topic", ["p1"])
    tracker.record_likes("art1", 5, checked_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
    tracker.record_likes("art1", 12, checked_at=datetime(2026, 1, 2, tzinfo=timezone.utc))

    history = tracker.get("art1")["like_history"]
    assert [h["like_count"] for h in history] == [5, 12]


def test_record_likes_unknown_article_raises(tmp_path):
    tracker = UsageTracker(tmp_path / "usage.json")
    with pytest.raises(KeyError):
        tracker.record_likes("missing", 5)


def test_persists_across_instances(tmp_path):
    path = tmp_path / "usage.json"
    UsageTracker(path).record_publication("art1", "topic", ["p1"])
    reloaded = UsageTracker(path)
    assert reloaded.get("art1")["used_pattern_ids"] == ["p1"]
