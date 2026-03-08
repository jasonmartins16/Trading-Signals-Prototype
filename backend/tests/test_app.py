import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app, redis_client
from database import get_db, Base
import models

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def cleanup():
    # clean db
    db = TestingSessionLocal()
    db.query(models.User).delete()
    db.commit()
    db.close()
    
    # clean redis testing keys
    try:
        redis_client.flushdb()
    except Exception:
        pass
    yield

def test_signup_login_flow():
    # Signup
    response = client.post("/auth/signup", json={"email": "test@example.com", "password": "password123"})
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"
    
    # Login
    login_data = {"username": "test@example.com", "password": "password123"}
    response = client.post("/auth/login", data=login_data)
    assert response.status_code == 200
    assert "access_token" in response.json()
    
    # verify user status
    token = response.json()["access_token"]
    me_response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "test@example.com"
    assert me_response.json()["is_paid"] == False

def test_signals_access_control():
    # Create user and get token
    client.post("/auth/signup", json={"email": "free@example.com", "password": "pass"})
    token_resp = client.post("/auth/login", data={"username": "free@example.com", "password": "pass"})
    token = token_resp.json()["access_token"]
    
    # Check free access
    signals_resp = client.get("/signals", headers={"Authorization": f"Bearer {token}"})
    assert signals_resp.status_code == 200
    data = signals_resp.json()
    assert len(data["data"]) == 2
    assert data["is_premium_unlocked"] == False

def test_webhook_idempotency():
    # Setup user
    client.post("/auth/signup", json={"email": "webhook@example.com", "password": "pass"})
    token_resp = client.post("/auth/login", data={"username": "webhook@example.com", "password": "pass"})
    token = token_resp.json()["access_token"]
    
    # 1. Create Checkout Session
    checkout_resp = client.post("/billing/create-checkout", headers={"Authorization": f"Bearer {token}"})
    assert checkout_resp.status_code == 200
    session_id = checkout_resp.json()["session_id"]
    assert "checkout_url" in checkout_resp.json()
    
    # 2. Check initial status
    status_resp = client.get("/billing/status", headers={"Authorization": f"Bearer {token}"})
    assert status_resp.json()["is_paid"] == False
    
    # 3. Simulate Stripe Webhook (First Time)
    payload = {
        "type": "checkout.session.completed",
        "data": {
            "session_id": session_id
        }
    }
    
    resp1 = client.post("/billing/simulate-webhook", json=payload)
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "success"
    
    # Verify user is paid
    status_resp_after = client.get("/billing/status", headers={"Authorization": f"Bearer {token}"})
    assert status_resp_after.json()["is_paid"] == True
    
    signals_resp = client.get("/signals", headers={"Authorization": f"Bearer {token}"})
    assert signals_resp.json()["is_premium_unlocked"] == True
    assert len(signals_resp.json()["data"]) == 10
    
    # 4. Simulate Stripe Webhook (Second Time / Duplicate)
    resp2 = client.post("/billing/simulate-webhook", json=payload)
    assert resp2.status_code == 200
    assert "duplicate" in resp2.json()["detail"].lower()
