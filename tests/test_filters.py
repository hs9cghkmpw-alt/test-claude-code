from datetime import datetime, timezone

from note_writer.filters import filter_by_likes, like_threshold
from note_writer.note_client import NoteArticle


def _article(likes: int, url: str = "https://note.com/a") -> NoteArticle:
    return NoteArticle(
        url=url,
        title="t",
        author="a",
        published_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        like_count=likes,
        tag="python",
    )


def test_threshold_uses_floor_when_median_is_low():
    articles = [_article(1), _article(2), _article(3)]
    assert like_threshold(articles, min_likes_floor=30) == 30


def test_threshold_uses_median_when_above_floor():
    articles = [_article(40), _article(50), _article(200)]
    assert like_threshold(articles, min_likes_floor=30) == 50


def test_filter_keeps_only_articles_meeting_both_conditions():
    articles = [_article(10), _article(40), _article(200)]
    # median = 40, floor = 30 -> threshold = 40
    kept = filter_by_likes(articles, min_likes_floor=30)
    assert [a.like_count for a in kept] == [40, 200]


def test_filter_empty_input():
    assert filter_by_likes([], min_likes_floor=30) == []


def test_low_median_tag_still_enforces_floor():
    # every article is below the floor even though they all beat the median
    articles = [_article(5), _article(8), _article(10)]
    assert filter_by_likes(articles, min_likes_floor=30) == []
