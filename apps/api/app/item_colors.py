"""Owner-scoped, provider-free wardrobe palettes."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, StringConstraints

from app.auth import member
from app.db import connection, one

Hex = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]


class ItemColors(BaseModel):
    model_config = ConfigDict(extra="forbid")
    primary: Hex
    secondary: Hex | None = None
    accent: Hex | None = None


class ColorUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    colors: ItemColors


router = APIRouter()


@router.patch("/villages/{vid}/inventory/{item_id}/colors")
async def recolor(
    vid: UUID,
    item_id: str,
    data: ColorUpdate,
    user=Depends(member),
    conn=Depends(connection, scope="function"),
):
    colors = {
        key: value.lower() for key, value in data.colors.model_dump(exclude_none=True).items()
    }
    row = await one(
        conn,
        """UPDATE inventory i SET colors=%s FROM catalog_items c
        WHERE i.item_id=c.id AND c.kind='clothing' AND i.village_id=%s
        AND i.user_id=%s AND i.item_id=%s RETURNING i.item_id,i.colors""",
        (Jsonb(colors), vid, user["id"], item_id),
    )
    if not row:
        raise HTTPException(404, "Owned clothing item not found")
    return row
