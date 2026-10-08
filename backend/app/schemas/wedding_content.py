from pydantic import BaseModel, ConfigDict, Field


class ContentModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class VenueContent(ContentModel):
    name: str = Field(min_length=1, max_length=200)
    time: str = Field(min_length=1, max_length=50)
    address: str = Field(min_length=1, max_length=300)
    map_url: str = Field(alias="mapUrl", max_length=500)
    image: str = Field(default="", max_length=500)


class StoryItemContent(ContentModel):
    eyebrow: str = Field(max_length=100)
    title: str = Field(min_length=1, max_length=150)
    body: str = Field(min_length=1, max_length=1000)
    image: str = Field(default="", max_length=500)
    images: list[str] = Field(default_factory=list)


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
    cover_image: str = Field(
        alias="coverImage", default="/images/cover.jpg", max_length=500
    )
    portrait_image: str = Field(
        alias="portraitImage", default="/images/portrait.jpg", max_length=500
    )
    hero_images: list[str] = Field(
        alias="heroImages",
        default_factory=lambda: [f"/images/hero-{index}.jpg" for index in range(1, 6)],
        min_length=1,
    )
    divider_images: list[str] = Field(
        alias="dividerImages",
        default_factory=lambda: [
            "/images/scroll-divider-1.jpg",
            "/images/scroll-divider-2.jpg",
            "/images/scroll-divider-3.jpg",
            "",
            "",
        ],
        min_length=3,
        max_length=5,
    )
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
        "coverImage": "/images/cover.jpg",
        "portraitImage": "/images/portrait.jpg",
        "heroImages": [
            "/images/hero-1.jpg",
            "/images/hero-2.jpg",
            "/images/hero-3.jpg",
            "/images/hero-4.jpg",
            "/images/hero-5.jpg",
        ],
        "dividerImages": [
            "/images/scroll-divider-1.jpg",
            "/images/scroll-divider-2.jpg",
            "/images/scroll-divider-3.jpg",
            "",
            "",
        ],
        "weddingDateIso": "2027-03-20T16:00:00+08:00",
        "weddingDateDisplay": "Saturday · March 20, 2027",
        "rsvpDeadline": "",
        "rsvpDeadlineDisplay": "RSVP deadline to be announced",
        "ceremony": {
            "name": "Diocesan Shrine and Parish of Saint Pio of Pietrelcina",
            "time": "4:00 PM",
            "address": "106 Sumulong Hwy, Antipolo, 1870 Rizal",
            "mapUrl": "https://maps.app.goo.gl/ywzhGAg79RuC541s8",
            "image": "/images/ceremony.jpg",
        },
        "reception": {
            "name": "LeBlanc Hotel and Resort",
            "time": "6:00 PM",
            "address": "3 Taktak Rd, Antipolo, 1870 Rizal",
            "mapUrl": "https://maps.app.goo.gl/s6W7RyrZj3EhZxxbA",
            "image": "/images/reception.jpg",
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
                "image": "/images/story-1.jpg",
                "images": ["/images/story-1.jpg"],
            },
            {
                "eyebrow": "OUR JOURNEY",
                "title": "Growing Together",
                "body": (
                    "Through adventures, ordinary days, milestones, and challenges, "
                    "we learned that the best part of the journey was having each "
                    "other beside us."
                ),
                "image": "/images/story-2.jpg",
                "images": ["/images/story-2.jpg"],
            },
            {
                "eyebrow": "THE NEXT CHAPTER",
                "title": "Forever Starts Here",
                "body": (
                    "And now, with grateful hearts, we are ready to begin our next "
                    "chapter together and celebrate it with the people who have been "
                    "part of our story."
                ),
                "image": "/images/story-3.jpg",
                "images": ["/images/story-3.jpg"],
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
