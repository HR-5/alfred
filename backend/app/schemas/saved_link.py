from datetime import datetime
from pydantic import BaseModel, ConfigDict


class SavedLinkCreate(BaseModel):
    url: str
    title: str
    description: str | None = None
    link_type: str = "other"


class SavedLinkResponse(BaseModel):
    id: str
    url: str
    title: str
    description: str | None
    link_type: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
