"""
Integration tests for Flask API endpoints using the built-in test client.
No real database connections or ML models are used.
Tests are chosen so that validation logic fires before any DB/model call.
"""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from server import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    app.config["JWT_SECRET_KEY"] = "test-secret-key-for-tests"
    with app.test_client() as c:
        yield c


# ── Health ────────────────────────────────────────────────────────────────────

class TestHealth:
    def test_returns_200(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200

    def test_returns_ok_status(self, client):
        data = json.loads(client.get("/api/health").data)
        assert data["status"] == "ok"


# ── Register ─────────────────────────────────────────────────────────────────

class TestRegister:
    def test_empty_body_returns_400(self, client):
        r = client.post("/api/auth/register", json={})
        assert r.status_code == 400

    def test_missing_email_returns_400(self, client):
        r = client.post("/api/auth/register",
                        json={"fullName": "Test", "password": "secret123"})
        assert r.status_code == 400

    def test_missing_name_returns_400(self, client):
        r = client.post("/api/auth/register",
                        json={"email": "a@b.com", "password": "secret123"})
        assert r.status_code == 400

    def test_short_password_returns_400(self, client):
        r = client.post("/api/auth/register",
                        json={"fullName": "Test", "email": "a@b.com", "password": "abc"})
        assert r.status_code == 400
        data = json.loads(r.data)
        assert "password" in data["error"].lower()


# ── Login ─────────────────────────────────────────────────────────────────────

class TestLogin:
    def test_empty_body_returns_400(self, client):
        r = client.post("/api/auth/login", json={})
        assert r.status_code == 400

    def test_missing_password_returns_400(self, client):
        r = client.post("/api/auth/login", json={"email": "a@b.com"})
        assert r.status_code == 400

    def test_missing_email_returns_400(self, client):
        r = client.post("/api/auth/login", json={"password": "secret123"})
        assert r.status_code == 400


# ── Protected routes (no token) ───────────────────────────────────────────────

class TestProtectedRoutes:
    def test_upload_requires_jwt(self, client):
        r = client.post("/api/upload")
        assert r.status_code == 401

    def test_profile_get_requires_jwt(self, client):
        r = client.get("/api/profile")
        assert r.status_code == 401

    def test_history_requires_jwt(self, client):
        r = client.get("/api/history")
        assert r.status_code == 401

    def test_chat_requires_jwt(self, client):
        r = client.post("/api/chat", json={"messages": []})
        assert r.status_code == 401


# ── Job lookup ────────────────────────────────────────────────────────────────

class TestJobLookup:
    def test_status_unknown_job_returns_404(self, client):
        r = client.get("/api/status/doesnotexist999")
        assert r.status_code == 404

    def test_results_unknown_job_returns_404(self, client):
        r = client.get("/api/results/doesnotexist999")
        assert r.status_code == 404

    def test_highlights_status_unknown_job_returns_404(self, client):
        r = client.get("/api/highlights/status/doesnotexist999")
        assert r.status_code == 404
