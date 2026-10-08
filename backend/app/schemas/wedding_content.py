from pydantic import BaseModel, ConfigDict, Field


class ContentModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class VenueContent(ContentModel):
    name: str = Field(min_length=1, max_length=200)
    time: str = Field(min_length=1, max_length=50)
    address: str = Field(min_length=1, max_length=300)
    map_url: str = Field(alias="mapUrl", max_length=500)


class StoryItemContent(ContentModel):
    eyebrow: str = Field(max_length=100)
    title: str = Field(min_length=1, max_length=150)
    body: str = Field(min_length=1, max_length=1000)


class EntouragePersonContent(ContentModel):
    role: str = Field(default="", max_length=150)
    name: str = Field(min_length=1, max_length=200)


class EntourageGroupContent(ContentModel):
    title: str = Field(min_length=1, max_length=200)
    people: list[EntouragePersonContent] = Field(default_factory=list, max_length=50)


class GiftMethodContent(ContentModel):
    title: str = Field(min_length=1, max_length=100)
    owner: str = Field(max_length=150)
    account: str = Field(default="", max_length=150)
    qr: str = Field(default="", max_length=500)
    details: list[str] = Field(default_factory=list, max_length=10)
    enabled: bool = True


class GiftContent(ContentModel):
    gcash: GiftMethodContent
    maya: GiftMethodContent
    bank: GiftMethodContent


class FeatureSwitches(ContentModel):
    story: bool = True
    details: bool = True
    entourage: bool = True
    gift: bool = True
    rsvp: bool = True


class WeddingContentPayload(ContentModel):
    wedding_date_iso: str = Field(alias="weddingDateIso", min_length=10, max_length=50)
    wedding_date_display: str = Field(
        alias="weddingDateDisplay", min_length=1, max_length=150
    )
    rsvp_deadline: str = Field(alias="rsvpDeadline", max_length=50)
    rsvp_deadline_display: str = Field(
        alias="rsvpDeadlineDisplay", min_length=1, max_length=150
    )
    ceremony: VenueContent
    reception: VenueContent
    story_heading: str = Field(alias="storyHeading", max_length=300)
    story_items: list[StoryItemContent] = Field(
        alias="storyItems", min_length=1, max_length=6
    )
    entourage_groups: list[EntourageGroupContent] = Field(
        alias="entourageGroups", max_length=30
    )
    gift: GiftContent
    features: FeatureSwitches


class WeddingContentResponse(BaseModel):
    success: bool = True
    content: WeddingContentPayload


DEFAULT_WEDDING_CONTENT = WeddingContentPayload.model_validate(
    {
        "weddingDateIso": "2027-03-20T16:00:00+08:00",
        "weddingDateDisplay": "Saturday · March 20, 2027",
        "rsvpDeadline": "",
        "rsvpDeadlineDisplay": "RSVP deadline to be announced",
        "ceremony": {
            "name": "Diocesan Shrine and Parish of Saint Pio of Pietrelcina",
            "time": "4:00 PM",
            "address": "106 Sumulong Hwy, Antipolo, 1870 Rizal",
            "mapUrl": "https://maps.app.goo.gl/ywzhGAg79RuC541s8",
        },
        "reception": {
            "name": "LeBlanc Hotel and Resort",
            "time": "6:00 PM",
            "address": "3 Taktak Rd, Antipolo, 1870 Rizal",
            "mapUrl": "https://maps.app.goo.gl/s6W7RyrZj3EhZxxbA",
        },
        "storyHeading": (
            "From the moments we shared, to the journey that brought us here."
        ),
        "storyItems": [
            {
                "eyebrow": "HOW IT STARTED",
                "title": "Our Beginning",
                "body": (
                    "Every beautiful story starts somewhere. Ours began with simple "
                    "moments, conversations, laughter, and a connection that slowly "
                    "became something more."
                ),
            },
            {
                "eyebrow": "OUR JOURNEY",
                "title": "Growing Together",
                "body": (
                    "Through adventures, ordinary days, milestones, and challenges, "
                    "we learned that the best part of the journey was having each "
                    "other beside us."
                ),
            },
            {
                "eyebrow": "THE NEXT CHAPTER",
                "title": "Forever Starts Here",
                "body": (
                    "And now, with grateful hearts, we are ready to begin our next "
                    "chapter together and celebrate it with the people who have been "
                    "part of our story."
                ),
            },
        ],
        "entourageGroups": [],
        "gift": {
            "gcash": {"title": "GCash", "owner": "John Paul"},
            "maya": {"title": "Maya", "owner": "Joyce"},
            "bank": {"title": "Bank Transfer", "owner": "John Paul & Joyce"},
        },
        "features": {},
    }
)
