export type VenueContent = {
  name: string;
  time: string;
  address: string;
  mapUrl: string;
};

export type StoryItemContent = {
  eyebrow: string;
  title: string;
  body: string;
};

export type EntouragePersonContent = { role: string; name: string };
export type EntourageGroupContent = {
  title: string;
  people: EntouragePersonContent[];
};

export type GiftMethodContent = {
  title: string;
  owner: string;
  account: string;
  qr: string;
  details: string[];
  enabled: boolean;
};

export type WeddingContent = {
  weddingDateIso: string;
  weddingDateDisplay: string;
  rsvpDeadline: string;
  rsvpDeadlineDisplay: string;
  ceremony: VenueContent;
  reception: VenueContent;
  storyHeading: string;
  storyItems: StoryItemContent[];
  entourageGroups: EntourageGroupContent[];
  gift: {
    gcash: GiftMethodContent;
    maya: GiftMethodContent;
    bank: GiftMethodContent;
  };
  features: {
    story: boolean;
    details: boolean;
    entourage: boolean;
    gift: boolean;
    rsvp: boolean;
  };
};

export const defaultWeddingContent: WeddingContent = {
  weddingDateIso: "2027-03-20T16:00:00+08:00",
  weddingDateDisplay: "Saturday · March 20, 2027",
  rsvpDeadline: "",
  rsvpDeadlineDisplay: "RSVP deadline to be announced",
  ceremony: {
    name: "Diocesan Shrine and Parish of Saint Pio of Pietrelcina",
    time: "4:00 PM",
    address: "106 Sumulong Hwy, Antipolo, 1870 Rizal",
    mapUrl: "https://maps.app.goo.gl/ywzhGAg79RuC541s8",
  },
  reception: {
    name: "LeBlanc Hotel and Resort",
    time: "6:00 PM",
    address: "3 Taktak Rd, Antipolo, 1870 Rizal",
    mapUrl: "https://maps.app.goo.gl/s6W7RyrZj3EhZxxbA",
  },
  storyHeading: "From the moments we shared, to the journey that brought us here.",
  storyItems: [
    { eyebrow: "HOW IT STARTED", title: "Our Beginning", body: "Every beautiful story starts somewhere. Ours began with simple moments, conversations, laughter, and a connection that slowly became something more." },
    { eyebrow: "OUR JOURNEY", title: "Growing Together", body: "Through adventures, ordinary days, milestones, and challenges, we learned that the best part of the journey was having each other beside us." },
    { eyebrow: "THE NEXT CHAPTER", title: "Forever Starts Here", body: "And now, with grateful hearts, we are ready to begin our next chapter together and celebrate it with the people who have been part of our story." },
  ],
  entourageGroups: [],
  gift: {
    gcash: { title: "GCash", owner: "John Paul", account: "", qr: "", details: [], enabled: true },
    maya: { title: "Maya", owner: "Joyce", account: "", qr: "", details: [], enabled: true },
    bank: { title: "Bank Transfer", owner: "John Paul & Joyce", account: "", qr: "", details: [], enabled: true },
  },
  features: { story: true, details: true, entourage: true, gift: true, rsvp: true },
};
