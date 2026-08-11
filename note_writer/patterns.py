from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from note_writer.llm import LLMClient
from note_writer.scorer import ArticleScore

# Fields intentionally hold only abstracted, structural descriptions (e.g.
# "a one-line personal-failure hook") -- never verbatim sentences. This is
# enforced structurally (the dataclass has no body/excerpt field at all) and
# defensively (a max length per field rejects accidental verbatim dumps).
_MAX_FIELD_LEN = 400


class PatternValidationError(ValueError):
    pass


@dataclass(frozen=True)
class Pattern:
    pattern_id: str
    source_tag: str
    source_url: str
    source_score_total: int
    hook_pattern: str
    problem_framing_pattern: str
    structure_pattern: str
    cta_pattern: str
    tone: str
    length_band: str
    extracted_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def __post_init__(self) -> None:
        for name, value in asdict(self).items():
            if isinstance(value, str) and len(value) > _MAX_FIELD_LEN:
                raise PatternValidationError(
                    f"field '{name}' is {len(value)} chars, over the "
                    f"{_MAX_FIELD_LEN}-char abstraction limit -- this looks "
                    "like verbatim article text, which must not be stored"
                )


_SYSTEM_PROMPT = (
    "あなたはnote記事の構造分析家です。与えられた記事本文から、他の記事にも"
    "転用できる「型」だけを抽象化して抜き出してください。固有名詞・具体的な"
    "エピソードの引用・原文の文章そのものは書かないこと。あくまで構造・"
    "パターンの説明にとどめること。出力は次のJSON形式のみ:\n"
    '{"hook_pattern": "", "problem_framing_pattern": "", '
    '"structure_pattern": "", "cta_pattern": "", "tone": "", '
    '"length_band": ""}'
)


class PatternExtractor:
    """Stage 2b: turn a high-scoring article into an abstracted, reusable pattern.

    The article body is passed to the LLM for analysis but is never written
    to the returned ``Pattern`` or to disk -- only the LLM's abstracted
    summary fields are kept.
    """

    def __init__(self, llm: LLMClient) -> None:
        self._llm = llm

    def extract(self, article_score: ArticleScore, body_text: str, pattern_id: str) -> Pattern:
        article = article_score.article
        prompt = f"タイトル: {article.title}\n\n本文:\n{body_text}"
        raw = self._llm.complete(_SYSTEM_PROMPT, prompt)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise PatternValidationError(
                f"LLM response was not JSON: {raw!r}"
            ) from exc

        required = {
            "hook_pattern",
            "problem_framing_pattern",
            "structure_pattern",
            "cta_pattern",
            "tone",
            "length_band",
        }
        missing = required - payload.keys()
        if missing:
            raise PatternValidationError(f"response missing fields: {sorted(missing)}")

        return Pattern(
            pattern_id=pattern_id,
            source_tag=article.tag,
            source_url=article.url,
            source_score_total=article_score.total,
            **{k: str(payload[k]) for k in required},
        )


class PatternStore:
    """SQLite-backed store for abstracted patterns only (no article bodies)."""

    def __init__(self, path: Path | str) -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self._path)
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS patterns (
                pattern_id TEXT PRIMARY KEY,
                source_tag TEXT NOT NULL,
                source_url TEXT NOT NULL,
                source_score_total INTEGER NOT NULL,
                hook_pattern TEXT NOT NULL,
                problem_framing_pattern TEXT NOT NULL,
                structure_pattern TEXT NOT NULL,
                cta_pattern TEXT NOT NULL,
                tone TEXT NOT NULL,
                length_band TEXT NOT NULL,
                extracted_at TEXT NOT NULL
            )
            """
        )
        self._conn.commit()

    def save(self, pattern: Pattern) -> None:
        row = asdict(pattern)
        self._conn.execute(
            f"""
            INSERT OR REPLACE INTO patterns ({", ".join(row)})
            VALUES ({", ".join("?" for _ in row)})
            """,
            list(row.values()),
        )
        self._conn.commit()

    def all(self) -> list[Pattern]:
        cursor = self._conn.execute(
            "SELECT * FROM patterns ORDER BY extracted_at DESC"
        )
        columns = [d[0] for d in cursor.description]
        return [Pattern(**dict(zip(columns, row))) for row in cursor.fetchall()]

    def top(self, limit: int) -> list[Pattern]:
        cursor = self._conn.execute(
            "SELECT * FROM patterns ORDER BY source_score_total DESC, extracted_at DESC LIMIT ?",
            (limit,),
        )
        columns = [d[0] for d in cursor.description]
        return [Pattern(**dict(zip(columns, row))) for row in cursor.fetchall()]

    def close(self) -> None:
        self._conn.close()
