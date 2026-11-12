"""AgriDirect AI API (FastAPI). Run from the backend folder:

    uvicorn app.main:app --port 8000

Interactive API docs: http://localhost:8000/docs
"""
from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import errors
from .config import settings
from .db import SessionLocal, init_db
from .routers import admin, auth, deals, insights, marketplace

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("agridirect")
API = "/api/v1"


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    if settings.jwt_secret.startswith("dev-only"):
        log.warning("JWT_SECRET is the development default. Set a real secret in backend/.env before deploying.")
    if settings.seed_demo:
        from .seed import seed_demo

        with SessionLocal() as db:
            if seed_demo(db):
                log.info("Demo accounts and listings loaded.")
    from ml.pipeline import bootstrap, start_scheduler

    bootstrap()
    scheduler = start_scheduler() if settings.enable_scheduler else None
    print(f"\nAgriDirect API ready  |  OTP mode: {settings.otp_mode}  |  data mode: {settings.data_mode}  |  docs: http://localhost:8000/docs\n", flush=True)
    yield
    if scheduler:
        scheduler.stop_event.set()  # type: ignore[attr-defined]


app = FastAPI(title="AgriDirect AI API", version="1.0.0", lifespan=lifespan, docs_url="/docs", openapi_url="/openapi.json")
errors.install(app)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["Authorization", "Content-Type"])

# --- simple in-memory rate limiting (per client, sliding 60 s window) --------
_RATE = {"/auth/otp/": settings.rate_limit_otp_per_min, "": settings.rate_limit_per_min}
_hits: dict[tuple[str, str], deque] = defaultdict(deque)


def _client_key(request: Request) -> str:
    peer = request.client.host if request.client else "?"
    # Behind the Next.js dev proxy every request comes from loopback; trust its X-Forwarded-For.
    if peer in ("127.0.0.1", "::1") and (fwd := request.headers.get("x-forwarded-for")):
        return fwd.split(",")[0].strip()
    return peer


@app.middleware("http")
async def security_and_rate_limit(request: Request, call_next):
    path = request.url.path
    if path.startswith(API):
        bucket = "/auth/otp/" if "/auth/otp/" in path else ""
        q = _hits[(_client_key(request), bucket)]
        now = time.monotonic()
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= _RATE[bucket]:
            return errors.problem(429, "rate_limited")
        q.append(now)
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if path.startswith(API) and not path.startswith(f"{API}/uploads"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


for r in (auth.router, insights.router, marketplace.router, deals.router, admin.router):
    app.include_router(r, prefix=API)

settings.upload_dir.mkdir(parents=True, exist_ok=True)
app.mount(f"{API}/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok"}
