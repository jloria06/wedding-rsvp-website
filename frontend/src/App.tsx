import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

import { InvitationVerificationForm } from "./components/InvitationVerificationForm";
import { RSVPForm } from "./components/RSVPForm";
import { apiAssetUrl, apiRequest } from "./lib/api";
import {
  defaultWeddingContent,
  type WeddingContent,
} from "./types/content";
import type { GuestSummary, RSVPSubmissionResponse } from "./types/rsvp";

/* =========================================================
   TYPES
========================================================= */

type WeddingConfig = Partial<WeddingContent>;
type ResolvedWeddingConfig = WeddingContent;

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

const DEFAULT_WEDDING_CONFIG: ResolvedWeddingConfig = defaultWeddingContent;

/* =========================================================
   FULL-WIDTH PHOTO DIVIDER

   Each divider uses ONE dedicated image and appears between
   specific ivory floral content sections.

   Features:
   - borderless full-width photography
   - smooth fade-in as it enters the viewport
   - subtle scroll parallax
   - dark cinematic overlay for readable text
========================================================= */

type PhotoDividerProps = {
  image: string;
  eyebrow: string;
  title: string;
  position?: string;
};

function PhotoDivider({
  image,
  eyebrow,
  title,
  position = "center",
}: PhotoDividerProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [parallaxOffset, setParallaxOffset] = useState(0);

  useEffect(() => {
    let frameId = 0;

    function updateParallax() {
      const section = sectionRef.current;

      if (!section) {
        return;
      }

      const rect = section.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const sectionCenter = rect.top + rect.height / 2;

      const normalized =
        (viewportCenter - sectionCenter) /
        Math.max(window.innerHeight + rect.height, 1);

      const clamped = Math.max(-1, Math.min(1, normalized));

      setParallaxOffset(clamped * 48);
    }

    function requestUpdate() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateParallax);
    }

    updateParallax();

    window.addEventListener("scroll", requestUpdate, {
      passive: true,
    });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="photo-divider reveal-on-scroll"
      aria-label={title}
    >
      <div className="photo-divider__media" aria-hidden="true">
        <img
          src={image}
          alt=""
          style={{
            objectPosition: position,
            transform: `translate3d(0, ${parallaxOffset}px, 0) scale(1.1)`,
          }}
        />
      </div>

      <div className="photo-divider__overlay" aria-hidden="true" />

      <div className="photo-divider__content">
        <p>{eyebrow}</p>
        <h2>{title}</h2>

        <span className="photo-divider__ornament" aria-hidden="true">
          ♡
        </span>
      </div>
    </section>
  );
}

function StoryImageSlideshow({ images, title }: { images: string[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
    if (images.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [images]);

  return <div className="story-card__image">{images.map((image, index) => <img className={index === activeIndex ? "is-active" : ""} src={apiAssetUrl(image)} alt={index === activeIndex ? title : ""} aria-hidden={index === activeIndex ? undefined : true} key={`${image}-${index}`} />)}{images.length > 1 ? <div className="story-card__dots" aria-label={`${title} photo ${activeIndex + 1} of ${images.length}`}>{images.map((_, index) => <button type="button" className={index === activeIndex ? "is-active" : ""} onClick={() => setActiveIndex(index)} aria-label={`Show photo ${index + 1}`} key={index} />)}</div> : null}</div>;
}

/* =========================================================
   APP
========================================================= */

function App() {
  /* -------------------------------------------------------
     GLOBAL WEDDING CONFIGURATION
  ------------------------------------------------------- */

  const galleryImages = [
    "/images/gallery-1.jpg",
    "/images/gallery-2.jpg",
    "/images/gallery-3.jpg",
    "/images/gallery-4.jpg",
    "/images/gallery-5.jpg",
  ];

  /*
     CINEMATIC OPENING HERO

     These are the full-screen images shown immediately after
     the guest opens the invitation. The presentation is based
     on the supplied reference video: full-screen changing photos,
     centered wedding text, date details, and a floating navigation.

     You may replace these image paths later without changing
     the slideshow logic.
  */
  /*
     NEW CINEMATIC HERO PHOTOS

     Store these files in:
     frontend/public/images/

     This slideshow is independent from the original
     welcome gallery, which continues using gallery-1.jpg
     through gallery-5.jpg.
  */

  /*
     FULL-WIDTH PHOTO DIVIDER ASSETS

     Store these exact files in:
     frontend/public/images/

     Placement:
     1 = after Our Story
     2 = after Wedding Timeline
     3 = after Entourage

     These images are independent from the opening hero,
     gallery, and story photos.
  */

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
  const heroSlides = weddingConfig.heroImages.map(apiAssetUrl);
  const scrollDividerImages = weddingConfig.dividerImages.map(apiAssetUrl);
  const weddingDate = useMemo(
    () => new Date(weddingConfig.weddingDateIso),
    [weddingConfig.weddingDateIso],
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

  /* Loading screen shown before the invitation cover. */
  const [siteReady, setSiteReady] = useState(false);

  /* -------------------------------------------------------
     CINEMATIC HERO STATE
  ------------------------------------------------------- */

  const [heroSlideIndex, setHeroSlideIndex] = useState(0);

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
     INITIAL LOADING SCREEN

     Matches the reference video's ivory opening treatment.
     It waits for the browser load event and keeps the loader
     visible briefly so the transition feels intentional.
  ======================================================= */

  useEffect(() => {
    let timer: number | undefined;

    function finishLoading() {
      timer = window.setTimeout(() => {
        setSiteReady(true);
      }, 850);
    }

    if (document.readyState === "complete") {
      finishLoading();
    } else {
      window.addEventListener("load", finishLoading, { once: true });
    }

    return () => {
      window.removeEventListener("load", finishLoading);

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  /* =======================================================
     LOAD: WEDDING CONFIG JSON
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadWeddingConfig() {
      try {
        let incoming: WeddingConfig;
        try {
          const response = await apiRequest<{ success: boolean; content: WeddingContent }>(
            "/wedding-content",
          );
          incoming = response.content;
        } catch {
          const response = await fetch("/data/wedding-config.json", { cache: "no-store" });
          if (!response.ok) return;
          incoming = (await response.json()) as WeddingConfig;
        }

        if (cancelled) {
          return;
        }

        setWeddingConfig({
          ...DEFAULT_WEDDING_CONFIG,
          ...incoming,
          coverImage: incoming.coverImage || DEFAULT_WEDDING_CONFIG.coverImage,
          portraitImage: incoming.portraitImage || DEFAULT_WEDDING_CONFIG.portraitImage,
          heroImages: incoming.heroImages?.length ? incoming.heroImages : DEFAULT_WEDDING_CONFIG.heroImages,
          dividerImages: incoming.dividerImages?.length === 3 ? incoming.dividerImages : DEFAULT_WEDDING_CONFIG.dividerImages,
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
          ceremony: {
            ...DEFAULT_WEDDING_CONFIG.ceremony,
            ...(incoming.ceremony ?? {}),
            image: incoming.ceremony?.image || DEFAULT_WEDDING_CONFIG.ceremony.image,
          },
          reception: {
            ...DEFAULT_WEDDING_CONFIG.reception,
            ...(incoming.reception ?? {}),
            image: incoming.reception?.image || DEFAULT_WEDDING_CONFIG.reception.image,
          },
          storyItems: (incoming.storyItems ?? DEFAULT_WEDDING_CONFIG.storyItems).map((item, index) => ({
            ...item,
            image: item.image || DEFAULT_WEDDING_CONFIG.storyItems[index]?.image || DEFAULT_WEDDING_CONFIG.storyItems[0].image,
            images: item.images?.length ? item.images : [item.image || DEFAULT_WEDDING_CONFIG.storyItems[index]?.image || DEFAULT_WEDDING_CONFIG.storyItems[0].image],
          })),
          features: {
            ...DEFAULT_WEDDING_CONFIG.features,
            ...(incoming.features ?? {}),
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

      if (weddingConfig.entourageGroups.length > 0) {
        setEntourageGroups(
          weddingConfig.entourageGroups.map((group, groupIndex) => ({
            title: group.title,
            order: groupIndex + 1,
            people: group.people.map((person, personIndex) => ({
              ...person,
              order: personIndex + 1,
            })),
          })),
        );
        setEntourageLoading(false);
        return;
      }

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
  }, [weddingConfig.entourageGroups]);

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
  }, [weddingDate]);

  /* =======================================================
     CINEMATIC HERO SLIDESHOW

     Starts only after the invitation has been opened.
     A new photo fades in every 4.8 seconds.
  ======================================================= */

  useEffect(() => {
    if (!invitationOpened || heroSlides.length <= 1) {
      return;
    }

    const slideTimer = window.setInterval(() => {
      setHeroSlideIndex((current) => (current + 1) % heroSlides.length);
    }, 4800);

    return () => {
      window.clearInterval(slideTimer);
    };
  }, [invitationOpened, heroSlides.length]);

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

  if (!siteReady) {
    return (
      <main className="wedding-loader">
        <div className="wedding-loader__mark">
          <span>JP</span>
          <strong>&</strong>
          <span>J</span>
        </div>

        <p>OUR WEDDING INVITATION</p>

        <div className="wedding-loader__line" aria-hidden="true">
          <span />
        </div>
      </main>
    );
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
          <div className="invitation-cover__background" style={{ backgroundImage: `url("${apiAssetUrl(weddingConfig.coverImage)}")` }} />
          <div className="invitation-cover__overlay" />

          <section className="invitation-cover__content">
            <p className="invitation-cover__eyebrow">YOU ARE INVITED</p>

            <div className="invitation-cover__portrait">
              <img src={apiAssetUrl(weddingConfig.portraitImage)} alt="John Paul and Joyce" />

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
              FALLING PETALS
              Inspired by the supplied reference video.
          =============================================== */}

          <div className="falling-petals" aria-hidden="true">
            {Array.from({ length: 20 }).map((_, index) => (
              <span className="falling-petal" key={`falling-petal-${index}`} />
            ))}
          </div>

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
              {weddingConfig.features.story ? <a
                className={activeSection === "story" ? "is-active" : undefined}
                href="#story"
                onClick={closeMobileMenu}
              >
                Our Story
              </a> : null}
              {weddingConfig.features.details ? <a
                className={
                  activeSection === "details" ? "is-active" : undefined
                }
                href="#details"
                onClick={closeMobileMenu}
              >
                Details
              </a> : null}
              {weddingConfig.features.entourage ? <a
                className={
                  activeSection === "entourage" ? "is-active" : undefined
                }
                href="#entourage"
                onClick={closeMobileMenu}
              >
                Entourage
              </a> : null}
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
              {weddingConfig.features.rsvp ? <a
                className={activeSection === "rsvp" ? "is-active" : undefined}
                href="#rsvp"
                onClick={closeMobileMenu}
              >
                RSVP
              </a> : null}
            </div>
          </nav>

          {/* ===============================================
              PART 03: WELCOME + CLICKABLE PHOTO GALLERY
          =============================================== */}

          <section id="welcome" className="welcome-section">
            {/* =============================================
                CINEMATIC OPENING HERO

                Inspired by the supplied reference video:
                - full viewport portrait/photo slideshow
                - dark cinematic overlay
                - centered "We Do" treatment
                - couple names + wedding date
                - slideshow progress indicators
            ============================================= */}

            <div className="welcome-hero">
              <div className="welcome-hero__slides" aria-hidden="true">
                {heroSlides.map((image, index) => (
                  <div
                    className={`welcome-hero__slide${
                      index === heroSlideIndex ? " is-active" : ""
                    }`}
                    key={image}
                    style={{
                      backgroundImage: `url("${image}")`,
                    }}
                  />
                ))}
              </div>

              <div className="welcome-hero__overlay" aria-hidden="true" />
              <div className="welcome-hero__vignette" aria-hidden="true" />

              <div className="welcome-hero__content">
                <p className="welcome-hero__pretitle">
                  TOGETHER WITH OUR FAMILIES
                </p>

                <h1 className="welcome-hero__we-do">
                  <span>We</span>
                  <strong aria-hidden="true">♡</strong>
                  <span>Do</span>
                </h1>

                <p className="welcome-hero__names">
                  John Paul <span>&</span> Joyce
                </p>

                <div className="welcome-hero__date">
                  <span className="welcome-hero__date-side">SATURDAY</span>

                  <div className="welcome-hero__date-center">
                    <span>MARCH</span>
                    <strong>20</strong>
                    <span>2027</span>
                  </div>

                  <span className="welcome-hero__date-side">4:00 PM</span>
                </div>

                <p className="welcome-hero__location">Antipolo, Rizal</p>
              </div>

              <div
                className="welcome-hero__indicators"
                aria-label="Wedding photo slideshow"
              >
                {heroSlides.map((image, index) => (
                  <button
                    className={
                      index === heroSlideIndex
                        ? "welcome-hero__indicator is-active"
                        : "welcome-hero__indicator"
                    }
                    type="button"
                    key={`hero-indicator-${image}`}
                    onClick={() => setHeroSlideIndex(index)}
                    aria-label={`Show wedding photo ${index + 1}`}
                    aria-current={index === heroSlideIndex ? "true" : undefined}
                  >
                    <span />
                  </button>
                ))}
              </div>

              <a
                className="scroll-cue scroll-cue--hero"
                href="#welcome-intro"
                aria-label="Explore our story"
              >
                <span>Explore Our Story</span>

                <div className="scroll-cue__mouse">
                  <div className="scroll-cue__wheel" />
                </div>

                <div className="scroll-cue__arrow">↓</div>
              </a>
            </div>

            {/* =============================================
                WELCOME INTRO + CLICKABLE PHOTO GALLERY
            ============================================= */}

            <div
              id="welcome-intro"
              className="welcome-section__content floral-section"
            >
              <div className="welcome-section__intro reveal-on-scroll reveal-heading">
                <p className="welcome-section__eyebrow">John Paul & Joyce</p>

                <h2 className="welcome-section__title">
                  We are getting married
                </h2>

                <p className="welcome-section__subtitle">
                  And we would love to celebrate this special day with you.
                </p>

                <div className="section-divider">
                  <span />
                  <strong>♡</strong>
                  <span />
                </div>
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

          {/* ===============================================
              PART 04: OUR STORY
          =============================================== */}

          {weddingConfig.features.story ? <section id="story" className="story-section floral-section">
            <div className="section-heading reveal-on-scroll reveal-heading">
              <p>OUR STORY</p>
              <h2>{weddingConfig.storyHeading}</h2>
            </div>

            <div className="story-section__timeline">
              {weddingConfig.storyItems.map((item, index) => (
                <article className={`story-card${index % 2 ? " story-card--reverse reveal-on-scroll reveal-right" : " reveal-on-scroll reveal-left"}`} key={`${item.title}-${index}`}>
                  <StoryImageSlideshow images={item.images.length ? item.images : [item.image]} title={item.title} />
                  <div className="story-card__content"><span className="story-card__number">{String(index + 1).padStart(2, "0")}</span><p className="story-card__eyebrow">{item.eyebrow}</p><h3>{item.title}</h3><p>{item.body}</p></div>
                </article>
              ))}
            </div>
          </section> : null}

          {/* ===============================================
              FULL-WIDTH PHOTO DIVIDER #1
              Placement: after Our Story
              No floral border by design.
          =============================================== */}

          <PhotoDivider
            image={scrollDividerImages[0]}
            eyebrow="OUR JOURNEY"
            title="The days that became memories."
            position="center center"
          />

          {/* ===============================================
              PART 05: SAVE THE DATE + VENUES
          =============================================== */}

          {weddingConfig.features.details ? <section id="details" className="details-section floral-section">
            <div className="section-heading reveal-on-scroll reveal-heading">
              <p>THE BIG DAY</p>
              <h2 className="script-heading">Save the Date</h2>
              <p className="wedding-date-display">{weddingConfig.weddingDateDisplay}</p>
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
                  src={apiAssetUrl(weddingConfig.ceremony.image)}
                  alt={weddingConfig.ceremony.name}
                />
                <div className="venue-card__overlay" />
                <div className="venue-card__content">
                  <p>CEREMONY</p>
                  <h3>{weddingConfig.ceremony.name}</h3>
                  <span className="venue-card__time">{weddingConfig.ceremony.time}</span>
                  <span className="venue-card__address">{weddingConfig.ceremony.address}</span>
                  <a
                    className="venue-card__map-button"
                    href={weddingConfig.ceremony.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    VIEW ON GOOGLE MAPS
                  </a>
                </div>
              </article>

              <article className="venue-card reveal-on-scroll reveal-up">
                <img
                  src={apiAssetUrl(weddingConfig.reception.image)}
                  alt={weddingConfig.reception.name}
                />
                <div className="venue-card__overlay" />
                <div className="venue-card__content">
                  <p>RECEPTION</p>
                  <h3>{weddingConfig.reception.name}</h3>
                  <span className="venue-card__time">{weddingConfig.reception.time}</span>
                  <span className="venue-card__address">{weddingConfig.reception.address}</span>
                  <a
                    className="venue-card__map-button"
                    href={weddingConfig.reception.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    VIEW ON GOOGLE MAPS
                  </a>
                </div>
              </article>
            </div>
          </section> : null}

          {/* ===============================================
              PART 06: ANIMATED WEDDING TIMELINE
          =============================================== */}

          <section id="timeline" className="timeline-section floral-section">
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

          {/* ===============================================
              FULL-WIDTH PHOTO DIVIDER #2
              Placement: after Wedding Timeline
              No floral border by design.
          =============================================== */}

          <PhotoDivider
            image={scrollDividerImages[1]}
            eyebrow="OUR MEMORIES"
            title="Little moments, forever remembered."
            position="center center"
          />

          {/* ===============================================
              PART 07: ENTOURAGE FROM EXCEL
              Source: /public/data/entourage.xlsx
          =============================================== */}

          {weddingConfig.features.entourage ? <section id="entourage" className="entourage-section floral-section">
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
          </section> : null}

          {/* ===============================================
              FULL-WIDTH PHOTO DIVIDER #3
              Placement: after Entourage
              No floral border by design.
          =============================================== */}

          <PhotoDivider
            image={scrollDividerImages[2]}
            eyebrow="OUR FOREVER"
            title="A beautiful new chapter begins."
            position="center center"
          />

          {/* ===============================================
              PART 08: DRESS CODE
          =============================================== */}

          <section id="dresscode" className="dresscode-section floral-section">
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

          {/* ===============================================
              PART 09: OUR MOMENTS / YOUTUBE
          =============================================== */}

          <section id="moments" className="moments-section floral-section">
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

          {/* ===============================================
              PART 10: GIFT GUIDE
              Source text/QR paths: wedding-config.json
          =============================================== */}

          {weddingConfig.features.gift ? <section id="gift" className="gift-section floral-section">
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
                      src={apiAssetUrl(method.qr)}
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
          </section> : null}

          {/* ===============================================
              PART 11: FRIENDLY REMINDERS
          =============================================== */}

          <section id="reminders" className="reminders-section floral-section">
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

          {/* ===============================================
              PART 12: SCAN & SHARE
          =============================================== */}

          <section id="share" className="share-section floral-section">
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

          {/* ===============================================
              PART 13: RSVP + SUCCESS ANIMATION
          =============================================== */}

          {weddingConfig.features.rsvp ? <section id="rsvp" className="rsvp-section floral-section">
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
          </section> : null}

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

              {weddingConfig.features.rsvp ? <a className="closing-section__rsvp-button" href="#rsvp">
                RSVP NOW
              </a> : null}

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
