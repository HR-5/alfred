from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.schemas.saved_link import SavedLinkCreate, SavedLinkResponse
from app.services import saved_link_service

router = APIRouter(prefix="/saved-links", tags=["saved-links"])


@router.get("", response_model=list[SavedLinkResponse])
async def list_saved_links(
    is_read: bool | None = Query(None),
    link_type: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    return await saved_link_service.list_links(session, is_read=is_read, link_type=link_type)


@router.get("/suggestions", response_model=list[SavedLinkResponse])
async def get_suggestions(
    session: AsyncSession = Depends(get_session),
):
    return await saved_link_service.get_random_unread(session, limit=3)


@router.post("", response_model=SavedLinkResponse, status_code=201)
async def create_saved_link(
    body: SavedLinkCreate,
    session: AsyncSession = Depends(get_session),
):
    return await saved_link_service.create_link(body, session)


@router.patch("/{link_id}/read", response_model=SavedLinkResponse)
async def mark_link_read(
    link_id: str,
    session: AsyncSession = Depends(get_session),
):
    link = await saved_link_service.mark_read(link_id, session)
    if not link:
        raise HTTPException(status_code=404, detail="Saved link not found")
    return link


@router.delete("/{link_id}", status_code=204)
async def delete_saved_link(
    link_id: str,
    session: AsyncSession = Depends(get_session),
):
    deleted = await saved_link_service.delete_link(link_id, session)
    if not deleted:
        raise HTTPException(status_code=404, detail="Saved link not found")
