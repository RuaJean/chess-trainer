from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import get_current_user, get_db
from ..models import Collection, Game, User
from ..schemas import CollectionCreate, CollectionOut, CollectionUpdate

router = APIRouter(prefix="/api/collections", tags=["collections"])


@router.get("/", response_model=list[CollectionOut])
async def list_collections(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Collection)
        .where(Collection.user_id == user.id)
        .order_by(Collection.pinned.desc(), Collection.created_at)
    )
    return result.scalars().all()


@router.post("/", response_model=CollectionOut, status_code=status.HTTP_201_CREATED)
async def create_collection(
    body: CollectionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    coll = Collection(user_id=user.id, **body.model_dump())
    db.add(coll)
    await db.commit()
    await db.refresh(coll)
    return coll


@router.get("/{collection_id}", response_model=CollectionOut)
async def get_collection(
    collection_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Collection).where(Collection.id == collection_id, Collection.user_id == user.id)
    )
    coll = result.scalar_one_or_none()
    if not coll:
        raise HTTPException(404, "Collection not found")
    return coll


@router.put("/{collection_id}", response_model=CollectionOut)
async def update_collection(
    collection_id: int,
    body: CollectionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Collection).where(Collection.id == collection_id, Collection.user_id == user.id)
    )
    coll = result.scalar_one_or_none()
    if not coll:
        raise HTTPException(404, "Collection not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(coll, field, val)
    await db.commit()
    await db.refresh(coll)
    return coll


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Collection).where(Collection.id == collection_id, Collection.user_id == user.id)
    )
    coll = result.scalar_one_or_none()
    if not coll:
        raise HTTPException(404, "Collection not found")

    # Move games to "Sin coleccion" instead of deleting them
    default_result = await db.execute(
        select(Collection).where(
            Collection.user_id == user.id,
            Collection.type == "custom",
            Collection.name == "Sin colecci\u00f3n",
        )
    )
    default_coll = default_result.scalar_one_or_none()
    target_id = default_coll.id if default_coll else None

    await db.execute(
        Game.__table__.update()
        .where(Game.collection_id == collection_id)
        .values(collection_id=target_id)
    )

    await db.delete(coll)
    await db.commit()
