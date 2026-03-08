from sqlalchemy import Boolean, Column, Integer, String, ForeignKey, DateTime, Float
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_paid = Column(Boolean, default=False)
    wallet_balance = Column(Float, default=0.0)
    
    trades = relationship("Trade", back_populates="owner")
    portfolio = relationship("PortfolioItem", back_populates="owner")

class PortfolioItem(Base):
    __tablename__ = "portfolio"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    symbol = Column(String, index=True)
    quantity = Column(Integer, default=0)
    
    owner = relationship("User", back_populates="portfolio")

class Trade(Base):
    __tablename__ = "trades"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    symbol = Column(String, index=True)
    action = Column(String) # BUY or SELL
    price = Column(Float)
    quantity = Column(Integer)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    owner = relationship("User", back_populates="trades")
