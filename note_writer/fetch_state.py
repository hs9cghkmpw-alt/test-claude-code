from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path


class FetchStateStore:
    """Tracks the last-fetched timestamp per URL, JSON-backed on disk.

    Used to enforce "leave at least N hours between fetches of the same
    URL" -- polite to note.com's servers and stable for like-count sampling
    (fetching too often would just capture noise).
    """

    def __init__(self, path: Path | str) -> None:
        self._path = Path(path)
        self._data: dict[str, str] = self._load()

    def _load(self) -> dict[str, str]:
        if self._path.exists():
            return json.loads(self._path.read_text(encoding="utf-8"))
        return {}

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(self._data, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )

    def can_fetch(
        self, url: str, interval_hours: float, now: datetime | None = None
    ) -> bool:
        now = now or datetime.now(timezone.utc)
        last = self._data.get(url)
        if last is None:
            return True
        return now - datetime.fromisoformat(last) >= timedelta(hours=interval_hours)

    def mark_fetched(self, url: str, now: datetime | None = None) -> None:
        now = now or datetime.now(timezone.utc)
        self._data[url] = now.isoformat()
        self._save()

    def last_fetched_at(self, url: str) -> datetime | None:
        last = self._data.get(url)
        return datetime.fromisoformat(last) if last else None
