from __future__ import annotations

import statistics
from typing import Sequence, TypeVar

from note_writer.note_client import NoteArticle

T = TypeVar("T")


def like_threshold(articles: Sequence[NoteArticle], min_likes_floor: int) -> int:
    """The like count an article needs to survive: max(tag median, floor)."""
    if not articles:
        return min_likes_floor
    median = statistics.median(a.like_count for a in articles)
    return max(int(median), min_likes_floor)


def filter_by_likes(
    articles: Sequence[NoteArticle], min_likes_floor: int
) -> list[NoteArticle]:
    """Keep articles at/above both the tag's median likes and the floor.

    Both conditions collapse to a single ``like_count >= max(median, floor)``
    comparison, since satisfying that threshold implies satisfying each
    condition individually.
    """
    threshold = like_threshold(articles, min_likes_floor)
    return [a for a in articles if a.like_count >= threshold]
