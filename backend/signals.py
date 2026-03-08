from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Annotated
import redis
import json
import logging
import yfinance as yf
from pydantic import BaseModel

from database import get_db
import models
from auth import get_current_user
import os

router = APIRouter(prefix="/signals", tags=["signals"])
redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(redis_url, decode_responses=True)

def fetch_live_signals():
    # Top 10 High Volume US Stocks for Live Trading Simulation (since Indian markets might be closed)
    tickers = ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "META", "GOOGL", "AMD", "NFLX", "INTC"]
    
    signals = []
    for idx, symbol in enumerate(tickers):
        try:
            ticker = yf.Ticker(symbol)
            # Fast fetch for current quote
            hist = ticker.history(period="1d")
            
            if hist.empty:
                continue
                
            current_price = float(hist['Close'].iloc[-1])
            # Determine mock action based on random simplistic heuristic (e.g. price % 2)
            action = "BUY" if int(current_price) % 2 == 0 else "SELL"
            
            # Simulated targets: +- 5%
            target = round(current_price * 1.05 if action == "BUY" else current_price * 0.95, 2)
            stop_loss = round(current_price * 0.95 if action == "BUY" else current_price * 1.05, 2)
            
            signals.append({
                "id": idx + 1,
                "symbol": symbol,
                "live_price": round(current_price, 2),
                "action": action,
                "target": target,
                "stop_loss": stop_loss
            })
        except Exception as e:
            logging.error(f"Failed to fetch {symbol}: {e}")
            
    return signals

@router.get("/")
def get_signals(current_user: Annotated[models.User, Depends(get_current_user)]):
    cache_key = "signals_cache"
    signals = None
    
    try:
        cached_data = redis_client.get(cache_key)
        if cached_data:
            signals = json.loads(cached_data)
        else:
            signals = fetch_live_signals()
            redis_client.setex(cache_key, 60, json.dumps(signals)) # 60s TTL for Live Prices
    except redis.ConnectionError:
        logging.warning("Redis is down, ignoring cache for signals")
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
        
    # Get live prices from cache or fetch new ones
    cached_data = redis_client.get("signals_cache")
    if cached_data:
        signals = json.loads(cached_data)
    else:
        signals = fetch_live_signals()
        redis_client.setex("signals_cache", 60, json.dumps(signals))
        
    signal = next((s for s in signals if s["id"] == signal_id), None)
    
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
        
    trade_price = signal["live_price"]
    total_cost = trade_price * trade_action.quantity
    
    # Reload user attached to current DB session
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    
    # Get or create Portfolio Item
    portfolio_item = db.query(models.PortfolioItem).filter(
        models.PortfolioItem.user_id == user.id,
        models.PortfolioItem.symbol == signal["symbol"]
    ).first()
    
    if not portfolio_item:
        portfolio_item = models.PortfolioItem(user_id=user.id, symbol=signal["symbol"], quantity=0)
        db.add(portfolio_item)
    
    if trade_action.action == "BUY":
        if user.wallet_balance < total_cost:
            raise HTTPException(status_code=400, detail=f"Insufficient funds. Need ₹{total_cost:,.2f} but have ₹{user.wallet_balance:,.2f}.")
        user.wallet_balance -= total_cost
        portfolio_item.quantity += trade_action.quantity
    else: # SELL
        if portfolio_item.quantity < trade_action.quantity:
             raise HTTPException(status_code=400, detail=f"Insufficient holdings. You only own {portfolio_item.quantity} units of {signal['symbol']}.")
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
        
    return {
        "status": "success",
        "message": f"Successfully executed {trade_action.action} for {trade_action.quantity}x {signal['symbol']} at ₹{trade_price:,.2f}. Total: ₹{total_cost:,.2f}"
    }
