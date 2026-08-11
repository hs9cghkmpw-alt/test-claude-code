from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from note_writer.config import PipelineConfig
from note_writer.fetch_state import FetchStateStore
from note_writer.llm import AnthropicLLMClient
from note_writer.note_client import HttpNoteClient
from note_writer.patterns import PatternStore
from note_writer.pipeline import Pipeline
from note_writer.robots import RobotsChecker
from note_writer.usage_tracker import UsageTracker


def _build_pipeline(args: argparse.Namespace) -> Pipeline:
    data_dir = Path(args.data_dir)
    config = PipelineConfig(
        tag=args.tag,
        days_back=args.days,
        fetch_interval_hours=args.fetch_interval_hours,
        min_likes_floor=args.min_likes,
        min_total_score=args.min_score,
    )
    client = HttpNoteClient()
    robots = RobotsChecker(user_agent=config.user_agent)
    fetch_state = FetchStateStore(data_dir / "fetch_state.json")
    pattern_store = PatternStore(data_dir / "patterns.db")
    llm = AnthropicLLMClient(model=args.model)
    return Pipeline(config, client, robots, fetch_state, pattern_store, llm)


def _cmd_collect(args: argparse.Namespace) -> int:
    pipeline = _build_pipeline(args)
    articles = pipeline.collect()
    payload = [
        {
            "url": a.url,
            "title": a.title,
            "author": a.author,
            "published_at": a.published_at.isoformat(),
            "like_count": a.like_count,
            "tag": a.tag,
        }
        for a in articles
    ]
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"{len(articles)} article(s) collected", file=sys.stderr)
    return 0


def _cmd_distill(args: argparse.Namespace) -> int:
    pipeline = _build_pipeline(args)
    with open(args.input, encoding="utf-8") as f:
        raw_articles = json.load(f)

    from datetime import datetime

    from note_writer.note_client import NoteArticle

    articles = [
        NoteArticle(
            url=a["url"],
            title=a["title"],
            author=a["author"],
            published_at=datetime.fromisoformat(a["published_at"]),
            like_count=a["like_count"],
            tag=a["tag"],
        )
        for a in raw_articles
    ]
    patterns = pipeline.distill(articles)
    print(f"{len(patterns)} pattern(s) saved to patterns.db", file=sys.stderr)
    for p in patterns:
        print(f"  {p.pattern_id} (score={p.source_score_total})", file=sys.stderr)
    return 0


def _cmd_write(args: argparse.Namespace) -> int:
    pipeline = _build_pipeline(args)
    draft = pipeline.write(args.topic, pattern_limit=args.pattern_limit)
    print(draft.body_markdown)
    print(
        f"used patterns: {', '.join(draft.used_pattern_ids) or '(none)'}",
        file=sys.stderr,
    )
    return 0


def _cmd_record_likes(args: argparse.Namespace) -> int:
    tracker = UsageTracker(Path(args.data_dir) / "usage.json")
    if args.publish:
        tracker.record_publication(
            article_id=args.article_id,
            topic=args.topic or "",
            used_pattern_ids=args.pattern.split(",") if args.pattern else [],
            published_url=args.url,
        )
        print(f"recorded publication for {args.article_id}", file=sys.stderr)
    if args.likes is not None:
        tracker.record_likes(args.article_id, args.likes)
        print(f"recorded {args.likes} likes for {args.article_id}", file=sys.stderr)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="note-writer")
    parser.add_argument("--data-dir", default="./data", help="state/pattern storage dir")
    parser.add_argument("--model", default="claude-sonnet-5")
    sub = parser.add_subparsers(dest="command", required=True)

    collect_p = sub.add_parser("collect", help="集める: gather qualifying articles")
    collect_p.add_argument("--tag", required=True)
    collect_p.add_argument("--days", type=int, default=30)
    collect_p.add_argument("--fetch-interval-hours", type=float, default=6.0)
    collect_p.add_argument("--min-likes", type=int, default=30)
    collect_p.add_argument("--min-score", type=int, default=60)
    collect_p.set_defaults(func=_cmd_collect)

    distill_p = sub.add_parser(
        "distill", help="共通点を出す: score articles and save abstracted patterns"
    )
    distill_p.add_argument("--tag", required=True)
    distill_p.add_argument("--input", required=True, help="JSON from `collect`")
    distill_p.add_argument("--days", type=int, default=30)
    distill_p.add_argument("--fetch-interval-hours", type=float, default=6.0)
    distill_p.add_argument("--min-likes", type=int, default=30)
    distill_p.add_argument("--min-score", type=int, default=60)
    distill_p.set_defaults(func=_cmd_distill)

    write_p = sub.add_parser("write", help="書く: draft + 2-pass self-review")
    write_p.add_argument("--tag", required=True, help="used to size the pipeline config")
    write_p.add_argument("--topic", required=True)
    write_p.add_argument("--pattern-limit", type=int, default=5)
    write_p.add_argument("--days", type=int, default=30)
    write_p.add_argument("--fetch-interval-hours", type=float, default=6.0)
    write_p.add_argument("--min-likes", type=int, default=30)
    write_p.add_argument("--min-score", type=int, default=60)
    write_p.set_defaults(func=_cmd_write)

    likes_p = sub.add_parser(
        "record-likes", help="record which patterns an article used and/or its like count"
    )
    likes_p.add_argument("--article-id", required=True)
    likes_p.add_argument("--publish", action="store_true", help="register a new publication")
    likes_p.add_argument("--topic")
    likes_p.add_argument("--url")
    likes_p.add_argument("--pattern", help="comma-separated pattern ids used")
    likes_p.add_argument("--likes", type=int, help="current like count to append")
    likes_p.set_defaults(func=_cmd_record_likes)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
