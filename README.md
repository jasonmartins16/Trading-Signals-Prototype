# Trading Signals SaaS Prototype

This is a complete, working prototype for a Trading Signals SaaS application built during a 48-hour hackathon.

## Architecture

```text
+-------------------+       HTTP / REST        +------------------+
|                   |  <-------------------->  |                  |
|  React Frontend   |       JSON APIs          |  FastAPI Backend |
|  (Vite + Tailwind)|                          |  (Python + JWT)  |
|                   |                          |                  |
+---------+---------+                          +--------+---------+
          |                                             |
          | Mock Payment Webhook                        | SQLite &
          v (Simulated Webhook)                         v Redis
+-------------------+                          +------------------+
|                   |                          |  - SQLite (DB)   |
|   Payment Modal   | ---------------------->  |  - Redis Cache & |
|   (Simulates OK)  |      POST /billing       |    Rate Limiting |
+-------------------+                          +------------------+
```

## Features

- **Monorepo Structure**: Separate `/backend` and `/frontend` directories.
- **Backend (Python/FastAPI)**:
  - JWT Authentication (`/auth/signup`, `/auth/login`, `/auth/me`).
  - Redis-based rate limiting on auth endpoints (max 5 requests/min).
  - Webhook Idempotency: Redis-backed processing for payment webhook (`/billing/simulate-webhook`) preventing duplicate updates per `transaction_id`.
  - Core Domain: Mock Signals generator (`/signals`) with Read-Through Redis caching (5 min TTL) and access control (`is_paid` restriction).
- **Frontend (React/Vite)**:
  - Clean Tailwind CSS UI with React Router support.
  - Auth flow saving JWT to `localStorage`.
  - Dashboard dynamically rendering limited signals for free users.
  - Mock Payment Checkout modal simulating a real payment gateway webhook.

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Redis Server** must be running locally on default port `6379`. (If Redis isn't running, the app has graceful fallbacks, but idempotency and rate limiting will be bypassed).

---

## 🚀 How to Run

### Step 1: Start Redis Server
Start your local Redis instance. Example on Windows via WSL or Docker:
```bash
docker run -d -p 6379:6379 redis
```

### Step 2: Start the FastAPI Backend
```bash
cd backend
# The virtual environment is already created
# Activate it (Windows):
.\venv\Scripts\activate

# Install dependencies (already done if following setup)
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --host localhost --port 8000
```
*API docs available at `http://localhost:8000/docs`*

### Step 3: Start the React Frontend
```bash
cd frontend

# Install dependencies
npm install

# Run the Vite dev server
npm run dev
```
*App available at `http://localhost:5173`*

---

## 🧪 Testing

To run the Pytest test suite with coverage for auth, idempotency, and signals access control:

```bash
cd backend
.\venv\Scripts\pytest tests/test_app.py -v
```

### End-to-End Frontend Testing

A test user is automatically created in the SQLite database when the backend starts. You can use these credentials to log in and test the UI without signing up:

- **Email**: `test@example.com`
- **Password**: `password123`

**Testing Flow**:
1. Open `http://localhost:5173` in your browser. You'll be redirected to the login page.
2. Log in using the test credentials above.
3. Observe the Dashboard: As a free user, you'll only see 2 signals.
4. Click **Subscribe for ₹499** to open the mock payment modal.
5. Click **Simulate Payment**. This fires the idempotency webhook to the backend.
6. The modal will close, and the dashboard will automatically refresh to show all 10 premium signals and a "Premium Active" badge!
