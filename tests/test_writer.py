from note_writer.llm import FakeLLMClient
from note_writer.patterns import Pattern
from note_writer.writer import ArticleWriter


def _pattern(pattern_id):
    return Pattern(
        pattern_id=pattern_id,
        source_tag="python",
        source_url="https://note.com/a",
        source_score_total=65,
        hook_pattern="hook",
        problem_framing_pattern="problem",
        structure_pattern="structure",
        cta_pattern="cta",
        tone="tone",
        length_band="medium",
    )


def test_write_runs_draft_then_two_review_passes_by_default():
    llm = FakeLLMClient(
        responses=[
            "draft v0",
            "critique 1",
            "draft v1",
            "critique 2",
            "draft v2",
        ]
    )
    draft = ArticleWriter(llm).write("topic", [_pattern("p1")])

    assert draft.body_markdown == "draft v2"
    assert len(draft.revision_notes) == 2
    assert draft.used_pattern_ids == ["p1"]
    assert len(llm.calls) == 5


def test_write_respects_custom_pass_count():
    llm = FakeLLMClient(
        responses=["draft v0", "critique 1", "draft v1"]
    )
    draft = ArticleWriter(llm).write("topic", [], passes=1)
    assert draft.body_markdown == "draft v1"
    assert len(draft.revision_notes) == 1


def test_write_with_zero_patterns_still_drafts():
    llm = FakeLLMClient(responses=["draft v0", "critique", "draft v1"])
    draft = ArticleWriter(llm).write("topic", [], passes=1)
    assert draft.used_pattern_ids == []
    assert draft.body_markdown == "draft v1"
