from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.services import push_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


class SubscribeRequest(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.get("/vapid-public-key")
async def get_vapid_public_key():
    key = push_service.get_vapid_public_key()
    if not key:
        raise HTTPException(status_code=503, detail="Push notifications not available (pywebpush not installed)")
    return {"public_key": key}


@router.post("/subscribe", status_code=201)
async def subscribe(body: SubscribeRequest, session: AsyncSession = Depends(get_session)):
    await push_service.save_subscription(body.endpoint, body.p256dh, body.auth, session)
    return {"status": "subscribed"}


@router.delete("/subscribe", status_code=204)
async def unsubscribe(body: UnsubscribeRequest, session: AsyncSession = Depends(get_session)):
    removed = await push_service.remove_subscription(body.endpoint, session)
    if not removed:
        raise HTTPException(status_code=404, detail="Subscription not found")


@router.delete("/subscriptions", status_code=204)
async def clear_all_subscriptions(session: AsyncSession = Depends(get_session)):
    """Remove all stored push subscriptions (used during reset flow)."""
    await push_service.clear_all_subscriptions(session)


@router.post("/test-push")
async def test_push(session: AsyncSession = Depends(get_session)):
    """Send a test push notification to all active subscriptions."""
    subs = await push_service.get_all_subscriptions(session)
    if not subs:
        raise HTTPException(status_code=404, detail="No subscriptions found — enable notifications first")
    sent = 0
    for sub in subs:
        ok = await push_service.send_push(
            sub,
            title="Alfred — Test Notification",
            body="Notifications are working, sir. Splendid.",
            session=session,
        )
        if ok:
            sent += 1
    return {"sent": sent, "total": len(subs)}
