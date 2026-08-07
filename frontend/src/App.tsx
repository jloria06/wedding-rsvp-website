import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

import { InvitationVerificationForm } from "./components/InvitationVerificationForm";
import { RSVPForm } from "./components/RSVPForm";
import type { GuestSummary, RSVPSubmissionResponse } from "./types/rsvp";

/* =========================================================
   TYPES
========================================================= */

type GiftMethod = {
  title: string;
  owner: string;
  account?: string;
  qr?: string;
  details?: string[];
  enabled?: boolean;
};

type WeddingConfig = {
  rsvpDeadline?: string;
  rsvpDeadlineDisplay?: string;
  gift?: {
    gcash?: GiftMethod;
    maya?: GiftMethod;
    bank?: GiftMethod;
  };
};

type ResolvedWeddingConfig = {
  rsvpDeadline: string;
  rsvpDeadlineDisplay: string;
  gift: {
    gcash: GiftMethod;
    maya: GiftMethod;
    bank: GiftMethod;
  };
};

type EntouragePerson = {
  role: string;
  name: string;
  order: number;
};

type EntourageGroup = {
  title: string;
  order: number;
  people: EntouragePerson[];
};

const DEFAULT_WEDDING_CONFIG: ResolvedWeddingConfig = {
  rsvpDeadline: "",
  rsvpDeadlineDisplay: "RSVP deadline to be announced",
  gift: {
    gcash: {
      title: "GCash",
      owner: "John Paul",
      account: "",
      qr: "",
      details: [],
      enabled: true,
    },
    maya: {
      title: "Maya",
      owner: "Joyce",
      account: "",
      qr: "",
      details: [],
      enabled: true,
    },
    bank: {
      title: "Bank Transfer",
      owner: "John Paul & Joyce",
      account: "",
      qr: "",
      details: [],
      enabled: true,
    },
  },
};

/* =========================================================
   DECORATIVE COMPONENTS
========================================================= */

function OrnateFrame() {
  return (
    <div className="ornate-frame" aria-hidden="true">
      <span className="ornate-frame__line ornate-frame__line--top" />
      <span className="ornate-frame__line ornate-frame__line--bottom" />
      <span className="ornate-frame__line ornate-frame__line--left" />
      <span className="ornate-frame__line ornate-frame__line--right" />

      <span className="ornate-frame__corner ornate-frame__corner--tl" />
      <span className="ornate-frame__corner ornate-frame__corner--tr" />
      <span className="ornate-frame__corner ornate-frame__corner--bl" />
      <span className="ornate-frame__corner ornate-frame__corner--br" />

      <span className="ornate-frame__side ornate-frame__side--left" />
      <span className="ornate-frame__side ornate-frame__side--right" />
    </div>
  );
}

function SectionSeparator() {
  return (
    <div className="section-separator" aria-hidden="true">
      <span />
      <strong>♡</strong>
      <span />
    </div>
  );
}

/* =========================================================
   APP
========================================================= */

function App() {
  /* -------------------------------------------------------
     GLOBAL WEDDING CONFIGURATION
  ------------------------------------------------------- */

  const weddingDate = new Date("2027-03-20T00:00:00+08:00");

  const galleryImages = [
    "/images/gallery-1.jpg",
    "/images/gallery-2.jpg",
    "/images/gallery-3.jpg",
    "/images/gallery-4.jpg",
    "/images/gallery-5.jpg",
  ];

  /* -------------------------------------------------------
     EXTERNAL PUBLIC DATA
     - /public/data/entourage.xlsx
     - /public/data/wedding-config.json
  ------------------------------------------------------- */

  const [entourageGroups, setEntourageGroups] = useState<EntourageGroup[]>([]);
  const [entourageLoading, setEntourageLoading] = useState(true);
  const [entourageError, setEntourageError] = useState("");

  const [weddingConfig, setWeddingConfig] = useState<ResolvedWeddingConfig>(
    DEFAULT_WEDDING_CONFIG,
  );

  /* -------------------------------------------------------
     MEDIA / LIGHTBOX STATE
  ------------------------------------------------------- */

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [momentsVideoStarted, setMomentsVideoStarted] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  /* -------------------------------------------------------
     NAVIGATION / MOBILE UX STATE
  ------------------------------------------------------- */

  const [invitationOpened, setInvitationOpened] = useState(false);
  const [activeSection, setActiveSection] = useState("welcome");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  /* -------------------------------------------------------
     COUNTDOWN STATE
  ------------------------------------------------------- */

  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  /* -------------------------------------------------------
     RSVP STATE
  ------------------------------------------------------- */

  const [verifiedGuest, setVerifiedGuest] = useState<GuestSummary | null>(null);
  const [hasExistingRSVP, setHasExistingRSVP] = useState(false);
  const [rsvpResponse, setRSVPResponse] =
    useState<RSVPSubmissionResponse | null>(null);

  /* =======================================================
     LOAD: WEDDING CONFIG JSON
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadWeddingConfig() {
      try {
        const response = await fetch("/data/wedding-config.json", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const incoming = (await response.json()) as WeddingConfig;

        if (cancelled) {
          return;
        }

        setWeddingConfig({
          rsvpDeadline:
            incoming.rsvpDeadline ?? DEFAULT_WEDDING_CONFIG.rsvpDeadline,
          rsvpDeadlineDisplay:
            incoming.rsvpDeadlineDisplay ??
            DEFAULT_WEDDING_CONFIG.rsvpDeadlineDisplay,
          gift: {
            gcash: {
              ...DEFAULT_WEDDING_CONFIG.gift.gcash,
              ...(incoming.gift?.gcash ?? {}),
            },
            maya: {
              ...DEFAULT_WEDDING_CONFIG.gift.maya,
              ...(incoming.gift?.maya ?? {}),
            },
            bank: {
              ...DEFAULT_WEDDING_CONFIG.gift.bank,
              ...(incoming.gift?.bank ?? {}),
            },
          },
        });
      } catch {
        // Keep safe defaults if the optional public config cannot be loaded.
      }
    }

    void loadWeddingConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =======================================================
     LOAD: ENTOURAGE FROM PUBLIC EXCEL FILE

     Expected worksheet: Entourage
     Expected columns:
     Group | Group Order | Role | Name | Person Order
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadEntourage() {
      setEntourageLoading(true);
      setEntourageError("");

      try {
        const response = await fetch("/data/entourage.xlsx", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Unable to load entourage.xlsx (${response.status})`);
        }

        const buffer = await response.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet =
          workbook.Sheets.Entourage ?? workbook.Sheets[workbook.SheetNames[0]];

        if (!sheet) {
          throw new Error("No worksheet was found in entourage.xlsx");
        }

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        });

        const grouped = new Map<string, EntourageGroup>();

        rows.forEach((row, index) => {
          const title = String(row.Group ?? "").trim();

          if (!title) {
            return;
          }

          const rawGroupOrder = String(row["Group Order"] ?? "").trim();
          const rawPersonOrder = String(row["Person Order"] ?? "").trim();
          const groupOrderValue = Number(rawGroupOrder);
          const personOrderValue = Number(rawPersonOrder);
          const groupOrder =
            rawGroupOrder && Number.isFinite(groupOrderValue)
              ? groupOrderValue
              : index + 1;
          const personOrder =
            rawPersonOrder && Number.isFinite(personOrderValue)
              ? personOrderValue
              : index + 1;
          const role = String(row.Role ?? "").trim();
          const name = String(row.Name ?? "").trim();

          if (!grouped.has(title)) {
            grouped.set(title, {
              title,
              order: groupOrder,
              people: [],
            });
          }

          const group = grouped.get(title);

          if (!group) {
            return;
          }

          group.order = Math.min(group.order, groupOrder);

          if (name) {
            group.people.push({
              role,
              name,
              order: personOrder,
            });
          }
        });

        const parsedGroups = Array.from(grouped.values())
          .map((group) => ({
            ...group,
            people: [...group.people].sort((a, b) => a.order - b.order),
          }))
          .sort((a, b) => a.order - b.order);

        if (!cancelled) {
          setEntourageGroups(parsedGroups);
        }
      } catch (error) {
        if (!cancelled) {
          setEntourageGroups([]);
          setEntourageError(
            error instanceof Error
              ? error.message
              : "Unable to load the entourage Excel file.",
          );
        }
      } finally {
        if (!cancelled) {
          setEntourageLoading(false);
        }
      }
    }

    void loadEntourage();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =======================================================
     LIVE WEDDING COUNTDOWN
  ======================================================= */

  useEffect(() => {
    function updateCountdown() {
      const now = new Date();
      const difference = weddingDate.getTime() - now.getTime();

      if (difference <= 0) {
        setCountdown({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
        });
        return;
      }

      setCountdown({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / (1000 * 60)) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      });
    }

    updateCountdown();

    const timer = window.setInterval(updateCountdown, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  /* =======================================================
     SCROLL REVEAL OBSERVER
  ======================================================= */

  useEffect(() => {
    if (!invitationOpened) {
      return;
    }

    const elements =
      document.querySelectorAll<HTMLElement>(".reveal-on-scroll");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -55px 0px",
      },
    );

    elements.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, [invitationOpened, entourageLoading]);

  /* =======================================================
     PHOTO LIGHTBOX KEYBOARD CONTROLS
  ======================================================= */

  useEffect(() => {
    if (lightboxIndex === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeLightbox();
      }

      if (event.key === "ArrowLeft") {
        showPreviousPhoto();
      }

      if (event.key === "ArrowRight") {
        showNextPhoto();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxIndex]);

  /* =======================================================
     ACTIVE NAV / NAV TRANSITION / BACK-TO-TOP
  ======================================================= */

  useEffect(() => {
    if (!invitationOpened) {
      return;
    }

    const sectionIds = [
      "welcome",
      "story",
      "details",
      "entourage",
      "dresscode",
      "moments",
      "rsvp",
    ];

    function updateScrollState() {
      const navigationOffset = 160;
      let currentSection = "welcome";

      sectionIds.forEach((sectionId) => {
        const section = document.getElementById(sectionId);

        if (!section) {
          return;
        }

        if (section.getBoundingClientRect().top <= navigationOffset) {
          currentSection = sectionId;
        }
      });

      setActiveSection(currentSection);
      setIsScrolled(window.scrollY > 40);
      setShowBackToTop(window.scrollY > 650);
    }

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateScrollState);
    };
  }, [invitationOpened]);

  /* =======================================================
     MOBILE MENU SAFETY
  ======================================================= */

  useEffect(() => {
    if (!invitationOpened) {
      return;
    }

    function handleResize() {
      if (window.innerWidth > 820) {
        setMobileMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [invitationOpened]);

  /* =======================================================
     DERIVED GIFT METHODS
  ======================================================= */

  const giftMethods = useMemo(
    () =>
      [
        weddingConfig.gift.gcash,
        weddingConfig.gift.maya,
        weddingConfig.gift.bank,
      ].filter((method) => method.enabled !== false),
    [weddingConfig],
  );

  /* =======================================================
     UI HELPERS
  ======================================================= */

  function closeLightbox() {
    setLightboxIndex(null);
  }

  function showPreviousPhoto() {
    setLightboxIndex((current) => {
      if (current === null) {
        return null;
      }

      return (current - 1 + galleryImages.length) % galleryImages.length;
    });
  }

  function showNextPhoto() {
    setLightboxIndex((current) => {
      if (current === null) {
        return null;
      }

      return (current + 1) % galleryImages.length;
    });
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function scrollBackToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    closeMobileMenu();
  }

  /* =======================================================
     YOUTUBE + BACKGROUND MUSIC
  ======================================================= */

  function playMomentsVideo() {
    const audio = audioRef.current;

    if (audio && !audio.paused) {
      audio.pause();
      setIsMusicPlaying(false);
    }

    setMomentsVideoStarted(true);
  }

  async function startMusic() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    try {
      await audio.play();
      setIsMusicPlaying(true);
    } catch {
      setIsMusicPlaying(false);
    }
  }

  async function toggleMusic() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    try {
      if (audio.paused) {
        await audio.play();
        setIsMusicPlaying(true);
      } else {
        audio.pause();
        setIsMusicPlaying(false);
      }
    } catch {
      setIsMusicPlaying(false);
    }
  }

  async function openInvitation() {
    await startMusic();
    setInvitationOpened(true);
  }

  return (
    <>
      {/* ===================================================
          PERSISTENT BACKGROUND AUDIO
      =================================================== */}

      <audio
        ref={audioRef}
        src="/audio/wedding-song.mp3"
        loop
        preload="auto"
        onPlay={() => setIsMusicPlaying(true)}
        onPause={() => setIsMusicPlaying(false)}
        onEnded={() => setIsMusicPlaying(false)}
      />

      {!invitationOpened ? (
        /* =================================================
           PART 01: INVITATION COVER
        ================================================= */
        <main className="invitation-cover">
          <OrnateFrame />
          <div className="invitation-cover__background" />
          <div className="invitation-cover__overlay" />

          <section className="invitation-cover__content">
            <p className="invitation-cover__eyebrow">YOU ARE INVITED</p>

            <div className="invitation-cover__portrait">
              <img src="/images/portrait.jpg" alt="John Paul and Joyce" />

              <div className="invitation-cover__monogram">
                JP <span>&</span> Joyce
              </div>
            </div>

            <h1 className="invitation-cover__names">
              John Paul <span>&</span> Joyce
            </h1>

            <p className="invitation-cover__subtitle">Are Getting Married</p>
            <p className="invitation-cover__message">See you there!!</p>
            <p className="invitation-cover__date">MARCH · 20 · 2027</p>

            <button
              className="invitation-cover__button"
              type="button"
              onClick={openInvitation}
            >
              OPEN INVITATION
            </button>
          </section>
        </main>
      ) : (
        /* =================================================
           OPENED WEDDING WEBSITE
        ================================================= */
        <main className="wedding-page">
          <OrnateFrame />

          {/* ===============================================
              FULLSCREEN PHOTO LIGHTBOX
          =============================================== */}

          {lightboxIndex !== null ? (
            <div
              className="photo-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label="Wedding photo viewer"
              onClick={closeLightbox}
            >
              <button
                className="photo-lightbox__close"
                type="button"
                onClick={closeLightbox}
                aria-label="Close photo"
              >
                ×
              </button>

              <button
                className="photo-lightbox__nav photo-lightbox__nav--previous"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showPreviousPhoto();
                }}
                aria-label="Previous photo"
              >
                ‹
              </button>

              <div
                className="photo-lightbox__content"
                onClick={(event) => event.stopPropagation()}
              >
                <img
                  src={galleryImages[lightboxIndex]}
                  alt={`John Paul and Joyce wedding moment ${lightboxIndex + 1}`}
                />

                <p>
                  {lightboxIndex + 1} / {galleryImages.length}
                </p>
              </div>

              <button
                className="photo-lightbox__nav photo-lightbox__nav--next"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showNextPhoto();
                }}
                aria-label="Next photo"
              >
                ›
              </button>
            </div>
          ) : null}

          {/* ===============================================
              DECORATIVE PETALS
          =============================================== */}

          <div className="petal petal--1">✦</div>
          <div className="petal petal--2">✧</div>
          <div className="petal petal--3">✦</div>

          {/* ===============================================
              FLOATING MUSIC CONTROL
          =============================================== */}

          <button
            className={
              isMusicPlaying
                ? "music-control music-control--playing"
                : "music-control"
            }
            type="button"
            onClick={toggleMusic}
            aria-label={
              isMusicPlaying
                ? "Pause background music"
                : "Play background music"
            }
            title={isMusicPlaying ? "Pause music" : "Play music"}
          >
            <span className="music-control__icon">
              {isMusicPlaying ? "♫" : "♪"}
            </span>
            <span className="music-control__label">
              {isMusicPlaying ? "Music On" : "Music Off"}
            </span>
          </button>

          {/* ===============================================
              PART 02: RESPONSIVE NAVIGATION
              - Active section
              - Scrolled appearance
              - Mobile menu
          =============================================== */}

          <nav
            className={`wedding-nav${isScrolled ? " is-scrolled" : ""}${
              mobileMenuOpen ? " is-open" : ""
            }`}
          >
            <a
              className={
                activeSection === "welcome"
                  ? "wedding-nav__brand is-active"
                  : "wedding-nav__brand"
              }
              href="#welcome"
              onClick={closeMobileMenu}
            >
              JP <span>&</span> J
            </a>

            <button
              className="wedding-nav__toggle"
              type="button"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="wedding-navigation-links"
              onClick={() => setMobileMenuOpen((current) => !current)}
            >
              <span />
              <span />
              <span />
            </button>

            <div id="wedding-navigation-links" className="wedding-nav__links">
              <a
                className={activeSection === "story" ? "is-active" : undefined}
                href="#story"
                onClick={closeMobileMenu}
              >
                Our Story
              </a>
              <a
                className={
                  activeSection === "details" ? "is-active" : undefined
                }
                href="#details"
                onClick={closeMobileMenu}
              >
                Details
              </a>
              <a
                className={
                  activeSection === "entourage" ? "is-active" : undefined
                }
                href="#entourage"
                onClick={closeMobileMenu}
              >
                Entourage
              </a>
              <a
                className={
                  activeSection === "dresscode" ? "is-active" : undefined
                }
                href="#dresscode"
                onClick={closeMobileMenu}
              >
                Dress Code
              </a>
              <a
                className={
                  activeSection === "moments" ? "is-active" : undefined
                }
                href="#moments"
                onClick={closeMobileMenu}
              >
                Moments
              </a>
              <a
                className={activeSection === "rsvp" ? "is-active" : undefined}
                href="#rsvp"
                onClick={closeMobileMenu}
              >
                RSVP
              </a>
            </div>
          </nav>

          {/* ===============================================
              PART 03: WELCOME + CLICKABLE PHOTO GALLERY
          =============================================== */}

          <section id="welcome" className="welcome-section">
            <a
              className="scroll-cue"
              href="#story"
              aria-label="Explore our story"
            >
              <span>Explore Our Story</span>
              <div className="scroll-cue__mouse">
                <div className="scroll-cue__wheel" />
              </div>
              <div className="scroll-cue__arrow">↓</div>
            </a>

            <div className="welcome-section__content">
              <p className="welcome-section__eyebrow">John Paul & Joyce</p>
              <h2 className="welcome-section__title">We are getting married</h2>
              <p className="welcome-section__subtitle">
                And we would love to celebrate this special day with you.
              </p>

              <div className="section-divider">
                <span />
                <strong>♡</strong>
                <span />
              </div>

              <div className="welcome-section__gallery">
                {galleryImages.map((image, index) => (
                  <div
                    key={image}
                    className={
                      index === 0
                        ? "welcome-section__photo welcome-section__photo--large reveal-on-scroll reveal-up"
                        : "welcome-section__photo reveal-on-scroll reveal-up"
                    }
                  >
                    <button
                      className="welcome-section__photo-button"
                      type="button"
                      onClick={() => setLightboxIndex(index)}
                      aria-label={`Open wedding photo ${index + 1}`}
                    >
                      <img
                        src={image}
                        alt={`John Paul and Joyce wedding moment ${index + 1}`}
                      />
                      <span className="welcome-section__photo-overlay">
                        <span>View Photo</span>
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <SectionSeparator />

          {/* ===============================================
              PART 04: OUR STORY
          =============================================== */}

          <section id="story" className="story-section">
            <div className="section-heading reveal-on-scroll reveal-heading">
              <p>OUR STORY</p>
              <h2>
                From the moments we shared,
                <br />
                to the journey that brought us here.
              </h2>
            </div>

            <div className="story-section__timeline">
              <article className="story-card reveal-on-scroll reveal-left">
                <div className="story-card__image">
                  <img src="/images/story-1.jpg" alt="Our beginning" />
                </div>
                <div className="story-card__content">
                  <span className="story-card__number">01</span>
                  <p className="story-card__eyebrow">HOW IT STARTED</p>
                  <h3>Our Beginning</h3>
                  <p>
                    Every beautiful story starts somewhere. Ours began with
                    simple moments, conversations, laughter, and a connection
                    that slowly became something more.
                  </p>
                </div>
              </article>

              <article className="story-card story-card--reverse reveal-on-scroll reveal-right">
                <div className="story-card__image">
                  <img src="/images/story-2.jpg" alt="Our journey" />
                </div>
                <div className="story-card__content">
                  <span className="story-card__number">02</span>
                  <p className="story-card__eyebrow">OUR JOURNEY</p>
                  <h3>Growing Together</h3>
                  <p>
                    Through adventures, ordinary days, milestones, and
                    challenges, we learned that the best part of the journey was
                    having each other beside us.
                  </p>
                </div>
              </article>

              <article className="story-card reveal-on-scroll reveal-left">
                <div className="story-card__image">
                  <img src="/images/story-3.jpg" alt="The proposal" />
                </div>
                <div className="story-card__content">
                  <span className="story-card__number">03</span>
                  <p className="story-card__eyebrow">THE NEXT CHAPTER</p>
                  <h3>Forever Starts Here</h3>
                  <p>
                    And now, with grateful hearts, we are ready to begin our
                    next chapter together and celebrate it with the people who
                    have been part of our story.
                  </p>
                </div>
              </article>
            </div>
          </section>

          <SectionSeparator />

          {/* ===============================================
              PART 05: SAVE THE DATE + VENUES
          =============================================== */}

          <section id="details" className="details-section">
            <div className="section-heading reveal-on-scroll reveal-heading">
              <p>THE BIG DAY</p>
              <h2 className="script-heading">Save the Date</h2>
              <p className="wedding-date-display">Saturday · March 20, 2027</p>
              <span>
                We cannot wait to celebrate this special day with you.
              </span>
            </div>

            <div className="countdown reveal-on-scroll reveal-scale">
              <div>
                <strong>{countdown.days}</strong>
                <span>Days</span>
              </div>
              <div>
                <strong>{String(countdown.hours).padStart(2, "0")}</strong>
                <span>Hours</span>
              </div>
              <div>
                <strong>{String(countdown.minutes).padStart(2, "0")}</strong>
                <span>Minutes</span>
              </div>
              <div>
                <strong>{String(countdown.seconds).padStart(2, "0")}</strong>
                <span>Seconds</span>
              </div>
            </div>

            <div className="venue-grid">
              <article className="venue-card reveal-on-scroll reveal-up">
                <img
                  src="/images/ceremony.jpg"
                  alt="Diocesan Shrine and Parish of Saint Pio of Pietrelcina"
                />
                <div className="venue-card__overlay" />
                <div className="venue-card__content">
                  <p>CEREMONY</p>
                  <h3>
                    Diocesan Shrine and Parish of Saint Pio of Pietrelcina
                  </h3>
                  <span className="venue-card__time">4:00 PM</span>
                  <span className="venue-card__address">
                    106 Sumulong Hwy, Antipolo, 1870 Rizal
                  </span>
                  <a
                    className="venue-card__map-button"
                    href="https://maps.app.goo.gl/ywzhGAg79RuC541s8"
                    target="_blank"
                    rel="noreferrer"
                  >
                    VIEW ON GOOGLE MAPS
                  </a>
                </div>
              </article>

              <article className="venue-card reveal-on-scroll reveal-up">
                <img
                  src="/images/reception.jpg"
                  alt="LeBlanc Hotel and Resort"
                />
                <div className="venue-card__overlay" />
                <div className="venue-card__content">
                  <p>RECEPTION</p>
                  <h3>LeBlanc Hotel and Resort</h3>
                  <span className="venue-card__time">6:00 PM</span>
                  <span className="venue-card__address">
                    3 Taktak Rd, Antipolo, 1870 Rizal
                  </span>
                  <a
                    className="venue-card__map-button"
                    href="https://maps.app.goo.gl/s6W7RyrZj3EhZxxbA"
                    target="_blank"
                    rel="noreferrer"
                  >
                    VIEW ON GOOGLE MAPS
                  </a>
                </div>
              </article>
            </div>
          </section>

          <SectionSeparator />

          {/* ===============================================
              PART 06: ANIMATED WEDDING TIMELINE
          =============================================== */}

          <section id="timeline" className="timeline-section">
            <div className="section-heading reveal-on-scroll reveal-heading">
              <p>OUR WEDDING DAY</p>
              <h2 className="script-heading">Wedding Timeline</h2>
              <span>A little guide to the moments we will share together.</span>
            </div>

            <div className="timeline-list reveal-on-scroll reveal-timeline">
              <div className="timeline-list__progress" aria-hidden="true" />

              {[
                [
                  "3:00 PM",
                  "Guest Arrival",
                  "Welcome, settle in, and get ready for the celebration.",
                ],
                [
                  "4:00 PM",
                  "Wedding Ceremony",
                  "Join us as we exchange vows and begin our forever.",
                ],
                [
                  "5:00 PM",
                  "Photo Session",
                  "Family, friends, and newlywed photos after the ceremony.",
                ],
                [
                  "6:00 PM",
                  "Reception",
                  "Dinner, speeches, laughter, and celebration.",
                ],
                [
                  "8:00 PM",
                  "Dancing & Celebration",
                  "Let us end the evening with music and unforgettable memories.",
                ],
              ].map(([time, title, description]) => (
                <div
                  className="timeline-item reveal-on-scroll reveal-left"
                  key={time}
                >
                  <span className="timeline-item__time">{time}</span>
                  <div className="timeline-item__dot" />
                  <div className="timeline-item__content">
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <SectionSeparator />

          {/* ===============================================
              PART 07: ENTOURAGE FROM EXCEL
              Source: /public/data/entourage.xlsx
          =============================================== */}

          <section id="entourage" className="entourage-section">
            <div className="section-heading reveal-on-scroll reveal-heading">
              <p>THE PEOPLE WE LOVE</p>
              <h2 className="script-heading">Entourage</h2>
              <span>
                The special people who will stand beside us on our wedding day.
              </span>
            </div>

            {entourageLoading ? (
              <div className="entourage-status reveal-on-scroll reveal-up">
                Loading entourage…
              </div>
            ) : null}

            {!entourageLoading && entourageError ? (
              <div className="entourage-status entourage-status--error">
                <strong>Entourage list could not be loaded.</strong>
                <span>
                  Check <code>/public/data/entourage.xlsx</code> and keep the
                  worksheet/column names from the supplied template.
                </span>
              </div>
            ) : null}

            {!entourageLoading && !entourageError ? (
              <div className="entourage-grid">
                {entourageGroups.map((group) => {
                  const wide =
                    group.people.length >= 6 ||
                    /principal|secondary/i.test(group.title);

                  return (
                    <article
                      key={group.title}
                      className={`entourage-group reveal-on-scroll reveal-up${
                        wide ? " entourage-group--wide" : ""
                      }`}
                    >
                      <h3>{group.title}</h3>

                      {group.people.length > 0 ? (
                        <div className="entourage-group__people">
                          {group.people.map((person, index) => (
                            <div
                              className="entourage-person"
                              key={`${group.title}-${person.name}-${index}`}
                            >
                              {person.role ? (
                                <span className="entourage-person__role">
                                  {person.role}
                                </span>
                              ) : null}
                              <strong>{person.name}</strong>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="entourage-empty">Names to be added.</p>
                      )}
                    </article>
                  );
                })}

                {entourageGroups.length === 0 ? (
                  <div className="entourage-status">
                    No entourage groups are currently listed in the Excel file.
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <SectionSeparator />

          {/* ===============================================
              PART 08: DRESS CODE
          =============================================== */}

          <section id="dresscode" className="dresscode-section">
            <div className="section-heading reveal-on-scroll reveal-heading">
              <p>WHAT TO WEAR</p>
              <h2 className="script-heading">Dress Code</h2>
              <span>
                We would love to see you dressed in colors that complement our
                wedding palette.
              </span>
            </div>

            <div className="dresscode-guide reveal-on-scroll reveal-scale">
              <img
                src="/images/wedding-attire-guide.png"
                alt="Wedding attire guide in violet, lavender, blush, and soft pink"
              />
            </div>

            <div className="dresscode-content">
              <div className="dresscode-card reveal-on-scroll reveal-up">
                <p className="card-label">GENTLEMEN</p>
                <h3>Formal Attire</h3>
                <p>
                  Suit, long sleeves, or formal barong paired with dress pants
                  and formal shoes.
                </p>
                <div className="dresscode-icon">♙</div>
              </div>

              <div className="dresscode-card reveal-on-scroll reveal-up">
                <p className="card-label">LADIES</p>
                <h3>Formal Attire</h3>
                <p>
                  Long dress, midi dress, or elegant formal wear appropriate for
                  the occasion.
                </p>
                <div className="dresscode-icon">♕</div>
              </div>
            </div>

            <div className="wedding-palette reveal-on-scroll reveal-up">
              <p>OUR WEDDING PALETTE</p>
              <div className="palette-colors">
                <span className="palette-color palette-color--1" />
                <span className="palette-color palette-color--2" />
                <span className="palette-color palette-color--3" />
                <span className="palette-color palette-color--4" />
                <span className="palette-color palette-color--5" />
              </div>
              <p className="wedding-palette__note">
                Violet · Lavender · Lilac · Blush · Soft Pink
              </p>
            </div>
          </section>

          <SectionSeparator />

          {/* ===============================================
              PART 09: OUR MOMENTS / YOUTUBE
          =============================================== */}

          <section id="moments" className="moments-section">
            <div className="section-heading reveal-on-scroll reveal-heading">
              <p>OUR MEMORIES</p>
              <h2 className="script-heading">Our Moments</h2>
              <span>
                A collection of little moments, beautiful memories, and the
                journey that brought us here.
              </span>
            </div>

            <div className="moments-video reveal-on-scroll reveal-scale">
              <div className="moments-video__frame">
                <div className="moments-video__youtube">
                  {!momentsVideoStarted ? (
                    <button
                      className="moments-video__start"
                      type="button"
                      onClick={playMomentsVideo}
                      aria-label="Play John Paul and Joyce wedding video"
                    >
                      <img
                        src="https://img.youtube.com/vi/fu9yk7gCTbc/maxresdefault.jpg"
                        alt="John Paul and Joyce Our Moments video"
                      />
                      <span className="moments-video__shade" />
                      <span className="moments-video__play">▶</span>
                      <span className="moments-video__play-text">
                        Play Our Moments
                      </span>
                    </button>
                  ) : (
                    <iframe
                      src="https://www.youtube-nocookie.com/embed/fu9yk7gCTbc?autoplay=1&rel=0&modestbranding=1"
                      title="John Paul and Joyce - Our Moments"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  )}
                </div>

                <div className="moments-video__corner moments-video__corner--tl">
                  ♡
                </div>
                <div className="moments-video__corner moments-video__corner--br">
                  ♡
                </div>
              </div>

              <p className="moments-video__caption">
                Every love story is beautiful, but ours is our favorite.
              </p>
            </div>
          </section>

          <SectionSeparator />

          {/* ===============================================
              PART 10: GIFT GUIDE
              Source text/QR paths: wedding-config.json
          =============================================== */}

          <section id="gift" className="gift-section">
            <div className="section-heading reveal-on-scroll reveal-heading">
              <p>WITH LOVE</p>
              <h2 className="script-heading">Gift Guide</h2>
              <span>
                Your presence on our wedding day is already a gift to us. If you
                would still like to bless us with something, a monetary gift
                would be greatly appreciated.
              </span>
            </div>

            <div className="gift-options">
              <article className="gift-card reveal-on-scroll reveal-up">
                <div className="gift-card__icon">♡</div>
                <p className="card-label">CASH GIFT</p>
                <h3>A Little Something</h3>
                <p>
                  A monetary gift would help us as we begin our new chapter
                  together.
                </p>
              </article>

              <article className="gift-card reveal-on-scroll reveal-up">
                <div className="gift-card__icon">▦</div>
                <p className="card-label">DIGITAL GIFT</p>
                <h3>Scan & Send</h3>
                <p>
                  You may also send your gift digitally using the details below.
                </p>
              </article>
            </div>

            <div className="gift-qr-grid">
              {giftMethods.map((method) => (
                <article
                  className="gift-qr-card reveal-on-scroll reveal-up"
                  key={method.title}
                >
                  {method.qr ? (
                    <img
                      className="gift-qr-card__image"
                      src={method.qr}
                      alt={`${method.title} payment QR code`}
                    />
                  ) : (
                    <div className="gift-qr-placeholder">
                      <span>QR</span>
                      <small>Add image path in wedding-config.json</small>
                    </div>
                  )}

                  <h3>{method.title}</h3>
                  <p className="gift-qr-card__owner">{method.owner}</p>

                  {method.account ? (
                    <p className="gift-qr-card__account">{method.account}</p>
                  ) : null}

                  {method.details?.map((detail) => (
                    <p className="gift-qr-card__detail" key={detail}>
                      {detail}
                    </p>
                  ))}
                </article>
              ))}
            </div>

            <p className="gift-section__closing">
              Thank you for your love, prayers, and support.
            </p>
          </section>

          <SectionSeparator />

          {/* ===============================================
              PART 11: FRIENDLY REMINDERS
          =============================================== */}

          <section id="reminders" className="reminders-section">
            <div className="section-heading reveal-on-scroll reveal-heading">
              <p>A FEW NOTES</p>
              <h2 className="script-heading">Friendly Reminders</h2>
              <span>
                A few little things to help us make the celebration smooth,
                meaningful, and enjoyable for everyone.
              </span>
            </div>

            <div className="reminders-grid">
              <article className="reminder-card reveal-on-scroll reveal-up">
                <div className="reminder-card__icon">⏰</div>
                <span className="reminder-card__number">01</span>
                <h3>Please Arrive On Time</h3>
                <p>
                  We kindly ask guests to arrive at least 30 minutes before the
                  ceremony begins.
                </p>
              </article>

              <article className="reminder-card reveal-on-scroll reveal-up">
                <div className="reminder-card__icon">♡</div>
                <span className="reminder-card__number">02</span>
                <h3>Unplugged Ceremony</h3>
                <p>
                  During the ceremony, please keep phones and cameras tucked
                  away so everyone can be fully present.
                </p>
              </article>

              <article className="reminder-card reveal-on-scroll reveal-up">
                <div className="reminder-card__icon">✦</div>
                <span className="reminder-card__number">03</span>
                <h3>Dress With Us</h3>
                <p>
                  We would love for our guests to follow the suggested formal
                  attire and wedding color palette.
                </p>
              </article>

              <article className="reminder-card reveal-on-scroll reveal-up">
                <div className="reminder-card__icon">✉</div>
                <span className="reminder-card__number">04</span>
                <h3>RSVP Kindly</h3>
                <p>
                  Please confirm your attendance on or before
                  <strong> {weddingConfig.rsvpDeadlineDisplay}</strong> so we
                  can prepare your seat.
                </p>
              </article>
            </div>

            <p className="reminders-section__closing">
              Thank you for celebrating with us.
            </p>
          </section>

          <SectionSeparator />

          {/* ===============================================
              PART 12: SCAN & SHARE
          =============================================== */}

          <section id="share" className="share-section">
            <div className="section-heading reveal-on-scroll reveal-heading">
              <p>SHARE THE MOMENTS</p>
              <h2 className="script-heading">Scan & Share</h2>
              <span>
                Help us collect the memories from our special day. Scan the QR
                code and share your favorite photos and videos with us.
              </span>
            </div>

            <div className="share-card reveal-on-scroll reveal-scale">
              <a
                className="share-card__qr"
                href="https://drive.google.com/drive/folders/10x8pRFkonk3lY9Ok7nEPwljyz6VPygd9?usp=sharing"
                target="_blank"
                rel="noreferrer"
                aria-label="Open our wedding gallery"
              >
                <img
                  src="/images/wedding-share-qr.png"
                  alt="QR code for John Paul and Joyce wedding gallery"
                />
              </a>

              <div className="share-card__content">
                <p className="card-label">OUR WEDDING GALLERY</p>
                <h3>Capture. Share. Remember.</h3>
                <p>
                  Whether it is a candid moment, a beautiful portrait, or a
                  video from the celebration, we would love to see the day
                  through your eyes.
                </p>
                <a
                  className="share-card__button"
                  href="https://drive.google.com/drive/folders/10x8pRFkonk3lY9Ok7nEPwljyz6VPygd9?usp=sharing"
                  target="_blank"
                  rel="noreferrer"
                >
                  OPEN WEDDING GALLERY
                </a>
              </div>
            </div>
          </section>

          <SectionSeparator />

          {/* ===============================================
              PART 13: RSVP + SUCCESS ANIMATION
          =============================================== */}

          <section id="rsvp" className="rsvp-section">
            <div className="section-heading reveal-on-scroll reveal-heading">
              <p>WILL YOU JOIN US?</p>
              <h2 className="script-heading">RSVP</h2>
              <span>
                We would be honored to celebrate our wedding day with you.
                Please enter the invitation code included with your invitation.
              </span>
              <p className="rsvp-deadline">
                RSVP deadline:{" "}
                <strong>{weddingConfig.rsvpDeadlineDisplay}</strong>
              </p>
            </div>

            <div className="rsvp-shell reveal-on-scroll reveal-up">
              <div className="rsvp-shell__ornament">♡</div>

              <div className="rsvp-section__card">
                {!verifiedGuest ? (
                  <InvitationVerificationForm
                    onVerified={(guest, existingRSVP) => {
                      setVerifiedGuest(guest);
                      setHasExistingRSVP(existingRSVP);
                      setRSVPResponse(null);
                    }}
                  />
                ) : null}

                {verifiedGuest && !rsvpResponse ? (
                  <>
                    <div className="rsvp-guest-summary">
                      <p>WELCOME</p>
                      <h3>
                        {verifiedGuest.first_name} {verifiedGuest.last_name}
                      </h3>
                      <span>
                        Invitation Code: {verifiedGuest.invitation_code}
                      </span>

                      {hasExistingRSVP ? (
                        <p className="rsvp-existing-note">
                          You already have an RSVP on file. Submitting this form
                          will update your response.
                        </p>
                      ) : null}
                    </div>

                    <RSVPForm
                      guest={verifiedGuest}
                      onSubmitted={(response) => setRSVPResponse(response)}
                    />
                  </>
                ) : null}

                {rsvpResponse ? (
                  <div className="rsvp-confirmation rsvp-confirmation--success">
                    <div
                      className="rsvp-confirmation__sparkles"
                      aria-hidden="true"
                    >
                      {Array.from({ length: 10 }).map((_, index) => (
                        <span key={index}>✦</span>
                      ))}
                    </div>

                    <div
                      className="rsvp-confirmation__success-mark"
                      aria-hidden="true"
                    >
                      ✓
                    </div>

                    <p>THANK YOU</p>
                    <h3>RSVP Received</h3>
                    <p>{rsvpResponse.message}</p>

                    <div className="rsvp-confirmation__status">
                      <span>Your response</span>
                      <strong>
                        {rsvpResponse.rsvp.status === "attending"
                          ? "Attending"
                          : "Unable to Attend"}
                      </strong>
                    </div>

                    <button type="button" onClick={() => setRSVPResponse(null)}>
                      Update RSVP
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* ===============================================
              PART 14: ANIMATED CLOSING
          =============================================== */}

          <section className="closing-section">
            <div className="closing-section__overlay" />

            <div className="closing-section__content reveal-on-scroll reveal-closing">
              <p className="closing-section__eyebrow">WITH LOVE</p>
              <h2>
                John Paul
                <span>&</span>
                Joyce
              </h2>
              <p className="closing-section__message">
                Thank you for being part of our story. We cannot wait to
                celebrate this beautiful day with you.
              </p>

              <div className="closing-section__divider">
                <span />
                <strong>♡</strong>
                <span />
              </div>

              <p className="closing-section__date">
                SATURDAY · MARCH 20 · 2027
              </p>
              <p className="closing-section__location">Antipolo, Rizal</p>

              <a className="closing-section__rsvp-button" href="#rsvp">
                RSVP NOW
              </a>

              <p className="closing-section__copyright">
                John Paul & Joyce Wedding
              </p>
            </div>
          </section>

          {/* ===============================================
              MOBILE / DESKTOP BACK TO TOP
          =============================================== */}

          <button
            className={`back-to-top${showBackToTop ? " is-visible" : ""}`}
            type="button"
            onClick={scrollBackToTop}
            aria-label="Back to top"
            title="Back to top"
          >
            ↑
          </button>
        </main>
      )}
    </>
  );
}

export default App;
