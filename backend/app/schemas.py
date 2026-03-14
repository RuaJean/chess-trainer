from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


# ---- Auth ----

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Collections ----

class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    type: str = "custom"
    icon: str = "\U0001f4c1"
    color: str = "#666666"


class CollectionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    pinned: bool | None = None


class CollectionOut(BaseModel):
    id: int
    name: str
    description: str
    type: str
    icon: str
    color: str
    pinned: bool
    source_info: dict[str, Any]
    game_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---- Games ----

class GameCreate(BaseModel):
    collection_id: int | None = None
    pgn: str
    white: str = ""
    black: str = ""
    white_elo: int | None = None
    black_elo: int | None = None
    date: str = ""
    result: str = "*"
    event: str = ""
    site: str = ""
    round: str = ""
    eco: str = ""
    opening_name: str = ""
    fen: str | None = None
    ply_count: int = 0
    pgn_headers: dict[str, Any] = {}
    source: str = "manual"
    analysis_json: str | None = None
    notes: str = ""
    is_favorite: bool = False


class GameUpdate(BaseModel):
    collection_id: int | None = None
    pgn: str | None = None
    white: str | None = None
    black: str | None = None
    date: str | None = None
    result: str | None = None
    event: str | None = None
    eco: str | None = None
    opening_name: str | None = None
    analysis_json: str | None = None
    notes: str | None = None
    is_favorite: bool | None = None


class TagRef(BaseModel):
    id: int
    name: str
    color: str

    model_config = {"from_attributes": True}


class GameOut(BaseModel):
    id: int
    collection_id: int | None
    pgn: str
    white: str
    black: str
    white_elo: int | None
    black_elo: int | None
    date: str
    result: str
    event: str
    site: str
    round: str
    eco: str
    opening_name: str
    fen: str | None
    ply_count: int
    pgn_headers: dict[str, Any]
    source: str
    analysis_json: str | None
    notes: str
    is_favorite: bool
    created_at: datetime
    tags: list[TagRef] = []

    model_config = {"from_attributes": True}


class GameImport(BaseModel):
    games: list[GameCreate]
    collection_name: str | None = None
    collection_type: str = "import"


# ---- Tags ----

class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color: str = "#666666"


class TagUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class TagOut(BaseModel):
    id: int
    name: str
    color: str

    model_config = {"from_attributes": True}


# ---- Settings ----

class SettingValue(BaseModel):
    value: Any = None


class SettingOut(BaseModel):
    key: str
    value: Any

    model_config = {"from_attributes": True}


# ---- Transcribe ----

class TranscribeOut(BaseModel):
    text: str
