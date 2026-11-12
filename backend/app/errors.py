"""RFC 7807 problem responses. `code` is the i18n key the frontend shows."""
from __future__ import annotations

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

TITLES = {400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 409: "Conflict", 410: "Gone", 413: "Payload Too Large", 422: "Unprocessable Entity", 429: "Too Many Requests", 500: "Internal Server Error"}


class ApiError(Exception):
    def __init__(self, status: int, code: str, detail: str | None = None):
        super().__init__(code)
        self.status = status
        self.code = code
        self.detail = detail


def problem(status: int, code: str, detail: str | None = None) -> JSONResponse:
    body = {"type": "about:blank", "title": TITLES.get(status, "Error"), "status": status, "code": code}
    if detail:
        body["detail"] = detail
    return JSONResponse(body, status_code=status, media_type="application/problem+json")


def install(app) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError):
        return problem(exc.status, exc.code, exc.detail)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        where = ".".join(str(p) for p in first.get("loc", []) if p != "body")
        return problem(422, "invalid_request", f"{where}: {first.get('msg', 'invalid')}" if where else None)

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):  # never leak internals to clients
        import logging

        logging.getLogger("agridirect").exception("Unhandled error: %s", exc)
        return problem(500, "unknown")
