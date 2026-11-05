"""Authenticated web controls sharing the running bot's locks and storage."""

from __future__ import annotations

import asyncio
import base64
from dataclasses import asdict
import hashlib
import hmac
import logging
from pathlib import Path
import time
from urllib.parse import urlencode, urlsplit
from uuid import UUID, uuid4

import aiohttp
from aiohttp import web

from commands import _recent_video
from models import Subscription, utcnow
from services.store import DuplicateSubscription, SubscriptionLimitReached
from services.youtube import YouTubeError
import ui
from yapper_api import APIError

from .auth import AuthStore, Session


log = logging.getLogger(__name__)
STATIC = Path(__file__).resolve().parent / "static"
OAUTH_ORIGIN = "https://www.yapin.gg"
SESSION_COOKIE = "maki_session"
STATE_COOKIE = "maki_oauth"


class DashboardError(Exception):
    def __init__(self, status: int, message: str):
        self.status, self.message = status, message
        super().__init__(message)


def _uuid(value: str, label: str = "Server") -> str:
    try:
        if not isinstance(value, str) or str(UUID(value)) != value:
            raise ValueError
    except (ValueError, AttributeError):
        raise DashboardError(400, f"{label} ID must be a canonical UUID.") from None
    return value


def _profile(value: dict, expected: str | None = None) -> dict:
    if not isinstance(value, dict):
        raise DashboardError(502, "Yapper returned an invalid identity.")
    user_id = _uuid(value.get("id"), "User")
    if expected is not None and user_id != expected:
        raise DashboardError(401, "Your Yapper identity changed. Sign in again.")
    avatar = value.get("avatar_url")
    if not isinstance(avatar, str) or not avatar.startswith(("https://", "/")) or avatar.startswith("//"):
        avatar = None
    return {"id": user_id, "username": str(value.get("username") or "Yapper member")[:100],
            "display_name": str(value.get("display_name") or value.get("username") or "Yapper member")[:100],
            "avatar_url": avatar}


class Dashboard:
    def __init__(self, app):
        self.bot = app
        self.config = app.config
        self.public_url = self.config.dashboard_public_url.rstrip("/")
        parsed = urlsplit(self.public_url)
        self.origin = f"{parsed.scheme}://{parsed.netloc}"
        self.secure = parsed.scheme == "https"
        self.auth = AuthStore()
        self.runner: web.AppRunner | None = None
        self.site: web.TCPSite | None = None
        self._permissions = asyncio.Semaphore(4)
        self._lookup_slots = asyncio.Semaphore(4)
        self._attempts: dict[str, list[float]] = {}
        self.web_app = web.Application(middlewares=[self._errors], client_max_size=32 * 1024)
        self.web_app.add_routes([
            web.get("/", self.index), web.get("/health", self.health),
            web.get("/api/session", self.session_info),
            web.get("/auth/login", self.oauth_login), web.get("/auth/callback", self.oauth_callback),
            web.post("/auth/pair", self.pair), web.post("/auth/logout", self.logout),
            web.get("/api/servers", self.servers),
            web.get("/api/servers/{server_id}", self.server),
            web.post("/api/servers/{server_id}/resolve", self.resolve),
            web.post("/api/servers/{server_id}/subscriptions", self.add),
            web.patch("/api/servers/{server_id}/subscriptions/{sub_id}", self.edit),
            web.delete("/api/servers/{server_id}/subscriptions/{sub_id}", self.remove),
            web.post("/api/servers/{server_id}/subscriptions/{sub_id}/{action}", self.action),
            web.put("/api/servers/{server_id}/premium", self.premium),
        ])
        if STATIC.is_dir():
            self.web_app.router.add_static("/static/", STATIC, show_index=False)

    @property
    def oauth_enabled(self) -> bool:
        return bool(self.config.yapper_oauth_client_id and self.config.yapper_oauth_client_secret)

    async def start(self) -> None:
        if self.runner is not None:
            return
        self.runner = web.AppRunner(self.web_app, access_log=None)
        try:
            await self.runner.setup()
            self.site = web.TCPSite(self.runner, self.config.dashboard_host, self.config.dashboard_port)
            await self.site.start()
        except BaseException:
            await self.close()
            raise
        log.info("Maki dashboard available at %s", self.public_url)

    async def close(self) -> None:
        runner, self.runner = self.runner, None
        self.site = None
        if runner is not None:
            await runner.cleanup()
        self.auth.clear()

    def issue_login(self, user_id: str) -> str:
        return self.public_url + "/#code=" + self.auth.issue_code(_uuid(user_id, "User"))

    @web.middleware
    async def _errors(self, request: web.Request, handler):
        try:
            response = await handler(request)
        except DashboardError as exc:
            response = web.json_response({"error": exc.message}, status=exc.status)
        except (DuplicateSubscription, SubscriptionLimitReached) as exc:
            response = web.json_response({"error": str(exc)[:500]}, status=409)
        except YouTubeError as exc:
            response = web.json_response({"error": str(exc)[:500]}, status=422)
        except ValueError as exc:
            response = web.json_response({"error": str(exc)[:500]}, status=400)
        except APIError as exc:
            status = 503 if exc.status not in {403, 404, 429} else exc.status
            response = web.json_response({"error": "Yapper could not complete this request. Please try again shortly."}, status=status)
        except web.HTTPException as exc:
            if 300 <= exc.status < 400:
                response = web.Response(status=exc.status, headers=exc.headers)
            else:
                response = web.json_response({"error": exc.reason}, status=exc.status)
        except Exception as exc:
            # Avoid logging URLs, OAuth credentials, or inbound message bodies.
            log.warning("Dashboard request failed (%s).", type(exc).__name__)
            response = web.json_response({"error": "Maki could not complete that request."}, status=500)
        response.headers.update({
            "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
            "X-Frame-Options": "DENY", "Cache-Control": "no-store",
            "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; "
                                       "img-src 'self' https: data:; connect-src 'self'; "
                                       "font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        })
        if self.secure:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    def _origin(self, request: web.Request) -> None:
        if request.headers.get("Origin") != self.origin:
            raise DashboardError(403, "This request must come from the Maki dashboard.")

    async def _session(self, request: web.Request, *, required: bool = True) -> Session | None:
        token = request.cookies.get(SESSION_COOKIE, "")
        session = self.auth.get_session(token)
        if session is None:
            if required:
                raise DashboardError(401, "Sign in to Maki to continue.")
            return None
        if session.oauth_token and self.auth.clock() - session.verified_at >= 120:
            try:
                user = await self._oauth_identity(session.oauth_token)
                session.user = _profile(user, session.user["id"])
            except DashboardError as exc:
                if exc.status == 401:
                    self.auth.revoke(token)
                raise
            session.verified_at = self.auth.clock()
        return session

    async def _write_session(self, request: web.Request) -> Session:
        self._origin(request)
        session = await self._session(request)
        csrf = request.headers.get("X-CSRF-Token", "")
        if not hmac.compare_digest(csrf, session.csrf):
            raise DashboardError(403, "Your security token expired. Refresh the dashboard.")
        return session

    async def _body(self, request: web.Request, allowed: set[str]) -> dict:
        if request.content_type != "application/json":
            raise DashboardError(415, "Send a JSON request.")
        try:
            body = await request.json()
        except (ValueError, UnicodeError):
            raise DashboardError(400, "The request is not valid JSON.") from None
        if not isinstance(body, dict) or body.keys() - allowed:
            raise DashboardError(400, "The request contains unsupported fields.")
        return body

    def _cookie(self, response: web.StreamResponse, name: str, value: str, age: int) -> None:
        response.set_cookie(name, value, max_age=age, path="/", secure=self.secure,
                            httponly=True, samesite="Lax")

    def _authenticated(self, user: dict, *, oauth_token: str = "") -> web.Response:
        token, session = self.auth.create_session(user, oauth_token=oauth_token)
        response = web.json_response({"ok": True, "user": session.user, "csrf_token": session.csrf})
        self._cookie(response, SESSION_COOKIE, token, self.auth.SESSION_TTL)
        return response

    def _rate_pair(self, request: web.Request) -> None:
        now = time.monotonic()
        for key, values in list(self._attempts.items()):
            active = [stamp for stamp in values if stamp > now - 60]
            if active:
                self._attempts[key] = active
            else:
                self._attempts.pop(key, None)
        key = request.remote or "unknown"
        values = self._attempts.setdefault(key, [])
        if len(values) >= 20:
            raise DashboardError(429, "Too many sign-in attempts. Wait a minute and try again.")
        if len(self._attempts) > 2048:
            self._attempts.pop(next(iter(self._attempts)))
        values.append(now)

    async def index(self, request):
        return web.FileResponse(STATIC / "index.html")

    async def health(self, request):
        return web.json_response({"status": "ok", "service": "maki-dashboard"})

    async def session_info(self, request):
        session = await self._session(request, required=False)
        return web.json_response({
            "authenticated": session is not None, "user": session.user if session else None,
            "csrf_token": session.csrf if session else None,
            "oauth_enabled": self.oauth_enabled,
            "bot": {"id": self.bot.me.get("id"), "name": "Maki"},
            "support_url": ui.SUPPORT_URL,
            "is_bot_owner": bool(session and self.bot.commands._bot_owner(session.user["id"])),
        })

    async def pair(self, request):
        self._origin(request)
        self._rate_pair(request)
        body = await self._body(request, {"code"})
        code = body.get("code")
        if not isinstance(code, str) or not 20 <= len(code) <= 200:
            raise DashboardError(401, "That sign-in link is invalid or expired. Run /dashboard again.")
        user_id = self.auth.consume_code(code)
        if user_id is None:
            raise DashboardError(401, "That sign-in link is invalid or expired. Run /dashboard again.")
        result = await self.bot.api.request("GET", f"/users/{user_id}")
        user = _profile(result.get("user", result), user_id)
        old = request.cookies.get(SESSION_COOKIE, "")
        self.auth.revoke(old)
        return self._authenticated(user)

    async def logout(self, request):
        await self._write_session(request)
        self.auth.revoke(request.cookies.get(SESSION_COOKIE, ""))
        response = web.json_response({"ok": True})
        response.del_cookie(SESSION_COOKIE, path="/")
        return response

    async def oauth_login(self, request):
        if not self.oauth_enabled:
            raise DashboardError(503, "Yapper sign-in is not configured. Run /dashboard in Yapper for a private sign-in link.")
        state, verifier = self.auth.transaction()
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        query = urlencode({"client_id": self.config.yapper_oauth_client_id,
                           "redirect_uri": self.public_url + "/auth/callback", "response_type": "code",
                           "scope": "identify", "state": state,
                           "code_challenge": challenge, "code_challenge_method": "S256"})
        response = web.Response(status=302, headers={"Location": OAUTH_ORIGIN + "/oauth/authorize?" + query})
        self._cookie(response, STATE_COOKIE, state, self.auth.CODE_TTL)
        return response

    async def _oauth_request(self, url: str, *, token: str = "", data: dict | None = None) -> dict:
        headers = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = "Bearer " + token
        method = "POST" if data is not None else "GET"
        try:
            async with self.bot.api.session.request(method, url, data=data, headers=headers,
                                                    allow_redirects=False,
                                                    timeout=aiohttp.ClientTimeout(total=20)) as response:
                if response.status in {400, 401, 403}:
                    raise DashboardError(401, "Yapper sign-in expired or was declined. Please sign in again.")
                if response.status != 200:
                    raise DashboardError(503, "Yapper sign-in is temporarily unavailable.")
                result = await response.json(content_type=None)
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError):
            raise DashboardError(503, "Yapper sign-in is temporarily unavailable.") from None
        if not isinstance(result, dict):
            raise DashboardError(502, "Yapper returned an invalid sign-in response.")
        return result

    async def _oauth_identity(self, token: str) -> dict:
        return await self._oauth_request(OAUTH_ORIGIN + "/api/oauth/me", token=token)

    async def oauth_callback(self, request):
        if not self.oauth_enabled:
            raise DashboardError(503, "Yapper sign-in is not configured.")
        state = request.query.get("state", "")
        cookie = request.cookies.get(STATE_COOKIE, "")
        if not state or not cookie or not hmac.compare_digest(state, cookie):
            raise DashboardError(401, "The sign-in request could not be verified. Start sign-in again.")
        verifier = self.auth.consume_transaction(state)
        if verifier is None:
            raise DashboardError(401, "The sign-in request expired or was already used. Start again.")
        if request.query.get("error"):
            response = web.Response(status=302, headers={"Location": self.public_url + "/?login=cancelled"})
            response.del_cookie(STATE_COOKIE, path="/")
            return response
        code = request.query.get("code", "")
        if not code or len(code) > 4096:
            raise DashboardError(400, "Yapper did not return an authorization code.")
        result = await self._oauth_request(OAUTH_ORIGIN + "/api/oauth/token", data={
            "grant_type": "authorization_code", "code": code,
            "redirect_uri": self.public_url + "/auth/callback", "client_id": self.config.yapper_oauth_client_id,
            "client_secret": self.config.yapper_oauth_client_secret, "code_verifier": verifier,
        })
        token = result.get("access_token")
        if not isinstance(token, str) or not token or len(token) > 8192:
            raise DashboardError(502, "Yapper did not return a valid access token.")
        user = _profile(await self._oauth_identity(token))
        self.auth.revoke(request.cookies.get(SESSION_COOKIE, ""))
        session_token, _ = self.auth.create_session(user, oauth_token=token)
        response = web.Response(status=302, headers={"Location": self.public_url + "/"})
        self._cookie(response, SESSION_COOKIE, session_token, self.auth.SESSION_TTL)
        response.del_cookie(STATE_COOKIE, path="/")
        return response

    async def _server(self, server_id: str, session: Session) -> dict:
        _uuid(server_id)
        async with self._permissions:
            if not await self.bot.api.can_manage(server_id, session.user["id"]):
                raise DashboardError(403, "You need Manage Server permission in this server.")
            result = await self.bot.api.request("GET", f"/servers/{server_id}")
        server = result.get("server", result)
        if not isinstance(server, dict) or server.get("id") != server_id:
            raise DashboardError(404, "Maki cannot access that server.")
        return {"id": server_id, "name": str(server.get("name") or "Your server"),
                "icon_url": server.get("icon_url"), "owner_id": server.get("owner_id")}

    async def servers(self, request):
        session = await self._session(request)
        rows = await self.bot.api.servers()

        async def accessible(row):
            if not isinstance(row, dict):
                return None
            server_id = row.get("id")
            try:
                _uuid(server_id)
                server = await self._server(server_id, session)
            except DashboardError as exc:
                if exc.status in {400, 403, 404}:
                    return None
                raise
            except APIError as exc:
                if exc.status in {403, 404}:
                    return None
                raise
            server["plan"] = await self.bot.store.plan(server_id)
            return server

        values = await asyncio.gather(*(accessible(row) for row in rows))
        result = sorted([item for item in values if item], key=lambda item: item["name"].casefold())
        return web.json_response({"servers": result, "is_bot_owner": self.bot.commands._bot_owner(session.user["id"])})

    async def server(self, request):
        session = await self._session(request)
        server_id = request.match_info["server_id"]
        server = await self._server(server_id, session)
        channels, roles, subscriptions, plan = await asyncio.gather(
            self.bot.api.channels(server_id), self.bot.api.roles(server_id),
            self.bot.store.all(server_id), self.bot.store.plan(server_id),
        )
        channels = [row for row in channels if row.get("server_id") == server_id
                    and row.get("type", row.get("kind")) == "text"]
        return web.json_response({"server": server, "channels": channels, "roles": roles, "plan": plan,
                                  "subscriptions": [asdict(sub) for sub in subscriptions],
                                  "stats": {"active": sum(sub.enabled for sub in subscriptions),
                                            "delivered": sum(sub.delivered for sub in subscriptions),
                                            "pending": sum(len(sub.pending_videos) for sub in subscriptions),
                                            "last_check": self.bot.monitor.last_check},
                                  "is_bot_owner": self.bot.commands._bot_owner(session.user["id"])})

    async def resolve(self, request):
        session = await self._write_session(request)
        server_id = request.match_info["server_id"]
        await self._server(server_id, session)
        body = await self._body(request, {"identifier"})
        identifier = self._identifier(body.get("identifier"))
        async with self._lookup_slots:
            creator = await self.bot.youtube.resolve(identifier)
            videos = await self.bot.youtube.feed(creator.id)
        recent = _recent_video(videos)
        return web.json_response({"creator": asdict(creator), "latest": asdict(recent) if recent else None})

    @staticmethod
    def _identifier(value) -> str:
        if not isinstance(value, str) or not value.strip() or len(value) > 500:
            raise DashboardError(400, "Enter a YouTube handle, channel URL, or channel ID.")
        return value.strip()

    @staticmethod
    def _template(value) -> str:
        if not isinstance(value, str) or not value.strip() or len(value) > 2000:
            raise DashboardError(400, "Use a notification message between 1 and 2,000 characters.")
        return value.strip()

    async def _destination(self, server_id: str, destination_id) -> dict:
        _uuid(destination_id, "Channel")
        channels = await self.bot.api.channels(server_id)
        destination = next((row for row in channels if row.get("id") == destination_id
                            and row.get("server_id") == server_id
                            and row.get("type", row.get("kind")) == "text"), None)
        if destination is None:
            raise DashboardError(400, "Choose a text channel Maki can access in this server.")
        return destination

    async def add(self, request):
        session = await self._write_session(request)
        server_id = request.match_info["server_id"]
        await self._server(server_id, session)
        body = await self._body(request, {"identifier", "destination_id", "template"})
        identifier = self._identifier(body.get("identifier"))
        template = self._template(body.get("template", ui.DEFAULT_TEMPLATE))
        async with self.bot.commands._mutation_lock(server_id):
            destination = await self._destination(server_id, body.get("destination_id"))
            plan = await self.bot.store.plan(server_id)
            if self.bot.commands._plan_full(plan):
                raise SubscriptionLimitReached(plan["limit"], plan["premium"])
            async with self._lookup_slots:
                creator = await self.bot.youtube.resolve(identifier)
                videos = await self.bot.youtube.feed(creator.id)
            # Permission may have changed during slow public YouTube requests.
            await self._server(server_id, session)
            destination = await self._destination(server_id, body.get("destination_id"))
            recent, now = _recent_video(videos), utcnow()
            sub = Subscription(uuid4().hex, server_id, creator.id, creator.name,
                               destination["id"], destination.get("name") or "text-channel",
                               template, now, now, seen_ids=[video.id for video in videos],
                               last_video_id=recent.id if recent else None,
                               last_published_at=recent.published_at if recent else None,
                               page_baselined=True)
            saved = await self.bot.store.add(sub)
        return web.json_response({"subscription": asdict(saved)}, status=201)

    async def _subscription(self, server_id: str, sub_id: str) -> Subscription:
        if not sub_id or len(sub_id) > 100:
            raise DashboardError(404, "That subscription was not found in this server.")
        sub = await self.bot.store.get(sub_id, server_id)
        if sub is None:
            raise DashboardError(404, "That subscription was not found in this server.")
        return sub

    async def edit(self, request):
        session = await self._write_session(request)
        server_id, sub_id = request.match_info["server_id"], request.match_info["sub_id"]
        await self._server(server_id, session)
        body = await self._body(request, {"template", "destination_id"})
        if not body:
            raise DashboardError(400, "Choose a message or destination to update.")
        changes = {}
        if "template" in body:
            changes["template"] = self._template(body["template"])
        async with self.bot.commands._subscription_lock(sub_id, server_id):
            await self._subscription(server_id, sub_id)
            if "destination_id" in body:
                destination = await self._destination(server_id, body["destination_id"])
                changes.update(destination_id=destination["id"], destination_name=destination.get("name") or "text-channel")
            await self._server(server_id, session)
            saved = await self.bot.store.update(sub_id, server_id, **changes)
        return web.json_response({"subscription": asdict(saved)})

    async def remove(self, request):
        session = await self._write_session(request)
        server_id, sub_id = request.match_info["server_id"], request.match_info["sub_id"]
        await self._server(server_id, session)
        async with self.bot.commands._subscription_lock(sub_id, server_id):
            await self._subscription(server_id, sub_id)
            await self._server(server_id, session)
            await self.bot.store.remove(sub_id, server_id)
        return web.json_response({"ok": True})

    async def action(self, request):
        session = await self._write_session(request)
        server_id, sub_id = request.match_info["server_id"], request.match_info["sub_id"]
        await self._server(server_id, session)
        action = request.match_info["action"]
        if action not in {"pause", "resume", "test"}:
            raise DashboardError(404, "That action was not found.")
        body = await self._body(request, {"ping_roles"} if action == "test" else set())
        sub = await self._subscription(server_id, sub_id)

        async def still_permitted():
            await self._server(server_id, session)

        if action == "test":
            ping_roles = body.get("ping_roles", True)
            if type(ping_roles) is not bool:
                raise DashboardError(400, "Choose whether this test should enable role mentions.")
            await self.bot.commands._test(sub, ping_roles=ping_roles, before_send=still_permitted)
        else:
            await self.bot.commands._set_enabled(sub, action == "resume", before_update=still_permitted)
        current = await self._subscription(server_id, sub_id)
        return web.json_response({"ok": True, "subscription": asdict(current)})

    async def premium(self, request):
        session = await self._write_session(request)
        if not self.bot.commands._bot_owner(session.user["id"]):
            raise DashboardError(403, "Only Maki's bot owner can change server plans.")
        server_id = request.match_info["server_id"]
        await self._server(server_id, session)
        body = await self._body(request, {"tier"})
        tier = body.get("tier")
        if tier not in {"free", "standard", "unlimited"}:
            raise DashboardError(400, "Choose free, standard, or unlimited.")
        if tier == "free":
            await self.bot.store.remove_premium(server_id)
        else:
            await self.bot.store.set_premium(server_id, session.user["id"], tier=tier)
        return web.json_response({"ok": True, "plan": await self.bot.store.plan(server_id)})
