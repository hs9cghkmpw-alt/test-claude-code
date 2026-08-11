import json
from datetime import datetime, timezone

import pytest

from note_writer.llm import FakeLLMClient
from note_writer.note_client import NoteArticle
from note_writer.scorer import AXES, ArticleScorer, ScoreValidationError

ARTICLE = NoteArticle(
    url="https://note.com/a",
    title="t",
    author="x",
    published_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    like_count=100,
    tag="python",
)


def _response(total_each: int) -> str:
    return json.dumps(
        {
            "scores": {k: total_each for k, _ in AXES},
            "rationales": {k: "ok" for k, _ in AXES},
        }
    )


def test_scores_all_axes_and_sums_total():
    llm = FakeLLMClient(responses=[_response(8)])
    score = ArticleScorer(llm).score(ARTICLE, "body text")
    assert set(score.scores) == {k for k, _ in AXES}
    assert score.total == 8 * len(AXES)


def test_passes_threshold():
    llm = FakeLLMClient(responses=[_response(8)])
    score = ArticleScorer(llm).score(ARTICLE, "body text")
    assert score.passes(60) is True
    assert score.passes(65) is False


def test_rejects_non_json_response():
    llm = FakeLLMClient(responses=["not json"])
    with pytest.raises(ScoreValidationError):
        ArticleScorer(llm).score(ARTICLE, "body text")


def test_rejects_missing_axis():
    payload = {"scores": {k: 5 for k, _ in AXES if k != "hook"}}
    llm = FakeLLMClient(responses=[json.dumps(payload)])
    with pytest.raises(ScoreValidationError):
        ArticleScorer(llm).score(ARTICLE, "body text")


def test_rejects_out_of_range_score():
    payload = {"scores": {k: 11 for k, _ in AXES}}
    llm = FakeLLMClient(responses=[json.dumps(payload)])
    with pytest.raises(ScoreValidationError):
        ArticleScorer(llm).score(ARTICLE, "body text")
