from __future__ import annotations

import json
from dataclasses import dataclass

from note_writer.llm import LLMClient
from note_writer.note_client import NoteArticle

# (axis key, Japanese label) -- order matches the spec.
AXES: tuple[tuple[str, str], ...] = (
    ("hook", "フック"),
    ("problem_framing", "課題設定"),
    ("concreteness", "具体性"),
    ("credibility", "信頼性"),
    ("structure", "構成"),
    ("readability", "読みやすさ"),
    ("actionability", "実行可能性"),
    ("originality", "独自性"),
)

_SYSTEM_PROMPT = (
    "あなたはnote記事の編集者です。与えられた記事本文を、以下の8つの観点で"
    "それぞれ0〜10点(整数)で採点してください。各観点の点数と、120字以内の"
    "短い根拠(rationale)を付けてください。出力は次のJSON形式のみとし、"
    "説明文やコードブロックは付けないこと:\n"
    '{"scores": {"' + '": 0, "'.join(k for k, _ in AXES) + '": 0}, '
    '"rationales": {"' + '": "", "'.join(k for k, _ in AXES) + '": ""}}'
)


class ScoreValidationError(ValueError):
    pass


@dataclass(frozen=True)
class ArticleScore:
    article: NoteArticle
    scores: dict[str, int]
    rationales: dict[str, str]

    @property
    def total(self) -> int:
        return sum(self.scores.values())

    def passes(self, min_total_score: int) -> bool:
        return self.total >= min_total_score


class ArticleScorer:
    """Stage 2a: rate an article 0-10 on each of the 8 spec'd axes via an LLM."""

    def __init__(self, llm: LLMClient) -> None:
        self._llm = llm

    def score(self, article: NoteArticle, body_text: str) -> ArticleScore:
        prompt = (
            f"タイトル: {article.title}\n\n本文:\n{body_text}"
        )
        raw = self._llm.complete(_SYSTEM_PROMPT, prompt)
        return self._parse(article, raw)

    def _parse(self, article: NoteArticle, raw: str) -> ArticleScore:
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ScoreValidationError(f"LLM response was not JSON: {raw!r}") from exc

        scores = payload.get("scores")
        rationales = payload.get("rationales", {})
        if not isinstance(scores, dict):
            raise ScoreValidationError(f"response missing 'scores' object: {raw!r}")

        expected_keys = {k for k, _ in AXES}
        missing = expected_keys - scores.keys()
        if missing:
            raise ScoreValidationError(f"response missing axes: {sorted(missing)}")

        normalized: dict[str, int] = {}
        for key in expected_keys:
            value = scores[key]
            if not isinstance(value, int) or not (0 <= value <= 10):
                raise ScoreValidationError(
                    f"axis '{key}' score must be an int 0..10, got {value!r}"
                )
            normalized[key] = value

        return ArticleScore(
            article=article,
            scores=normalized,
            rationales={k: str(rationales.get(k, "")) for k in expected_keys},
        )
