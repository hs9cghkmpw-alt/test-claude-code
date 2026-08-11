from __future__ import annotations

import hashlib
from datetime import datetime

from note_writer.collector import HashtagCollector
from note_writer.config import PipelineConfig
from note_writer.fetch_state import FetchStateStore
from note_writer.llm import LLMClient
from note_writer.note_client import NoteArticle, NoteClient
from note_writer.patterns import Pattern, PatternExtractor, PatternStore
from note_writer.robots import RobotsChecker
from note_writer.scorer import ArticleScorer
from note_writer.writer import ArticleWriter, Draft


def _pattern_id(article: NoteArticle) -> str:
    digest = hashlib.sha1(article.url.encode("utf-8")).hexdigest()[:10]
    return f"{article.tag}:{digest}"


class Pipeline:
    """Wires 集める -> 共通点を出す -> 書く into one place."""

    def __init__(
        self,
        config: PipelineConfig,
        client: NoteClient,
        robots: RobotsChecker,
        fetch_state: FetchStateStore,
        pattern_store: PatternStore,
        llm: LLMClient,
    ) -> None:
        self._config = config
        self._client = client
        self._pattern_store = pattern_store
        self._collector = HashtagCollector(client, robots, fetch_state, config)
        self._scorer = ArticleScorer(llm)
        self._extractor = PatternExtractor(llm)
        self._writer = ArticleWriter(llm)

    def collect(self, now: datetime | None = None) -> list[NoteArticle]:
        """Stage 1: 集める."""
        return self._collector.collect(now=now)

    def distill(self, articles: list[NoteArticle]) -> list[Pattern]:
        """Stage 2: 共通点を出す. Scores each article, keeps >= threshold,
        extracts and persists only the abstracted pattern (never the body).
        """
        saved: list[Pattern] = []
        for article in articles:
            body = self._client.get_note_body(article.url)
            score = self._scorer.score(article, body)
            if not score.passes(self._config.min_total_score):
                continue
            pattern = self._extractor.extract(score, body, _pattern_id(article))
            self._pattern_store.save(pattern)
            saved.append(pattern)
        return saved

    def write(self, topic: str, pattern_limit: int = 5, passes: int = 2) -> Draft:
        """Stage 3: 書く, using the best stored patterns, then self-review twice."""
        patterns = self._pattern_store.top(pattern_limit)
        return self._writer.write(topic, patterns, passes=passes)
