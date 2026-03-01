from datetime import datetime
from pydantic import BaseModel, ConfigDict


class BlockedSiteCreate(BaseModel):
    name: str
    pattern: str


class BlockedSiteResponse(BaseModel):
    id: str
    name: str
    pattern: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
