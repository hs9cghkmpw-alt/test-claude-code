import json
from datetime import datetime, timezone

import pytest

from note_writer.llm import FakeLLMClient
from note_writer.note_client import NoteArticle
from note_writer.patterns import (
    Pattern,
    PatternExtractor,
    PatternStore,
    PatternValidationError,
)
from note_writer.scorer import ArticleScore

ARTICLE = NoteArticle(
    url="https://note.com/a",
    title="t",
    author="x",
    published_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    like_count=100,
    tag="python",
)
SCORE = ArticleScore(article=ARTICLE, scores={"hook": 8}, rationales={})


def _extraction_payload(**overrides):
    payload = {
        "hook_pattern": "personal failure stated in one line",
        "problem_framing_pattern": "names a common frustration early",
        "structure_pattern": "problem -> 3 steps -> result -> CTA",
        "cta_pattern": "asks a reflective question",
        "tone": "casual but direct",
        "length_band": "medium (1500-2500 chars)",
    }
    payload.update(overrides)
    return json.dumps(payload)


def test_extract_returns_pattern_without_body_field():
    llm = FakeLLMClient(responses=[_extraction_payload()])
    pattern = PatternExtractor(llm).extract(SCORE, "the actual article body", "python:abc")
    assert pattern.pattern_id == "python:abc"
    assert pattern.source_url == "https://note.com/a"
    assert not hasattr(pattern, "body")
    assert not hasattr(pattern, "body_text")


def test_extract_rejects_missing_fields():
    llm = FakeLLMClient(responses=[json.dumps({"hook_pattern": "x"})])
    with pytest.raises(PatternValidationError):
        PatternExtractor(llm).extract(SCORE, "body", "python:abc")


def test_pattern_rejects_verbatim_length_dump():
    with pytest.raises(PatternValidationError):
        Pattern(
            pattern_id="p1",
            source_tag="python",
            source_url="https://note.com/a",
            source_score_total=65,
            hook_pattern="x" * 500,
            problem_framing_pattern="ok",
            structure_pattern="ok",
            cta_pattern="ok",
            tone="ok",
            length_band="ok",
        )


def _pattern(pattern_id="p1", score=65):
    return Pattern(
        pattern_id=pattern_id,
        source_tag="python",
        source_url="https://note.com/a",
        source_score_total=score,
        hook_pattern="ok",
        problem_framing_pattern="ok",
        structure_pattern="ok",
        cta_pattern="ok",
        tone="ok",
        length_band="ok",
    )


def test_store_roundtrip(tmp_path):
    store = PatternStore(tmp_path / "patterns.db")
    store.save(_pattern("p1", 65))
    store.save(_pattern("p2", 80))

    all_patterns = store.all()
    assert {p.pattern_id for p in all_patterns} == {"p1", "p2"}


def test_store_top_orders_by_score(tmp_path):
    store = PatternStore(tmp_path / "patterns.db")
    store.save(_pattern("low", 61))
    store.save(_pattern("high", 95))
    store.save(_pattern("mid", 70))

    top = store.top(2)
    assert [p.pattern_id for p in top] == ["high", "mid"]


def test_store_save_never_receives_a_body_column(tmp_path):
    store = PatternStore(tmp_path / "patterns.db")
    store.save(_pattern())
    cursor = store._conn.execute("PRAGMA table_info(patterns)")
    columns = {row[1] for row in cursor.fetchall()}
    assert "body" not in columns
    assert "body_text" not in columns
