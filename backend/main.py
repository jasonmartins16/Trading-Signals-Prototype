from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import redis
import time

import models
from database import engine, SessionLocal
from auth import router as auth_router, get_password_hash
from billing import router as billing_router
from signals import router as signals_router
from user_profile import router as profile_router
from contextlib import asynccontextmanager

models.Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        test_user = db.query(models.User).filter(models.User.email == "test@example.com").first()
        if not test_user:
            hashed_password = get_password_hash("password123")
            new_user = models.User(email="test@example.com", hashed_password=hashed_password)
            db.add(new_user)
            db.commit()
    finally:
        db.close()
    yield

app = FastAPI(title="Trading Signals API", lifespan=lifespan)



from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

import redis

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:8080", 
        "http://localhost:3000",
        "http://127.0.0.1:5173", 
        "http://127.0.0.1:8080",
        "http://192.168.31.127:8080",
        "http://192.168.31.127:5173",
        "https://dependable-charm-production.up.railway.app",
        "http://dependable-charm-production.up.railway.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(redis_url, decode_responses=True)

@app.middleware("http")
async def rate_limit_auth(request: Request, call_next):
    if request.url.path.startswith("/auth"):
        client_ip = request.client.host
        key = f"rate_limit:{client_ip}"
        
        current_minute = int(time.time() // 60)
        bucket_key = f"{key}:{current_minute}"
        
        try:
            requests_count = redis_client.incr(bucket_key)
            if requests_count == 1:
                redis_client.expire(bucket_key, 60) # Expire in 60 seconds
                
            if requests_count > 5:
                return JSONResponse(
                    status_code=429, 
                    content={"detail": "Rate limit exceeded. Try again later."}
                )
        except redis.ConnectionError:
            # Fallback if Redis is down
            pass

    response = await call_next(request)
    return response

app.include_router(auth_router)
app.include_router(billing_router)
app.include_router(signals_router)
app.include_router(profile_router)

@app.get("/")
def root():
    return {"message": "Welcome to Trading Signals API"}
