from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import redis
from redis_client import redis_client
import logging
import uuid
from typing import Annotated

from database import get_db
import models
from auth import get_current_user

router = APIRouter(prefix="/billing", tags=["billing"])

class StripeWebhookData(BaseModel):
    session_id: str

class StripeWebhookPayload(BaseModel):
    type: str
    data: StripeWebhookData

@router.post("/create-checkout")
def create_checkout(current_user: Annotated[models.User, Depends(get_current_user)]):
    session_id = str(uuid.uuid4())
    session_key = f"session_{session_id}"
    
    try:
        # Store user email mapped to the session_id for the webhook to find
        redis_client.setex(session_key, 3600, current_user.email) # 1 hour TTL
    except redis.ConnectionError:
        logging.warning("Redis is down, checkout session might fail in webhook")
        
    # Return mock checkout URL and session ID
    return {
        "session_id": session_id, 
        "checkout_url": f"https://mock-checkout.example.com/pay/{session_id}"
    }

@router.get("/status")
def get_billing_status(current_user: Annotated[models.User, Depends(get_current_user)]):
    return {"is_paid": current_user.is_paid}

@router.post("/simulate-webhook")
def simulate_webhook(payload: StripeWebhookPayload, db: Session = Depends(get_db)):
    if payload.type != "checkout.session.completed":
        return {"status": "ignored", "detail": "Unhandled event type"}
        
    session_id = payload.data.session_id
    idempotency_key = f"processed_{session_id}"
    session_key = f"session_{session_id}"
    
    try:
        # Check idempotency
        if redis_client.exists(idempotency_key):
            return {"status": "success", "detail": "Webhook ignored (duplicate)"}
            
        # Retrieve user email from session
        email = redis_client.get(session_key)
        if not email:
            raise HTTPException(status_code=400, detail="Checkout session expired or invalid")
            
        # Update user
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        user.is_paid = True
        db.commit()
        
        # Store idempotency key for 24 hours
        redis_client.setex(idempotency_key, 24 * 60 * 60, "true")
        
    except redis.ConnectionError:
        logging.error("Redis is down. Cannot reliably process webhook for checkout session lookup.")
        raise HTTPException(status_code=500, detail="Service unavailable due to cache downtime")
        
    return {"status": "success", "detail": "Payment processed successfully"}
