from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    collections = relationship("Collection", back_populates="user", cascade="all, delete-orphan")
    games = relationship("Game", back_populates="user", cascade="all, delete-orphan")
    tags = relationship("Tag", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("Setting", back_populates="user", cascade="all, delete-orphan")


class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    type = Column(
        String(20),
        CheckConstraint("type IN ('custom','lichess','ai-games','import','repertoire')"),
        nullable=False,
        default="custom",
    )
    icon = Column(String(10), default="\U0001f4c1")
    color = Column(String(7), default="#666666")
    pinned = Column(Boolean, default=False)
    source_info = Column(JSONB, default=dict)
    game_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    user = relationship("User", back_populates="collections")
    games = relationship("Game", back_populates="collection")

    __table_args__ = (
        Index("idx_collections_user", "user_id"),
        Index("idx_collections_type", "user_id", "type"),
    )


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="SET NULL"), nullable=True)

    pgn = Column(Text, nullable=False)
    white = Column(String(255), default="")
    black = Column(String(255), default="")
    white_elo = Column(Integer, nullable=True)
    black_elo = Column(Integer, nullable=True)
    date = Column(String(20), default="")
    result = Column(String(20), default="*")
    event = Column(String(255), default="")
    site = Column(String(512), default="")
    round = Column(String(20), default="")
    eco = Column(String(10), default="")
    opening_name = Column(String(255), default="")
    fen = Column(Text, nullable=True)
    ply_count = Column(Integer, default=0)

    pgn_headers = Column(JSONB, default=dict)
    source = Column(
        String(20),
        CheckConstraint("source IN ('manual','import','lichess','ai-game')"),
        default="manual",
    )

    analysis_json = Column(Text, nullable=True)
    notes = Column(Text, default="")
    is_favorite = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), default=_utcnow)

    user = relationship("User", back_populates="games")
    collection = relationship("Collection", back_populates="games")
    game_tags = relationship("GameTag", back_populates="game", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_games_user", "user_id"),
        Index("idx_games_collection", "collection_id"),
        Index("idx_games_created_at", created_at.desc()),
        Index("idx_games_white", "white"),
        Index("idx_games_black", "black"),
        Index("idx_games_eco", "eco"),
        Index("idx_games_result", "result"),
    )


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50), nullable=False)
    color = Column(String(7), default="#666666")

    user = relationship("User", back_populates="tags")
    game_tags = relationship("GameTag", back_populates="tag", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("user_id", "name"),)


class GameTag(Base):
    __tablename__ = "game_tags"

    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)

    game = relationship("Game", back_populates="game_tags")
    tag = relationship("Tag", back_populates="game_tags")


class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    key = Column(String(100), nullable=False)
    value = Column(JSONB, default=None)

    user = relationship("User", back_populates="settings")

    __table_args__ = (UniqueConstraint("user_id", "key"),)
