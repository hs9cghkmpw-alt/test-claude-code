from __future__ import annotations

from datetime import datetime, timedelta, timezone

from note_writer.config import PipelineConfig
from note_writer.fetch_state import FetchStateStore
from note_writer.filters import filter_by_likes
from note_writer.note_client import NoteArticle, NoteClient
from note_writer.robots import RobotsChecker


class HashtagCollector:
    """Stage 1 ("集める"): recent, robots-permitted, well-liked articles.

    Pipeline per article, in order:
      1. within the last ``days_back`` days
      2. its URL is allowed by robots.txt
      3. its URL hasn't been fetched within ``fetch_interval_hours``
      4. survives the tag's like-count filter (median-and-floor)
    """

    def __init__(
        self,
        client: NoteClient,
        robots: RobotsChecker,
        fetch_state: FetchStateStore,
        config: PipelineConfig,
    ) -> None:
        self._client = client
        self._robots = robots
        self._fetch_state = fetch_state
        self._config = config

    def collect(self, now: datetime | None = None) -> list[NoteArticle]:
        now = now or datetime.now(timezone.utc)
        since = now - timedelta(days=self._config.days_back)

        hashtag_url = f"https://note.com/hashtag/{self._config.tag}"
        if not self._robots.is_allowed(hashtag_url):
            return []

        candidates: list[NoteArticle] = []
        for article in self._client.list_hashtag_notes(
            tag=self._config.tag,
            since=since,
            until=now,
            max_pages=self._config.max_pages,
        ):
            if article.published_at < since:
                continue
            if not self._robots.is_allowed(article.url):
                continue
            if not self._fetch_state.can_fetch(
                article.url, self._config.fetch_interval_hours, now=now
            ):
                continue
            self._fetch_state.mark_fetched(article.url, now=now)
            candidates.append(article)

        return filter_by_likes(candidates, self._config.min_likes_floor)
