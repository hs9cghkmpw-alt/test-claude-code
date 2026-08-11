from datetime import datetime, timedelta, timezone

from note_writer.fetch_state import FetchStateStore


def test_new_url_can_always_be_fetched(tmp_path):
    store = FetchStateStore(tmp_path / "state.json")
    assert store.can_fetch("https://note.com/x", interval_hours=6) is True


def test_recently_fetched_url_is_blocked_within_interval(tmp_path):
    store = FetchStateStore(tmp_path / "state.json")
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    store.mark_fetched("https://note.com/x", now=now)

    soon = now + timedelta(hours=5)
    assert store.can_fetch("https://note.com/x", interval_hours=6, now=soon) is False


def test_url_is_allowed_again_after_interval_elapses(tmp_path):
    store = FetchStateStore(tmp_path / "state.json")
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    store.mark_fetched("https://note.com/x", now=now)

    later = now + timedelta(hours=6, minutes=1)
    assert store.can_fetch("https://note.com/x", interval_hours=6, now=later) is True


def test_state_persists_across_instances(tmp_path):
    path = tmp_path / "state.json"
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    FetchStateStore(path).mark_fetched("https://note.com/x", now=now)

    reloaded = FetchStateStore(path)
    soon = now + timedelta(hours=1)
    assert reloaded.can_fetch("https://note.com/x", interval_hours=6, now=soon) is False
