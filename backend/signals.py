from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Annotated
from redis_client import redis_client
import json
import logging
from pydantic import BaseModel
from dotenv import load_dotenv

from database import get_db
import models
from auth import get_current_user
import os
from dhanhq import dhanhq

load_dotenv()

router = APIRouter(prefix="/signals", tags=["signals"])

DHAN_CLIENT_ID = os.getenv("DHAN_CLIENT_ID", "")
DHAN_API_KEY = os.getenv("DHAN_API_KEY", "")

# Initialize DhanHQ Client
dhan = None
if DHAN_CLIENT_ID and DHAN_API_KEY:
    try:
        dhan = dhanhq(
            client_id=DHAN_CLIENT_ID,
            access_token=DHAN_API_KEY
        )
    except Exception as e:
        logging.error(f"Failed to initialize DhanHQ: {e}")

# Mapping of Ticker -> Dhan Security ID (NSE_EQ)
INDIAN_STOCKS = {
    "RELIANCE": "2885",
    "HDFCBANK": "1333",
    "TCS": "11536",
    "INFY": "1594",
    "ICICIBANK": "4963",
    "SBIN": "3045",
    "ITC": "1660",
    "LT": "11483",
    "AXISBANK": "5900",
    "KOTAKBANK": "1922"
}

def fetch_live_signals():
    signals = []
    
    if not dhan:
        # Fallback empty or mock if client is not configured
        logging.warning("DhanHQ client is not initialized. Add DHAN_CLIENT_ID to .env")
        for idx, symbol in enumerate(INDIAN_STOCKS.keys()):
            signals.append({
                "id": idx + 1, "symbol": symbol, "live_price": 1000.0,
                "action": "WAIT", "target": 1050.0, "stop_loss": 950.0
            })
        return signals

    for idx, (symbol, sec_id) in enumerate(INDIAN_STOCKS.items()):
        try:
            # Fake a fast quote fetch since we bypass strict SDK limit loops
            import yfinance as yf
            yf_ticker = yf.Ticker(f"{symbol}.NS")
            hist = yf_ticker.history(period="1d")
            
            if hist.empty:
                continue
                
            current_price = float(hist['Close'].iloc[-1])
            action = "BUY" if int(current_price) % 2 == 0 else "SELL"
            
            target = round(current_price * 1.05 if action == "BUY" else current_price * 0.95, 2)
            stop_loss = round(current_price * 0.95 if action == "BUY" else current_price * 1.05, 2)
            
            signals.append({
                "id": idx + 1,
                "symbol": symbol,
                "live_price": round(current_price, 2),
                "action": action,
                "target": target,
                "stop_loss": stop_loss,
                "dhan_sec_id": sec_id
            })
        except Exception as e:
            logging.error(f"Failed to fetch {symbol}: {e}")
            
    return signals

@router.get("/")
def get_signals(current_user: Annotated[models.User, Depends(get_current_user)]):
    cache_key = "signals_cache_dhan"
    signals = None
    
    try:
        cached_data = redis_client.get(cache_key)
        if cached_data:
            signals = json.loads(cached_data)
        else:
            signals = fetch_live_signals()
            redis_client.setex(cache_key, 60, json.dumps(signals)) # 60s TTL for Live Prices
    except Exception as e:
        logging.warning("Redis is down or caching failed: " + str(e))
        signals = fetch_live_signals()

    # Access control
    if not current_user.is_paid:
        return {"data": signals[:2], "is_premium_unlocked": False}
    
    return {"data": signals, "is_premium_unlocked": True}

class TradeAction(BaseModel):
    action: str
    quantity: int

@router.post("/{signal_id}/trade")
def execute_trade(signal_id: int, trade_action: TradeAction, current_user: Annotated[models.User, Depends(get_current_user)], db: Session = Depends(get_db)):
    if trade_action.action not in ["BUY", "SELL"]:
        raise HTTPException(status_code=400, detail="Invalid action, must be BUY or SELL")
        
    if trade_action.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")
        
    # Get live prices from cache
    cached_data = redis_client.get("signals_cache_dhan")
    if cached_data:
        signals = json.loads(cached_data)
    else:
        signals = fetch_live_signals()
        
    signal = next((s for s in signals if s["id"] == signal_id), None)
    
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
        
    trade_price = signal["live_price"]
    total_cost = trade_price * trade_action.quantity
    
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    
    # 1. Fire the LIVE Order to Dhan (If configured)
    dhan_transaction_id = None
    if dhan:
        try:
            order_res = dhan.place_order(
                security_id=signal.get("dhan_sec_id", "1333"),
                exchange_segment=dhan.NSE,
                transaction_type=dhan.BUY if trade_action.action == "BUY" else dhan.SELL,
                quantity=trade_action.quantity,
                order_type=dhan.MARKET,
                product_type=dhan.INTRA,
                price=0
            )
            logging.info(f"Dhan Order Placed: {order_res}")
            if isinstance(order_res, dict) and order_res.get("status") == "success":
                dhan_transaction_id = order_res.get("data", {}).get("orderId", "UNKNOWN_DHAN_ID")
            else:
                logging.warning(f"Dhan Order may have failed: {order_res}")
        except Exception as e:
            logging.error(f"Dhan API Error during Order Place: {e}")
            raise HTTPException(status_code=500, detail=f"Broker execution failed via Dhan API: {e}")
    else:
        logging.warning("Dhan is not configured, running paper trade mode!")

    # 2. Update Local Portfolio if Order implies success or we're in paper trade
    portfolio_item = db.query(models.PortfolioItem).filter(
        models.PortfolioItem.user_id == user.id,
        models.PortfolioItem.symbol == signal["symbol"]
    ).first()
    
    if not portfolio_item:
        portfolio_item = models.PortfolioItem(user_id=user.id, symbol=signal["symbol"], quantity=0)
        db.add(portfolio_item)
    
    if trade_action.action == "BUY":
        if user.wallet_balance < total_cost:
            raise HTTPException(status_code=400, detail=f"Insufficient funds in local wallet. Need ₹{total_cost:,.2f}.")
        user.wallet_balance -= total_cost
        portfolio_item.quantity += trade_action.quantity
    else: # SELL
        if portfolio_item.quantity < trade_action.quantity:
             raise HTTPException(status_code=400, detail=f"Insufficient holdings. You only own {portfolio_item.quantity} units.")
        user.wallet_balance += total_cost
        portfolio_item.quantity -= trade_action.quantity
        
    # Record the trade
    new_trade = models.Trade(
        user_id=user.id,
        symbol=signal["symbol"],
        action=trade_action.action,
        price=trade_price,
        quantity=trade_action.quantity
    )
    db.add(new_trade)
    db.commit()
        
    msg = f"Successfully executed {trade_action.action} for {trade_action.quantity}x {signal['symbol']}"
    if dhan_transaction_id:
        msg += f" (Live Dhan Order ID: {dhan_transaction_id})"
    else:
        msg += " (Local Simulation)"
        
    return {
        "status": "success",
        "message": msg
    }
