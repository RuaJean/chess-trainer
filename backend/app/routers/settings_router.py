from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import get_current_user, get_db
from ..models import Setting, User
from ..schemas import SettingOut, SettingValue

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/{key}", response_model=SettingOut)
async def get_setting(
    key: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Setting).where(Setting.user_id == user.id, Setting.key == key)
    )
    setting = result.scalar_one_or_none()
    if setting:
        return setting
    return SettingOut(key=key, value=None)


@router.put("/{key}", response_model=SettingOut)
async def set_setting(
    key: str,
    body: SettingValue,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Setting).where(Setting.user_id == user.id, Setting.key == key)
    )
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = body.value
    else:
        setting = Setting(user_id=user.id, key=key, value=body.value)
        db.add(setting)
    await db.commit()
    await db.refresh(setting)
    return setting
