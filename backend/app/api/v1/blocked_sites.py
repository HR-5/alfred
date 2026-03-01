from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.schemas.blocked_site import BlockedSiteCreate, BlockedSiteResponse
from app.services import blocked_site_service

router = APIRouter(prefix="/blocked-sites", tags=["blocked-sites"])


@router.get("", response_model=list[BlockedSiteResponse])
async def list_blocked_sites(session: AsyncSession = Depends(get_session)):
    return await blocked_site_service.list_sites(session)


@router.post("", response_model=BlockedSiteResponse, status_code=201)
async def create_blocked_site(
    body: BlockedSiteCreate,
    session: AsyncSession = Depends(get_session),
):
    return await blocked_site_service.create_site(body, session)


@router.delete("/{site_id}", status_code=204)
async def delete_blocked_site(
    site_id: str,
    session: AsyncSession = Depends(get_session),
):
    deleted = await blocked_site_service.delete_site(site_id, session)
    if not deleted:
        raise HTTPException(status_code=404, detail="Blocked site not found")
