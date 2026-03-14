import json

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import get_current_user, get_db
from ..models import Collection, Game, User

router = APIRouter(prefix="/api/lichess", tags=["lichess"])


def _lichess_to_game_dict(data: dict, user_id: int, collection_id: int | None) -> dict:
    players = data.get("players", {})

    white_user = players.get("white", {}).get("user", {})
    black_user = players.get("black", {}).get("user", {})
    white = white_user.get("name", "Unknown") if white_user else "Unknown"
    black = black_user.get("name", "Unknown") if black_user else "Unknown"
    white_elo = players.get("white", {}).get("rating")
    black_elo = players.get("black", {}).get("rating")

    result = "*"
    if data.get("winner") == "white":
        result = "1-0"
    elif data.get("winner") == "black":
        result = "0-1"
    elif data.get("status") in ("draw", "stalemate"):
        result = "1/2-1/2"

    created_at = data.get("createdAt")
    date = ""
    if created_at:
        from datetime import datetime, timezone

        dt = datetime.fromtimestamp(created_at / 1000, tz=timezone.utc)
        date = dt.strftime("%Y.%m.%d")

    opening = data.get("opening", {})

    return dict(
        user_id=user_id,
        collection_id=collection_id,
        pgn=data.get("pgn", ""),
        white=white,
        black=black,
        white_elo=white_elo,
        black_elo=black_elo,
        date=date,
        result=result,
        event=f"Lichess {data.get('perf', '')}" if data.get("perf") else "Lichess",
        site=f"https://lichess.org/{data.get('id', '')}",
        eco=opening.get("eco", ""),
        opening_name=opening.get("name", ""),
        pgn_headers={
            "Event": data.get("perf", "Lichess"),
            "Site": f"https://lichess.org/{data.get('id', '')}",
            "White": white,
            "Black": black,
            "Result": result,
            "Date": date,
            **({"ECO": opening["eco"]} if opening.get("eco") else {}),
            **({"Opening": opening["name"]} if opening.get("name") else {}),
        },
        source="lichess",
    )


@router.get("/games/{username}")
async def fetch_lichess_games(
    username: str,
    max: int = Query(50, ge=1, le=300),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Find or create the Lichess collection for this username
    result = await db.execute(
        select(Collection).where(
            Collection.user_id == user.id,
            Collection.type == "lichess",
            Collection.name == f"Lichess: {username}",
        )
    )
    coll = result.scalar_one_or_none()
    if not coll:
        coll = Collection(
            user_id=user.id,
            name=f"Lichess: {username}",
            type="lichess",
            icon="\u265e",
            source_info={"lichessUsername": username},
        )
        db.add(coll)
        await db.flush()

    # Fetch from Lichess API
    params = {
        "max": str(max),
        "pgnInJson": "true",
        "clocks": "false",
        "evals": "false",
        "opening": "true",
    }

    url = f"https://lichess.org/api/games/user/{username}"
    headers = {"Accept": "application/x-ndjson"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.get(url, params=params, headers=headers)
        except httpx.RequestError as e:
            raise HTTPException(502, f"Could not connect to Lichess: {e}")

    if resp.status_code == 404:
        raise HTTPException(404, f'User "{username}" not found on Lichess')
    if resp.status_code == 429:
        raise HTTPException(429, "Rate limited by Lichess. Please wait.")
    if resp.status_code != 200:
        raise HTTPException(502, f"Lichess returned status {resp.status_code}")

    # Parse NDJSON
    games_data = []
    for line in resp.text.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            games_data.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    # Save to DB
    created = []
    for data in games_data:
        game_dict = _lichess_to_game_dict(data, user.id, coll.id)
        game = Game(**game_dict)
        db.add(game)
        created.append(game)

    coll.game_count = (coll.game_count or 0) + len(created)
    await db.commit()

    return {
        "collection_id": coll.id,
        "collection_name": coll.name,
        "imported": len(created),
    }
