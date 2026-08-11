from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Iterator, Protocol

_NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.DOTALL
)

# Candidate dotted paths, tried in order, to the list of note records inside
# note.com's embedded __NEXT_DATA__ JSON on a hashtag page. note.com's actual
# page-data shape is NOT verified against a live response -- this sandbox has
# no outbound network access to note.com to confirm it. Before relying on
# HttpNoteClient in production, fetch a real hashtag page, inspect its
# __NEXT_DATA__ JSON, and update this list (or pass a custom
# `note_list_extractor` to HttpNoteClient) to match reality.
DEFAULT_NOTE_LIST_PATHS: tuple[str, ...] = (
    "props.pageProps.notes",
    "props.pageProps.hashtag.notes",
    "props.pageProps.hashtagNotes.notes",
    "props.pageProps.initialState.hashtag.notes",
)

# Same caveat as DEFAULT_NOTE_LIST_PATHS: unverified against a live note
# detail page. The body is used transiently for scoring only -- callers
# must never persist what this returns (see patterns.py).
DEFAULT_BODY_PATHS: tuple[str, ...] = (
    "props.pageProps.note.body",
    "props.pageProps.initialState.note.body",
)


class NoteParsingError(RuntimeError):
    """Raised when a note.com page's embedded data doesn't match any known shape."""


@dataclass(frozen=True)
class NoteArticle:
    url: str
    title: str
    author: str
    published_at: datetime
    like_count: int
    tag: str


class NoteClient(Protocol):
    def list_hashtag_notes(
        self,
        tag: str,
        since: datetime,
        until: datetime,
        max_pages: int,
    ) -> Iterator[NoteArticle]: ...

    def get_note_body(self, url: str) -> str:
        """Fetch an article's body text for transient scoring use only.

        Callers must not persist the returned text -- only abstracted
        pattern data derived from it may be stored (see patterns.py).
        """
        ...


def _get_path(data: dict, dotted_path: str) -> object | None:
    node: object = data
    for key in dotted_path.split("."):
        if not isinstance(node, dict) or key not in node:
            return None
        node = node[key]
    return node


def _default_note_list_extractor(data: dict) -> list[dict]:
    for path in DEFAULT_NOTE_LIST_PATHS:
        node = _get_path(data, path)
        if isinstance(node, list):
            return node
    raise NoteParsingError(
        "Could not find a note list in __NEXT_DATA__ at any of the known "
        f"candidate paths {DEFAULT_NOTE_LIST_PATHS}. note.com's page data "
        "shape may have changed -- inspect the JSON and pass a custom "
        "note_list_extractor to HttpNoteClient."
    )


def _default_record_to_article(record: dict, tag: str) -> NoteArticle:
    try:
        url = record["noteUrl"] if "noteUrl" in record else record["url"]
        title = record.get("name") or record.get("title") or ""
        author = (record.get("user") or {}).get("nickname") or record.get(
            "author", ""
        )
        published_raw = record.get("publishAt") or record.get("published_at")
        like_count = int(record.get("likeCount", record.get("like_count", 0)))
    except KeyError as exc:
        raise NoteParsingError(f"note record missing expected field: {exc}") from exc

    if not url or not published_raw:
        raise NoteParsingError(f"note record missing url/publishAt: {record!r}")

    published_at = datetime.fromisoformat(published_raw)
    return NoteArticle(
        url=url,
        title=title,
        author=author,
        published_at=published_at,
        like_count=like_count,
        tag=tag,
    )


def _default_fetch(url: str, timeout: float) -> str:
    import requests

    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    return resp.text


class HttpNoteClient:
    """Scrapes note.com hashtag pages for recent notes.

    Parses the Next.js ``__NEXT_DATA__`` JSON blob embedded in the page
    rather than screen-scraping rendered HTML, since note.com is a
    client-rendered SPA. See the module-level caveat on
    ``DEFAULT_NOTE_LIST_PATHS`` about verifying this against a live page.
    """

    def __init__(
        self,
        fetch_fn: Callable[[str, float], str] | None = None,
        timeout: float = 15.0,
        note_list_extractor: Callable[[dict], list[dict]] | None = None,
        record_to_article: Callable[[dict, str], NoteArticle] | None = None,
        body_extractor: Callable[[dict], str] | None = None,
    ) -> None:
        self._fetch_fn = fetch_fn or _default_fetch
        self._timeout = timeout
        self._extract_note_list = note_list_extractor or _default_note_list_extractor
        self._to_article = record_to_article or _default_record_to_article
        self._extract_body = body_extractor or self._default_body_extractor

    def list_hashtag_notes(
        self,
        tag: str,
        since: datetime,
        until: datetime,
        max_pages: int = 10,
    ) -> Iterator[NoteArticle]:
        for page in range(1, max_pages + 1):
            page_url = f"https://note.com/hashtag/{tag}?page={page}"
            html = self._fetch_fn(page_url, self._timeout)
            data = self._extract_next_data(html, page_url)
            records = self._extract_note_list(data)
            if not records:
                return

            got_any_in_window = False
            for record in records:
                article = self._to_article(record, tag)
                if article.published_at > until:
                    continue
                if article.published_at < since:
                    # note.com hashtag pages are sorted newest-first, so once
                    # we're past the window there's nothing older worth a
                    # later page either.
                    return
                got_any_in_window = True
                yield article

            if not got_any_in_window:
                return

    def get_note_body(self, url: str) -> str:
        html = self._fetch_fn(url, self._timeout)
        data = self._extract_next_data(html, url)
        return self._extract_body(data)

    @staticmethod
    def _default_body_extractor(data: dict) -> str:
        for path in DEFAULT_BODY_PATHS:
            node = _get_path(data, path)
            if isinstance(node, str):
                return node
        raise NoteParsingError(
            "Could not find article body in __NEXT_DATA__ at any of the "
            f"known candidate paths {DEFAULT_BODY_PATHS}. Pass a custom "
            "body_extractor to HttpNoteClient."
        )

    @staticmethod
    def _extract_next_data(html: str, source_url: str) -> dict:
        match = _NEXT_DATA_RE.search(html)
        if not match:
            raise NoteParsingError(
                f"__NEXT_DATA__ script tag not found on {source_url}"
            )
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError as exc:
            raise NoteParsingError(
                f"__NEXT_DATA__ on {source_url} was not valid JSON: {exc}"
            ) from exc
