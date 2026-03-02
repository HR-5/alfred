from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class LinkedInConnectionCreate(BaseModel):
    name: str
    profile_url: str
    reason: str


class LinkedInConnectionUpdate(BaseModel):
    name: Optional[str] = None
    reason: Optional[str] = None
    status: Optional[str] = None


class LinkedInConnectionResponse(BaseModel):
    id: str
    name: str
    profile_url: str
    reason: str
    status: str
    created_at: datetime
    accepted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
