from __future__ import annotations

import urllib.robotparser as robotparser
from typing import Callable
from urllib.parse import urlparse

FetchFn = Callable[[str], str]


def _default_fetch(url: str, timeout: float = 15.0) -> str:
    import requests

    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    return resp.text


class RobotsChecker:
    """Gates URLs through robots.txt, per-host, with a fail-closed policy.

    If ``robots.txt`` cannot be fetched or parsed for a host, that host's
    URLs are treated as disallowed rather than allowed -- the spec asks for
    "URLs robots.txt permits", not "URLs we couldn't check".
    """

    def __init__(
        self,
        user_agent: str,
        fetch_fn: FetchFn | None = None,
        timeout: float = 15.0,
    ) -> None:
        self._user_agent = user_agent
        self._fetch_fn = fetch_fn or (lambda url: _default_fetch(url, timeout))
        self._parsers: dict[str, robotparser.RobotFileParser | None] = {}

    def is_allowed(self, url: str) -> bool:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            return False

        netloc = parsed.netloc
        if netloc not in self._parsers:
            self._parsers[netloc] = self._load_parser(parsed.scheme, netloc)

        parser = self._parsers[netloc]
        if parser is None:
            return False
        return parser.can_fetch(self._user_agent, url)

    def _load_parser(
        self, scheme: str, netloc: str
    ) -> robotparser.RobotFileParser | None:
        robots_url = f"{scheme}://{netloc}/robots.txt"
        try:
            raw = self._fetch_fn(robots_url)
        except Exception:
            return None

        parser = robotparser.RobotFileParser()
        parser.set_url(robots_url)
        parser.parse(raw.splitlines())
        return parser
