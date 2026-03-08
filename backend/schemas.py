from pydantic import BaseModel, EmailStr

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_paid: bool
    wallet_balance: float

    model_config = {"from_attributes": True}

class TradeResponse(BaseModel):
    id: int
    symbol: str
    action: str
    price: float
    quantity: int
    timestamp: str

    model_config = {"from_attributes": True}

class PortfolioItemResponse(BaseModel):
    id: int
    symbol: str
    quantity: int

    model_config = {"from_attributes": True}

class ProfileResponse(BaseModel):
    user: UserResponse
    portfolio: list[PortfolioItemResponse]
    trades: list[TradeResponse]

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None
