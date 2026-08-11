from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


class UsageTracker:
    """Links each published article back to the patterns it used, plus a
    like-count time series, so pattern performance can be analyzed later
    (e.g. "articles using pattern P consistently out-perform baseline").
    """

    def __init__(self, path: Path | str) -> None:
        self._path = Path(path)
        self._data: dict[str, dict] = self._load()

    def _load(self) -> dict[str, dict]:
        if self._path.exists():
            return json.loads(self._path.read_text(encoding="utf-8"))
        return {}

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(self._data, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )

    def record_publication(
        self,
        article_id: str,
        topic: str,
        used_pattern_ids: list[str],
        published_url: str | None = None,
        published_at: datetime | None = None,
    ) -> None:
        published_at = published_at or datetime.now(timezone.utc)
        self._data[article_id] = {
            "article_id": article_id,
            "topic": topic,
            "used_pattern_ids": list(used_pattern_ids),
            "published_url": published_url,
            "published_at": published_at.isoformat(),
            "like_history": [],
        }
        self._save()

    def record_likes(
        self, article_id: str, like_count: int, checked_at: datetime | None = None
    ) -> None:
        if article_id not in self._data:
            raise KeyError(f"unknown article_id: {article_id!r}")
        checked_at = checked_at or datetime.now(timezone.utc)
        self._data[article_id]["like_history"].append(
            {"checked_at": checked_at.isoformat(), "like_count": like_count}
        )
        self._save()

    def get(self, article_id: str) -> dict | None:
        return self._data.get(article_id)

    def all(self) -> list[dict]:
        return list(self._data.values())
