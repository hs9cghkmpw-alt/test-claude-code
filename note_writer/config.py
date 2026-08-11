from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PipelineConfig:
    """Tunable knobs for the collect -> distill -> write pipeline.

    Defaults match the spec: 30-day lookback, 6-hour re-fetch interval,
    a 30-like floor, and an 8-axis total-score cutoff of 60.
    """

    tag: str
    days_back: int = 30
    fetch_interval_hours: float = 6.0
    min_likes_floor: int = 30
    min_total_score: int = 60
    max_axis_score: int = 10
    num_axes: int = 8
    user_agent: str = "note-article-tool/1.0 (+research; contact: operator)"
    request_timeout_sec: float = 15.0
    max_pages: int = 10

    def __post_init__(self) -> None:
        if not self.tag:
            raise ValueError("tag must not be empty")
        if self.days_back <= 0:
            raise ValueError("days_back must be positive")
        if self.fetch_interval_hours < 0:
            raise ValueError("fetch_interval_hours must not be negative")
        if self.min_likes_floor < 0:
            raise ValueError("min_likes_floor must not be negative")
        max_possible = self.max_axis_score * self.num_axes
        if not (0 <= self.min_total_score <= max_possible):
            raise ValueError(
                f"min_total_score must be within 0..{max_possible}"
            )
