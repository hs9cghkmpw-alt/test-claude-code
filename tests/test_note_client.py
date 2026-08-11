import json
from datetime import datetime, timezone

import pytest

from note_writer.note_client import HttpNoteClient, NoteParsingError


def _page_html(notes: list[dict]) -> str:
    payload = {"props": {"pageProps": {"notes": notes}}}
    return (
        "<html><body>"
        f'<script id="__NEXT_DATA__" type="application/json">{json.dumps(payload)}</script>'
        "</body></html>"
    )


def _note(key: str, published_at: str, likes: int) -> dict:
    return {
        "noteUrl": f"https://note.com/someone/n/{key}",
        "name": f"title-{key}",
        "user": {"nickname": "someone"},
        "publishAt": published_at,
        "likeCount": likes,
    }


def test_lists_notes_within_window():
    notes = [
        _note("a", "2026-01-20T00:00:00+00:00", 10),
        _note("b", "2026-01-10T00:00:00+00:00", 20),
    ]
    html = _page_html(notes)
    client = HttpNoteClient(fetch_fn=lambda url, timeout: html)

    since = datetime(2026, 1, 1, tzinfo=timezone.utc)
    until = datetime(2026, 1, 31, tzinfo=timezone.utc)
    results = list(client.list_hashtag_notes("python", since=since, until=until, max_pages=1))

    assert [a.url for a in results] == [
        "https://note.com/someone/n/a",
        "https://note.com/someone/n/b",
    ]
    assert results[0].like_count == 10
    assert results[0].tag == "python"


def test_stops_once_older_than_since():
    notes = [
        _note("a", "2026-01-20T00:00:00+00:00", 10),
        _note("old", "2025-01-01T00:00:00+00:00", 999),
    ]
    html = _page_html(notes)
    client = HttpNoteClient(fetch_fn=lambda url, timeout: html)

    since = datetime(2026, 1, 1, tzinfo=timezone.utc)
    until = datetime(2026, 1, 31, tzinfo=timezone.utc)
    results = list(client.list_hashtag_notes("python", since=since, until=until, max_pages=5))

    assert [a.url for a in results] == ["https://note.com/someone/n/a"]


def test_missing_next_data_raises():
    client = HttpNoteClient(fetch_fn=lambda url, timeout: "<html></html>")
    since = datetime(2026, 1, 1, tzinfo=timezone.utc)
    until = datetime(2026, 1, 31, tzinfo=timezone.utc)

    with pytest.raises(NoteParsingError):
        list(client.list_hashtag_notes("python", since=since, until=until, max_pages=1))


def test_unknown_shape_raises_actionable_error():
    payload = {"props": {"pageProps": {"somethingElse": []}}}
    html = (
        "<html><body>"
        f'<script id="__NEXT_DATA__" type="application/json">{json.dumps(payload)}</script>'
        "</body></html>"
    )
    client = HttpNoteClient(fetch_fn=lambda url, timeout: html)
    since = datetime(2026, 1, 1, tzinfo=timezone.utc)
    until = datetime(2026, 1, 31, tzinfo=timezone.utc)

    with pytest.raises(NoteParsingError):
        list(client.list_hashtag_notes("python", since=since, until=until, max_pages=1))


def test_get_note_body():
    payload = {"props": {"pageProps": {"note": {"body": "abstracted-analysis-only-in-tests"}}}}
    html = (
        "<html><body>"
        f'<script id="__NEXT_DATA__" type="application/json">{json.dumps(payload)}</script>'
        "</body></html>"
    )
    client = HttpNoteClient(fetch_fn=lambda url, timeout: html)
    assert client.get_note_body("https://note.com/someone/n/a") == (
        "abstracted-analysis-only-in-tests"
    )
