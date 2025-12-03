from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas, auth
from database import get_db

router = APIRouter(
    prefix="/watchlist",
    tags=["watchlist"],
)

@router.get("/", response_model=List[schemas.Watchlist])
def read_watchlist(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return current_user.watchlist_items

@router.post("/", response_model=schemas.Watchlist)
def add_to_watchlist(watchlist: schemas.WatchlistCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Check if already exists
    exists = db.query(models.Watchlist).filter(models.Watchlist.user_id == current_user.id, models.Watchlist.ticker == watchlist.ticker).first()
    if exists:
        raise HTTPException(status_code=400, detail="Ticker already in watchlist")
    
    db_watchlist = models.Watchlist(**watchlist.dict(), user_id=current_user.id)
    db.add(db_watchlist)
    db.commit()
    db.refresh(db_watchlist)
    return db_watchlist

@router.delete("/{ticker}", response_model=schemas.Watchlist)
def remove_from_watchlist(ticker: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_watchlist = db.query(models.Watchlist).filter(models.Watchlist.user_id == current_user.id, models.Watchlist.ticker == ticker).first()
    if not db_watchlist:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    
    db.delete(db_watchlist)
    db.commit()
    return db_watchlist
