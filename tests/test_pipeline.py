import json
from datetime import datetime, timedelta, timezone

from note_writer.config import PipelineConfig
from note_writer.fetch_state import FetchStateStore
from note_writer.llm import FakeLLMClient
from note_writer.note_client import NoteArticle
from note_writer.patterns import PatternStore
from note_writer.pipeline import Pipeline
from note_writer.robots import RobotsChecker
from note_writer.scorer import AXES

NOW = datetime(2026, 2, 1, tzinfo=timezone.utc)


class FakeClient:
    def __init__(self, articles, bodies):
        self._articles = articles
        self._bodies = bodies

    def list_hashtag_notes(self, tag, since, until, max_pages):
        return iter(self._articles)

    def get_note_body(self, url):
        return self._bodies[url]


def _article(url, likes):
    return NoteArticle(
        url=url,
        title=f"title-{url}",
        author="a",
        published_at=NOW - timedelta(days=1),
        like_count=likes,
        tag="python",
    )


def _score_response(each: int) -> str:
    return json.dumps({"scores": {k: each for k, _ in AXES}, "rationales": {}})


def _extract_response() -> str:
    return json.dumps(
        {
            "hook_pattern": "hp",
            "problem_framing_pattern": "pf",
            "structure_pattern": "sp",
            "cta_pattern": "cta",
            "tone": "tone",
            "length_band": "medium",
        }
    )


def _allow_all_robots():
    return RobotsChecker("agent", fetch_fn=lambda url: "User-agent: *\nAllow: /")


def _build_pipeline(tmp_path, articles, bodies, llm):
    config = PipelineConfig(tag="python", min_likes_floor=30, min_total_score=60)
    client = FakeClient(articles, bodies)
    return Pipeline(
        config=config,
        client=client,
        robots=_allow_all_robots(),
        fetch_state=FetchStateStore(tmp_path / "state.json"),
        pattern_store=PatternStore(tmp_path / "patterns.db"),
        llm=llm,
    )


def test_full_pipeline_collect_distill_write(tmp_path):
    articles = [
        _article("https://note.com/high", 100),
        _article("https://note.com/low", 5),
    ]
    bodies = {
        "https://note.com/high": "great article body",
        "https://note.com/low": "mediocre article body",
    }
    # collect() needs no LLM calls; distill() scores each collected article
    # (both survive the like filter: median=52.5->52, floor=30, so only
    # >=52 survives -- "low" (5 likes) is dropped before scoring).
    llm = FakeLLMClient(
        responses=[
            _score_response(9),  # high -> total 72, passes 60
            _extract_response(),
        ]
    )
    pipeline = _build_pipeline(tmp_path, articles, bodies, llm)

    collected = pipeline.collect(now=NOW)
    assert [a.url for a in collected] == ["https://note.com/high"]

    patterns = pipeline.distill(collected)
    assert len(patterns) == 1
    assert patterns[0].source_url == "https://note.com/high"

    write_llm = FakeLLMClient(
        responses=["draft v0", "critique 1", "draft v1", "critique 2", "draft v2"]
    )
    pipeline_for_write = Pipeline(
        config=PipelineConfig(tag="python"),
        client=FakeClient([], {}),
        robots=_allow_all_robots(),
        fetch_state=FetchStateStore(tmp_path / "state2.json"),
        pattern_store=PatternStore(tmp_path / "patterns.db"),
        llm=write_llm,
    )
    draft = pipeline_for_write.write("how to write good hooks")
    assert draft.body_markdown == "draft v2"
    assert draft.used_pattern_ids == [patterns[0].pattern_id]


def test_distill_drops_articles_below_score_threshold(tmp_path):
    articles = [_article("https://note.com/a", 100)]
    bodies = {"https://note.com/a": "body"}
    llm = FakeLLMClient(responses=[_score_response(5)])  # total 40, fails 60
    pipeline = _build_pipeline(tmp_path, articles, bodies, llm)

    patterns = pipeline.distill(articles)
    assert patterns == []
    assert len(llm.calls) == 1  # never reaches pattern extraction
