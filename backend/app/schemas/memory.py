from typing import Optional
from datetime import datetime

from pydantic import BaseModel


class MemoryResponse(BaseModel):
    id: str
    content: str
    category: Optional[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
