from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Annotated
from pydantic import BaseModel

from database import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter(prefix="", tags=["profile"])

@router.get("/profile", response_model=schemas.ProfileResponse)
def get_profile(current_user: Annotated[models.User, Depends(get_current_user)], db: Session = Depends(get_db)):
    # The models are mapped via relationship, so current_user.trades returns list of Trades
    # Convert timestamp to string before returning
    trades = [
        schemas.TradeResponse(
            id=t.id, symbol=t.symbol, action=t.action, price=t.price, quantity=t.quantity, timestamp=t.timestamp.isoformat()
        )
        for t in current_user.trades
    ]
    # Sort trades descending by date
    trades.sort(key=lambda x: x.id, reverse=True)
    
    portfolio = [
        schemas.PortfolioItemResponse(
            id=p.id, symbol=p.symbol, quantity=p.quantity
        )
        for p in current_user.portfolio if p.quantity > 0
    ]
    
    return schemas.ProfileResponse(
        user=current_user,
        portfolio=portfolio,
        trades=trades
    )

class TopupRequest(BaseModel):
    amount: int

@router.post("/wallet/topup")
def wallet_topup(request: TopupRequest, current_user: Annotated[models.User, Depends(get_current_user)], db: Session = Depends(get_db)):
    # Need fresh instance attached to session
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    
    # Simple top-up mock logic
    user.wallet_balance += request.amount
    db.commit()
    db.refresh(user)
    
    return {"status": "success", "new_balance": user.wallet_balance}
