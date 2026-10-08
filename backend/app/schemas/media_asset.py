from pydantic import BaseModel


class MediaUploadResponse(BaseModel):
    success: bool = True
    id: int
    url: str
    filename: str
    content_type: str
    size_bytes: int
