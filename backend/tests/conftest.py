"""Tests run against a throwaway SQLite database, never the real one."""
import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="agridirect-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["ENABLE_SCHEDULER"] = "false"
os.environ["OTP_MODE"] = "demo"
os.environ["DATA_MODE"] = "synthetic"
os.environ["SEED_DEMO"] = "true"
os.environ["RATE_LIMIT_OTP_PER_MIN"] = "1000"
os.environ["RATE_LIMIT_PER_MIN"] = "100000"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-123"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def app_client():
    from pathlib import Path

    from app import config

    object.__setattr__(config.settings, "upload_dir", Path(_tmp) / "uploads")
    object.__setattr__(config.settings, "model_dir", Path(_tmp) / "models")
    from app.main import app

    with TestClient(app) as client:  # runs startup: seed, ingest, train, predict
        yield client


class Api:
    """Small helper: one logged-in user talking to the API."""

    def __init__(self, client: TestClient, token: str | None = None):
        self.client, self.token = client, token

    def call(self, method: str, path: str, **kw):
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        return self.client.request(method, f"/api/v1{path}", headers=headers, **kw)

    def get(self, path, **kw):
        return self.call("GET", path, **kw)

    def post(self, path, json=None, **kw):
        return self.call("POST", path, json=json, **kw)

    def patch(self, path, json=None):
        return self.call("PATCH", path, json=json)


def otp(client: TestClient, phone: str) -> dict:
    r = client.post("/api/v1/auth/otp/request", json={"phone": phone})
    assert r.status_code == 200, r.text
    code = r.json()["devOtp"]
    r = client.post("/api/v1/auth/otp/verify", json={"phone": phone, "code": code})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def login(app_client):
    tokens: dict[str, str] = {}  # one OTP per phone: the real 3-sends-per-15-min limit applies in tests too

    def _login(phone: str) -> Api:
        if phone not in tokens:
            tokens[phone] = otp(app_client, phone)["accessToken"]
        return Api(app_client, tokens[phone])

    return _login
