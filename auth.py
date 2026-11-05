"""Bounded, short-lived dashboard credentials kept only in process memory."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import secrets
import time
from typing import Callable


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


@dataclass(slots=True)
class Session:
    user: dict
    csrf: str
    expires: float
    oauth_token: str = ""
    verified_at: float = 0


class AuthStore:
    CODE_TTL = 5 * 60
    SESSION_TTL = 8 * 60 * 60
    MAX_RECORDS = 2048

    def __init__(self, clock: Callable[[], float] = time.monotonic):
        self.clock = clock
        self.codes: dict[str, tuple[str, float]] = {}
        self.sessions: dict[str, Session] = {}
        self.transactions: dict[str, tuple[str, float]] = {}

    def prune(self) -> None:
        now = self.clock()
        for mapping in (self.codes, self.transactions):
            for key, (_, expiry) in list(mapping.items()):
                if expiry <= now:
                    mapping.pop(key, None)
        for key, session in list(self.sessions.items()):
            if session.expires <= now:
                self.sessions.pop(key, None)

    @classmethod
    def _bound(cls, mapping: dict) -> None:
        while len(mapping) >= cls.MAX_RECORDS:
            mapping.pop(next(iter(mapping)))

    def issue_code(self, user_id: str) -> str:
        self.prune()
        # A new private link supersedes this user's previous unredeemed link.
        for key, (owner, _) in list(self.codes.items()):
            if owner == user_id:
                self.codes.pop(key, None)
        token = secrets.token_urlsafe(32)
        self._bound(self.codes)
        self.codes[digest(token)] = (user_id, self.clock() + self.CODE_TTL)
        return token

    def consume_code(self, token: str) -> str | None:
        self.prune()
        value = self.codes.pop(digest(token), None)
        return value[0] if value else None

    def create_session(self, user: dict, *, oauth_token: str = "") -> tuple[str, Session]:
        self.prune()
        token = secrets.token_urlsafe(32)
        now = self.clock()
        session = Session(dict(user), secrets.token_urlsafe(32), now + self.SESSION_TTL,
                          oauth_token, now)
        self._bound(self.sessions)
        self.sessions[digest(token)] = session
        return token, session

    def get_session(self, token: str) -> Session | None:
        self.prune()
        return self.sessions.get(digest(token))

    def revoke(self, token: str) -> None:
        self.sessions.pop(digest(token), None)

    def transaction(self) -> tuple[str, str]:
        self.prune()
        state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(48)
        self._bound(self.transactions)
        self.transactions[digest(state)] = (verifier, self.clock() + self.CODE_TTL)
        return state, verifier

    def consume_transaction(self, state: str) -> str | None:
        self.prune()
        value = self.transactions.pop(digest(state), None)
        return value[0] if value else None

    def clear(self) -> None:
        self.codes.clear()
        self.sessions.clear()
        self.transactions.clear()
