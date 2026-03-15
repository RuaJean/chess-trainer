from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..dependencies import get_current_user, get_db
from ..models import Collection, Game, GameTag, Tag, User
from ..schemas import GameCreate, GameImport, GameOut, GameUpdate, TagRef

router = APIRouter(prefix="/api/games", tags=["games"])


def _game_to_out(game: Game) -> GameOut:
    tags = [TagRef(id=gt.tag.id, name=gt.tag.name, color=gt.tag.color) for gt in game.game_tags]
    return GameOut.model_validate({**game.__dict__, "tags": tags})


async def _refresh_collection_count(db: AsyncSession, collection_id: int | None) -> None:
    if collection_id is None:
        return
    count = await db.scalar(
        select(func.count()).where(Game.collection_id == collection_id)
    )
    await db.execute(
        Collection.__table__.update()
        .where(Collection.id == collection_id)
        .values(game_count=count)
    )


@router.get("/", response_model=list[GameOut])
async def list_games(
    collection_id: int | None = None,
    query: str | None = None,
    result: str | None = None,
    eco: str | None = None,
    is_favorite: bool | None = None,
    tag_id: int | None = None,
    ordering: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Game)
        .options(selectinload(Game.game_tags).selectinload(GameTag.tag))
        .where(Game.user_id == user.id)
    )

    if collection_id is not None:
        stmt = stmt.where(Game.collection_id == collection_id)
    if result:
        stmt = stmt.where(Game.result == result)
    if eco:
        stmt = stmt.where(Game.eco.ilike(f"{eco}%"))
    if is_favorite is not None:
        stmt = stmt.where(Game.is_favorite == is_favorite)
    if tag_id is not None:
        stmt = stmt.where(Game.id.in_(select(GameTag.game_id).where(GameTag.tag_id == tag_id)))
    if query:
        q = f"%{query}%"
        stmt = stmt.where(
            Game.white.ilike(q)
            | Game.black.ilike(q)
            | Game.event.ilike(q)
            | Game.eco.ilike(q)
            | Game.opening_name.ilike(q)
        )

    # Ordering: prefix with - for descending (e.g. "-date", "white_elo")
    order_map = {
        "date": Game.date,
        "created_at": Game.created_at,
        "white_elo": Game.white_elo,
        "black_elo": Game.black_elo,
        "result": Game.result,
        "eco": Game.eco,
    }
    if ordering:
        desc = ordering.startswith("-")
        field = ordering.lstrip("-")
        col = order_map.get(field)
        if col is not None:
            stmt = stmt.order_by(col.desc() if desc else col.asc())
        else:
            stmt = stmt.order_by(Game.created_at.desc())
    else:
        stmt = stmt.order_by(Game.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    rows = await db.execute(stmt)
    games = rows.scalars().unique().all()
    return [_game_to_out(g) for g in games]


@router.post("/", response_model=GameOut, status_code=status.HTTP_201_CREATED)
async def create_game(
    body: GameCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    game = Game(user_id=user.id, **body.model_dump())
    db.add(game)
    await db.flush()
    await _refresh_collection_count(db, game.collection_id)
    await db.commit()
    # Re-fetch with tags
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.game_tags).selectinload(GameTag.tag))
        .where(Game.id == game.id)
    )
    return _game_to_out(result.scalar_one())


@router.get("/{game_id}", response_model=GameOut)
async def get_game(
    game_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.game_tags).selectinload(GameTag.tag))
        .where(Game.id == game_id, Game.user_id == user.id)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(404, "Game not found")
    return _game_to_out(game)


@router.put("/{game_id}", response_model=GameOut)
async def update_game(
    game_id: int,
    body: GameUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.game_tags).selectinload(GameTag.tag))
        .where(Game.id == game_id, Game.user_id == user.id)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(404, "Game not found")

    old_collection_id = game.collection_id
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(game, field, val)

    await db.flush()
    if old_collection_id != game.collection_id:
        await _refresh_collection_count(db, old_collection_id)
        await _refresh_collection_count(db, game.collection_id)
    await db.commit()
    await db.refresh(game)
    return _game_to_out(game)


@router.delete("/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_game(
    game_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Game).where(Game.id == game_id, Game.user_id == user.id)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(404, "Game not found")
    collection_id = game.collection_id
    await db.delete(game)
    await db.flush()
    await _refresh_collection_count(db, collection_id)
    await db.commit()


@router.post("/import", response_model=list[GameOut], status_code=status.HTTP_201_CREATED)
async def import_games(
    body: GameImport,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    collection_id = None
    if body.collection_name:
        coll = Collection(
            user_id=user.id,
            name=body.collection_name,
            type=body.collection_type,
            source_info={"importDate": str(__import__("datetime").date.today())},
        )
        db.add(coll)
        await db.flush()
        collection_id = coll.id

    created_ids = []
    for g in body.games:
        game = Game(user_id=user.id, collection_id=collection_id or g.collection_id, **{
            k: v for k, v in g.model_dump().items() if k != "collection_id"
        })
        db.add(game)
        await db.flush()
        created_ids.append(game.id)

    if collection_id:
        await _refresh_collection_count(db, collection_id)
    await db.commit()

    result = await db.execute(
        select(Game)
        .options(selectinload(Game.game_tags).selectinload(GameTag.tag))
        .where(Game.id.in_(created_ids))
    )
    return [_game_to_out(g) for g in result.scalars().unique().all()]


@router.get("/export/json")
async def export_games(
    collection_id: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Game)
        .options(selectinload(Game.game_tags).selectinload(GameTag.tag))
        .where(Game.user_id == user.id)
    )
    if collection_id is not None:
        stmt = stmt.where(Game.collection_id == collection_id)
    rows = await db.execute(stmt)
    return [_game_to_out(g) for g in rows.scalars().unique().all()]


@router.put("/{game_id}/favorite", response_model=GameOut)
async def toggle_favorite(
    game_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.game_tags).selectinload(GameTag.tag))
        .where(Game.id == game_id, Game.user_id == user.id)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(404, "Game not found")
    game.is_favorite = not game.is_favorite
    await db.commit()
    await db.refresh(game)
    return _game_to_out(game)


@router.post("/{game_id}/tags/{tag_id}", status_code=status.HTTP_201_CREATED)
async def add_tag_to_game(
    game_id: int,
    tag_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    game = await db.scalar(select(Game).where(Game.id == game_id, Game.user_id == user.id))
    if not game:
        raise HTTPException(404, "Game not found")
    tag = await db.scalar(select(Tag).where(Tag.id == tag_id, Tag.user_id == user.id))
    if not tag:
        raise HTTPException(404, "Tag not found")

    existing = await db.scalar(
        select(GameTag).where(GameTag.game_id == game_id, GameTag.tag_id == tag_id)
    )
    if existing:
        return {"ok": True}

    db.add(GameTag(game_id=game_id, tag_id=tag_id))
    await db.commit()
    return {"ok": True}


@router.delete("/{game_id}/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_tag_from_game(
    game_id: int,
    tag_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GameTag).where(GameTag.game_id == game_id, GameTag.tag_id == tag_id)
    )
    gt = result.scalar_one_or_none()
    if gt:
        await db.delete(gt)
        await db.commit()
