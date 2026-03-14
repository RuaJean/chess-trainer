import re

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import COOKIE_NAME, create_access_token, hash_password, verify_password
from ..dependencies import get_current_user, get_db
from ..models import Collection, User
from ..schemas import UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

PASSWORD_RE = re.compile(r"^(?=.*[a-zA-Z])(?=.*\d).{8,}$")


async def _create_default_collections(db: AsyncSession, user_id: int) -> None:
    db.add(
        Collection(
            user_id=user_id,
            name="Mis partidas vs IA",
            type="ai-games",
            icon="\U0001f916",
            description="Partidas jugadas contra Stockfish",
        )
    )
    db.add(
        Collection(
            user_id=user_id,
            name="Sin colecci\u00f3n",
            type="custom",
            icon="\U0001f4cb",
            description="Partidas sin asignar",
        )
    )
    await db.flush()


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=7 * 24 * 3600,
        path="/",
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, response: Response, db: AsyncSession = Depends(get_db)):
    if not PASSWORD_RE.match(body.password):
        raise HTTPException(400, "Password must be at least 8 chars with 1 letter and 1 number")

    existing = await db.execute(
        select(User).where((User.username == body.username) | (User.email == body.email))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Username or email already taken")

    user = User(
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.flush()

    await _create_default_collections(db, user.id)
    await db.commit()
    await db.refresh(user)

    _set_cookie(response, create_access_token(user.id))
    return user


@router.post("/login", response_model=UserOut)
async def login(body: UserLogin, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")

    _set_cookie(response, create_access_token(user.id))
    return user


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
