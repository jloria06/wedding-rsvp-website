import { useEffect, useRef, useState } from "react";
import { InvitationVerificationForm } from "./components/InvitationVerificationForm";
import { RSVPForm } from "./components/RSVPForm";
import type { GuestSummary, RSVPSubmissionResponse } from "./types/rsvp";

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

function App() {
  const weddingDate = new Date("2027-03-20T00:00:00+08:00");

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const [invitationOpened, setInvitationOpened] = useState(false);

  const [verifiedGuest, setVerifiedGuest] = useState<GuestSummary | null>(null);

  const [hasExistingRSVP, setHasExistingRSVP] = useState(false);

  const [rsvpResponse, setRSVPResponse] =
    useState<RSVPSubmissionResponse | null>(null);

  /* ========================================
     LIVE WEDDING COUNTDOWN
  ======================================== */

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

      const days = Math.floor(
        difference / (1000 * 60 * 60 * 24),
      );

      const hours = Math.floor(
        (difference / (1000 * 60 * 60)) % 24,
      );

      const minutes = Math.floor(
        (difference / (1000 * 60)) % 60,
      );

      const seconds = Math.floor(
        (difference / 1000) % 60,
      );

      setCountdown({
        days,
        hours,
        minutes,
        seconds,
      });
    }

    updateCountdown();

    const timer = window.setInterval(
      updateCountdown,
      1000,
    );

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  /* ========================================
     SCROLL REVEAL ANIMATION
  ======================================== */

  useEffect(() => {
    if (!invitationOpened) {
      return;
    }

    const elements =
      document.querySelectorAll<HTMLElement>(
        ".reveal-on-scroll",
      );

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
        threshold: 0.15,
        rootMargin: "0px 0px -60px 0px",
      },
    );

    elements.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, [invitationOpened]);

  /* ========================================
     MUSIC
  ======================================== */

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
        <main className="invitation-cover">
          <OrnateFrame />
          <div className="invitation-cover__background" />
          <div className="invitation-cover__overlay" />

          <section className="invitation-cover__content">
            <p className="invitation-cover__eyebrow">YOU ARE INVITED</p>

            <div className="invitation-cover__portrait">
              <img src="/images/portrait.jpg" alt="John Paul and Joyce" />

              <div className="invitation-cover__monogram">
                JP
                <span>&</span>Joyce
              </div>
            </div>

            <h1 className="invitation-cover__names">
              John Paul
              <span>&</span>
              Joyce
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
        <main className="wedding-page">
          <OrnateFrame />

          <div className="petal petal--1">✦</div>
          <div className="petal petal--2">✧</div>
          <div className="petal petal--3">✦</div>

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

          <nav className="wedding-nav">
            <a className="wedding-nav__brand" href="#welcome">
              JP <span>&</span> J
            </a>

            <div className="wedding-nav__links">
              <a href="#story">Our Story</a>
              <a href="#details">Details</a>
              <a href="#entourage">Entourage</a>
              <a href="#dresscode">Dress Code</a>
              <a href="#rsvp">RSVP</a>
            </div>
          </nav>

          {/* =================================
                  WELCOME
              ================================= */}

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
                <div className="welcome-section__photo welcome-section__photo--large reveal-on-scroll reveal-up">
                  <img src="/images/gallery-1.jpg" alt="John Paul and Joyce" />
                </div>

                <div className="welcome-section__photo reveal-on-scroll reveal-up">
                  <img src="/images/gallery-2.jpg" alt="John Paul and Joyce" />
                </div>

                <div className="welcome-section__photo reveal-on-scroll reveal-up">
                  <img src="/images/gallery-3.jpg" alt="John Paul and Joyce" />
                </div>

                <div className="welcome-section__photo reveal-on-scroll reveal-up">
                  <img src="/images/gallery-4.jpg" alt="John Paul and Joyce" />
                </div>

                <div className="welcome-section__photo reveal-on-scroll reveal-up">
                  <img src="/images/gallery-5.jpg" alt="John Paul and Joyce" />
                </div>
              </div>
            </div>
          </section>

          {/* =================================
                  OUR STORY
              ================================= */}

          <section id="story" className="story-section">
            <div className="section-heading reveal-on-scroll reveal-up">
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

          {/* =================================
                  SAVE THE DATE
              ================================= */}

          <section id="details" className="details-section">
            <div className="section-heading">
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

          {/* =================================
                  TIMELINE
              ================================= */}

          <section id="timeline" className="timeline-section">
            <div className="section-heading">
              <p>OUR WEDDING DAY</p>

              <h2 className="script-heading">Wedding Timeline</h2>

              <span>A little guide to the moments we will share together.</span>
            </div>

            <div className="timeline-list">
              <div className="timeline-item reveal-on-scroll reveal-left">
                <span className="timeline-item__time">3:00 PM</span>

                <div className="timeline-item__dot" />

                <div className="timeline-item__content">
                  <h3>Guest Arrival</h3>

                  <p>Welcome, settle in, and get ready for the celebration.</p>
                </div>
              </div>

              <div className="timeline-item reveal-on-scroll reveal-left">
                <span className="timeline-item__time">4:00 PM</span>

                <div className="timeline-item__dot" />

                <div className="timeline-item__content">
                  <h3>Wedding Ceremony</h3>

                  <p>Join us as we exchange vows and begin our forever.</p>
                </div>
              </div>

              <div className="timeline-item reveal-on-scroll reveal-left">
                <span className="timeline-item__time">5:00 PM</span>

                <div className="timeline-item__dot" />

                <div className="timeline-item__content">
                  <h3>Photo Session</h3>

                  <p>
                    Family, friends, and newlywed photos after the ceremony.
                  </p>
                </div>
              </div>

              <div className="timeline-item reveal-on-scroll reveal-left">
                <span className="timeline-item__time">6:00 PM</span>

                <div className="timeline-item__dot" />

                <div className="timeline-item__content">
                  <h3>Reception</h3>

                  <p>Dinner, speeches, laughter, and celebration.</p>
                </div>
              </div>

              <div className="timeline-item reveal-on-scroll reveal-left">
                <span className="timeline-item__time">8:00 PM</span>

                <div className="timeline-item__dot" />

                <div className="timeline-item__content">
                  <h3>Dancing & Celebration</h3>

                  <p>
                    Let us end the evening with music and unforgettable
                    memories.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* =================================
                  ENTOURAGE
              ================================= */}

          <section id="entourage" className="entourage-section">
            <div className="section-heading">
              <p>THE PEOPLE WE LOVE</p>

              <h2 className="script-heading">Entourage</h2>

              <span>
                The special people who will stand beside us on our wedding day.
              </span>
            </div>

            <div className="entourage-grid">
              <article className="entourage-group reveal-on-scroll reveal-up">
                <h3>Parents of the Groom</h3>
                <p>Father&apos;s Name</p>
                <p>Mother&apos;s Name</p>
              </article>

              <article className="entourage-group reveal-on-scroll reveal-up">
                <h3>Parents of the Bride</h3>
                <p>Father&apos;s Name</p>
                <p>Mother&apos;s Name</p>
              </article>

              <article className="entourage-group reveal-on-scroll reveal-up">
                <h3>Principal Sponsors</h3>
                <p>Sponsor Name</p>
                <p>Sponsor Name</p>
                <p>Sponsor Name</p>
                <p>Sponsor Name</p>
              </article>

              <article className="entourage-group reveal-on-scroll reveal-up">
                <h3>Best Man</h3>
                <p>Name Here</p>
              </article>

              <article className="entourage-group reveal-on-scroll reveal-up">
                <h3>Maid of Honor</h3>
                <p>Name Here</p>
              </article>

              <article className="entourage-group reveal-on-scroll reveal-up">
                <h3>Groomsmen</h3>
                <p>Name Here</p>
                <p>Name Here</p>
                <p>Name Here</p>
              </article>

              <article className="entourage-group reveal-on-scroll reveal-up">
                <h3>Bridesmaids</h3>
                <p>Name Here</p>
                <p>Name Here</p>
                <p>Name Here</p>
              </article>

              <article className="entourage-group reveal-on-scroll reveal-up">
                <h3>Secondary Sponsors</h3>
                <p>Candle Sponsors</p>
                <p>Veil Sponsors</p>
                <p>Cord Sponsors</p>
              </article>

              <article className="entourage-group entourage-group--last reveal-on-scroll reveal-up">
                <h3>Little Ones</h3>
                <p>Ring Bearer</p>
                <p>Coin Bearer</p>
                <p>Bible Bearer</p>
                <p>Flower Girl</p>
              </article>
            </div>
          </section>

          {/* =================================
                  DRESS CODE
              ================================= */}

          <section id="dresscode" className="dresscode-section">
            <div className="section-heading">
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

            <div className="wedding-palette">
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

          {/* =================================
                  GIFT GUIDE
              ================================= */}

          <section id="gift" className="gift-section">
            <div className="section-heading">
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
                  You may also send your gift digitally using the QR codes
                  below.
                </p>
              </article>
            </div>

            <div className="gift-qr-grid">
              <div className="gift-qr-card">
                <div className="gift-qr-placeholder">QR</div>

                <h3>GCash</h3>
                <p>John Paul</p>
              </div>

              <div className="gift-qr-card">
                <div className="gift-qr-placeholder">QR</div>

                <h3>Maya</h3>
                <p>Joyce</p>
              </div>

              <div className="gift-qr-card">
                <div className="gift-qr-placeholder">QR</div>

                <h3>Bank Transfer</h3>

                <p>Account details to follow</p>
              </div>
            </div>

            <p className="gift-section__closing">
              Thank you for your love, prayers, and support.
            </p>
          </section>

          {/* =================================
    REMINDERS
================================= */}

          <section id="reminders" className="reminders-section">
            <div className="section-heading">
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
                  Please confirm your attendance before the RSVP deadline so we
                  can prepare your seat.
                </p>
              </article>
            </div>

            <p className="reminders-section__closing">
              Thank you for celebrating with us.
            </p>
          </section>

          {/* =================================
    SCAN & SHARE
================================= */}

          <section id="share" className="share-section">
            <div className="section-heading">
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

          {/* =================================
                  RSVP
              ================================= */}

          <section id="rsvp" className="rsvp-section">
            <div className="section-heading">
              <p>WILL YOU JOIN US?</p>

              <h2 className="script-heading">RSVP</h2>

              <span>
                We would be honored to celebrate our wedding day with you.
                Please enter the invitation code included with your invitation.
              </span>
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
                      onSubmitted={(response) => {
                        setRSVPResponse(response);
                      }}
                    />
                  </>
                ) : null}

                {rsvpResponse ? (
                  <div className="rsvp-confirmation">
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

                    <button
                      type="button"
                      onClick={() => {
                        setRSVPResponse(null);
                      }}
                    >
                      Update RSVP
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* =================================
                  CLOSING
              ================================= */}

          <section className="closing-section">
            <div className="closing-section__overlay" />

            <div className="closing-section__content">
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
        </main>
      )}
    </>
  );
}

export default App;
