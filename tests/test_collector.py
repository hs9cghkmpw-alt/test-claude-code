from datetime import datetime, timezone

from note_writer.collector import HashtagCollector
from note_writer.config import PipelineConfig
from note_writer.fetch_state import FetchStateStore
from note_writer.note_client import NoteArticle
from note_writer.robots import RobotsChecker

NOW = datetime(2026, 2, 1, tzinfo=timezone.utc)


class FakeClient:
    def __init__(self, articles):
        self._articles = articles

    def list_hashtag_notes(self, tag, since, until, max_pages):
        return iter(self._articles)

    def get_note_body(self, url):
        raise NotImplementedError


def _config(**overrides):
    defaults = dict(tag="python", days_back=30, fetch_interval_hours=6, min_likes_floor=30)
    defaults.update(overrides)
    return PipelineConfig(**defaults)


def _allow_all_robots():
    return RobotsChecker("agent", fetch_fn=lambda url: "User-agent: *\nAllow: /")


def _deny_all_robots():
    return RobotsChecker("agent", fetch_fn=lambda url: "User-agent: *\nDisallow: /")


def test_filters_by_robots_txt(tmp_path):
    articles = [
        NoteArticle("https://note.com/a", "a", "x", NOW, 100, "python"),
    ]
    collector = HashtagCollector(
        FakeClient(articles),
        _deny_all_robots(),
        FetchStateStore(tmp_path / "state.json"),
        _config(),
    )
    assert collector.collect(now=NOW) == []


def test_applies_like_threshold(tmp_path):
    from datetime import timedelta

    articles = [
        NoteArticle("https://note.com/a", "a", "x", NOW - timedelta(days=1), 5, "python"),
        NoteArticle("https://note.com/b", "b", "x", NOW - timedelta(days=1), 40, "python"),
        NoteArticle("https://note.com/c", "c", "x", NOW - timedelta(days=1), 200, "python"),
    ]
    collector = HashtagCollector(
        FakeClient(articles),
        _allow_all_robots(),
        FetchStateStore(tmp_path / "state.json"),
        _config(min_likes_floor=30),
    )
    result = collector.collect(now=NOW)
    assert [a.url for a in result] == ["https://note.com/b", "https://note.com/c"]


def test_excludes_urls_outside_fetch_interval(tmp_path):
    from datetime import timedelta

    articles = [
        NoteArticle("https://note.com/a", "a", "x", NOW - timedelta(days=1), 100, "python"),
    ]
    fetch_state = FetchStateStore(tmp_path / "state.json")
    fetch_state.mark_fetched("https://note.com/a", now=NOW - timedelta(hours=1))

    collector = HashtagCollector(
        FakeClient(articles), _allow_all_robots(), fetch_state, _config(fetch_interval_hours=6)
    )
    assert collector.collect(now=NOW) == []


def test_excludes_articles_older_than_days_back(tmp_path):
    from datetime import timedelta

    articles = [
        NoteArticle("https://note.com/a", "a", "x", NOW - timedelta(days=31), 100, "python"),
    ]
    collector = HashtagCollector(
        FakeClient(articles),
        _allow_all_robots(),
        FetchStateStore(tmp_path / "state.json"),
        _config(days_back=30),
    )
    assert collector.collect(now=NOW) == []
