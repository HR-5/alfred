from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.schemas.linkedin_connection import (
    LinkedInConnectionCreate,
    LinkedInConnectionResponse,
    LinkedInConnectionUpdate,
)
from app.services import linkedin_connection_service

router = APIRouter(prefix="/linkedin-connections", tags=["linkedin-connections"])


@router.get("", response_model=list[LinkedInConnectionResponse])
async def list_connections(
    status: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
):
    return await linkedin_connection_service.list_connections(session, status=status)


@router.post("", response_model=LinkedInConnectionResponse, status_code=201)
async def create_connection(
    body: LinkedInConnectionCreate,
    session: AsyncSession = Depends(get_session),
):
    return await linkedin_connection_service.create_connection(body, session)


@router.patch("/{connection_id}", response_model=LinkedInConnectionResponse)
async def update_connection(
    connection_id: str,
    body: LinkedInConnectionUpdate,
    session: AsyncSession = Depends(get_session),
):
    conn = await linkedin_connection_service.update_connection(connection_id, body, session)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return conn


@router.delete("/{connection_id}", status_code=204)
async def delete_connection(
    connection_id: str,
    session: AsyncSession = Depends(get_session),
):
    deleted = await linkedin_connection_service.delete_connection(connection_id, session)
    if not deleted:
        raise HTTPException(status_code=404, detail="Connection not found")
