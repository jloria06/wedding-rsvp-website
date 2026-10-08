from sqlalchemy.orm import Session

from app.models import WeddingContent
from app.schemas.wedding_content import (
    DEFAULT_WEDDING_CONTENT,
    WeddingContentPayload,
    WeddingContentResponse,
)


class WeddingContentService:
    CONTENT_ID = 1

    def __init__(self, database_session: Session) -> None:
        self.database_session = database_session

    def get_content(self) -> WeddingContentResponse:
        record = self.database_session.get(WeddingContent, self.CONTENT_ID)
        if record is None:
            content = DEFAULT_WEDDING_CONTENT
        else:
            defaults = DEFAULT_WEDDING_CONTENT.model_dump(mode="json", by_alias=True)
            stored = record.content
            merged = {**defaults, **stored}
            for venue in ("ceremony", "reception"):
                merged[venue] = {**defaults[venue], **stored.get(venue, {})}
            merged_story_items = []
            for index, item in enumerate(stored.get("storyItems", [])):
                merged_item = {
                    **(
                        defaults["storyItems"][index]
                        if index < len(defaults["storyItems"])
                        else {}
                    ),
                    **item,
                }
                if "images" not in item:
                    fallback_image = item.get("image") or merged_item.get("image", "")
                    merged_item["images"] = [fallback_image] if fallback_image else []
                merged_story_items.append(merged_item)
            merged["storyItems"] = merged_story_items
            content = WeddingContentPayload.model_validate(merged)
        return WeddingContentResponse(content=content)

    def update_content(
        self, content: WeddingContentPayload, administrator_id: int
    ) -> WeddingContentResponse:
        record = self.database_session.get(WeddingContent, self.CONTENT_ID)
        serialized = content.model_dump(mode="json", by_alias=True)
        if record is None:
            record = WeddingContent(
                id=self.CONTENT_ID,
                content=serialized,
                updated_by_id=administrator_id,
            )
            self.database_session.add(record)
        else:
            record.content = serialized
            record.updated_by_id = administrator_id
        self.database_session.flush()
        return WeddingContentResponse(content=content)
