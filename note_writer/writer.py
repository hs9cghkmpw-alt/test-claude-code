from __future__ import annotations

from dataclasses import dataclass, field

from note_writer.llm import LLMClient
from note_writer.patterns import Pattern

_DRAFT_SYSTEM = (
    "あなたはnoteのライターです。与えられた「型」(構造パターン)の知見を"
    "参考に、指定のトピックについてMarkdown形式のnote記事を書いてください。"
    "型はあくまで構成・フック・展開の参考であり、元記事の具体的な文章や"
    "エピソードをそのまま流用しないこと。出力は記事本文(Markdown)のみ。"
)

_CRITIQUE_SYSTEM = (
    "あなたは厳しいnote編集者です。次の記事を読み直し、フック / 課題設定 / "
    "具体性 / 信頼性 / 構成 / 読みやすさ / 実行可能性 / 独自性の8観点で"
    "弱い点を具体的に指摘してください。箇条書きで、直せる指摘のみ書くこと。"
)

_REVISE_SYSTEM = (
    "あなたはnoteのライターです。編集者からの指摘を踏まえて記事を修正して"
    "ください。出力は修正後の記事本文(Markdown)のみとし、指摘への返答や"
    "前置きは書かないこと。"
)


def _describe_pattern(pattern: Pattern) -> str:
    return (
        f"- [{pattern.pattern_id}] "
        f"hook={pattern.hook_pattern} / "
        f"problem_framing={pattern.problem_framing_pattern} / "
        f"structure={pattern.structure_pattern} / "
        f"cta={pattern.cta_pattern} / "
        f"tone={pattern.tone} / "
        f"length={pattern.length_band}"
    )


@dataclass(frozen=True)
class Draft:
    topic: str
    body_markdown: str
    used_pattern_ids: list[str]
    revision_notes: list[str] = field(default_factory=list)


class ArticleWriter:
    """Stage 3 ("書く"): draft from stored patterns, then self-revise twice."""

    def __init__(self, llm: LLMClient) -> None:
        self._llm = llm

    def write(self, topic: str, patterns: list[Pattern], passes: int = 2) -> Draft:
        body = self._draft(topic, patterns)
        notes: list[str] = []
        for _ in range(passes):
            critique = self._critique(topic, body)
            notes.append(critique)
            body = self._revise(topic, body, critique)

        return Draft(
            topic=topic,
            body_markdown=body,
            used_pattern_ids=[p.pattern_id for p in patterns],
            revision_notes=notes,
        )

    def _draft(self, topic: str, patterns: list[Pattern]) -> str:
        patterns_desc = "\n".join(_describe_pattern(p) for p in patterns) or "(なし)"
        prompt = (
            f"トピック: {topic}\n\n参考にする型:\n{patterns_desc}\n\n"
            "上記の型を踏まえて記事本文を書いてください。"
        )
        return self._llm.complete(_DRAFT_SYSTEM, prompt)

    def _critique(self, topic: str, body: str) -> str:
        prompt = f"トピック: {topic}\n\n記事:\n{body}"
        return self._llm.complete(_CRITIQUE_SYSTEM, prompt)

    def _revise(self, topic: str, body: str, critique: str) -> str:
        prompt = (
            f"トピック: {topic}\n\n元の記事:\n{body}\n\n"
            f"編集者の指摘:\n{critique}\n\n修正後の記事本文を出力してください。"
        )
        return self._llm.complete(_REVISE_SYSTEM, prompt)
