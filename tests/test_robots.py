from note_writer.robots import RobotsChecker

ROBOTS_TXT = """
User-agent: *
Disallow: /private/
Allow: /
"""


def test_allows_permitted_path():
    checker = RobotsChecker("test-agent", fetch_fn=lambda url: ROBOTS_TXT)
    assert checker.is_allowed("https://note.com/hashtag/python") is True


def test_disallows_blocked_path():
    checker = RobotsChecker("test-agent", fetch_fn=lambda url: ROBOTS_TXT)
    assert checker.is_allowed("https://note.com/private/secret") is False


def test_fails_closed_when_robots_txt_unreachable():
    def raise_fetch(url):
        raise ConnectionError("boom")

    checker = RobotsChecker("test-agent", fetch_fn=raise_fetch)
    assert checker.is_allowed("https://note.com/hashtag/python") is False


def test_caches_parser_per_host():
    calls = []

    def counting_fetch(url):
        calls.append(url)
        return ROBOTS_TXT

    checker = RobotsChecker("test-agent", fetch_fn=counting_fetch)
    checker.is_allowed("https://note.com/a")
    checker.is_allowed("https://note.com/b")
    assert len(calls) == 1


def test_rejects_non_http_scheme():
    checker = RobotsChecker("test-agent", fetch_fn=lambda url: ROBOTS_TXT)
    assert checker.is_allowed("ftp://note.com/x") is False
