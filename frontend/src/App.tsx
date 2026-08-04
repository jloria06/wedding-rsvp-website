import { useState } from "react";

import { InvitationVerificationForm } from "./components/InvitationVerificationForm";
import { RSVPForm } from "./components/RSVPForm";
import { WeddingNav } from "./components/WeddingNav";
import type { GuestSummary, RSVPSubmissionResponse } from "./types/rsvp";

function App() {
  const [verifiedGuest, setVerifiedGuest] = useState<GuestSummary | null>(null);

  const [hasExistingRSVP, setHasExistingRSVP] = useState(false);

  const [submissionResult, setSubmissionResult] =
    useState<RSVPSubmissionResponse | null>(null);

  function handleGuestVerified(
    guest: GuestSummary,
    existingRSVP: boolean,
  ): void {
    setVerifiedGuest(guest);
    setHasExistingRSVP(existingRSVP);
    setSubmissionResult(null);
  }

  function resetGuest(): void {
    setVerifiedGuest(null);
    setHasExistingRSVP(false);
    setSubmissionResult(null);
  }

  if (!verifiedGuest) {
    return (
      <>
        <WeddingNav
          onRSVPClick={() => {
            document.getElementById("invitation-heading")?.scrollIntoView({
              behavior: "smooth",
            });
          }}
        />

        <main id="top">
          <header className="wedding-header">
            <p className="wedding-eyebrow">Together with their families</p>

            <h1 className="couple-names">
              John Paul
              <span>&amp;</span>
              Joyce
            </h1>

            <p className="wedding-subtitle">
              We would be delighted to celebrate our wedding with you.
            </p>

            <div className="wedding-details" id="details">
              <div>
                <span className="detail-label">Date</span>
                <strong>Coming Soon</strong>
              </div>

              <div>
                <span className="detail-label">Ceremony</span>
                <strong>Details Coming Soon</strong>
              </div>

              <div>
                <span className="detail-label">Reception</span>
                <strong>Details Coming Soon</strong>
              </div>
            </div>
          </header>

          <section className="welcome-section" id="celebration">
            <p className="welcome-kicker">Our Celebration</p>

            <h2>We can&apos;t wait to celebrate with you</h2>

            <p>
              Your presence would mean so much to us as we begin this new
              chapter together. Please use your invitation code below to confirm
              your attendance and RSVP details.
            </p>
          </section>

          <InvitationVerificationForm onVerified={handleGuestVerified} />
        </main>
      </>
    );
  }

  const guestName = [
    verifiedGuest.first_name,
    verifiedGuest.middle_name,
    verifiedGuest.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  if (submissionResult) {
    const attending = submissionResult.rsvp.status === "attending";

    return (
      <main>
        <section className="confirmation-card">
          <p className="welcome-kicker">RSVP Confirmed</p>

          <h1>Thank you, {guestName}</h1>

          <p className="confirmation-message">{submissionResult.message}</p>

          <div className="confirmation-status">
            <span>RSVP Status</span>

            <strong>{attending ? "Attending" : "Not Attending"}</strong>
          </div>

          {attending ? (
            <p>
              We&apos;re looking forward to celebrating with you on our special
              day.
            </p>
          ) : (
            <p>
              Thank you for letting us know. You&apos;ll be in our thoughts on
              our special day.
            </p>
          )}

          <button type="button" onClick={resetGuest}>
            Finish
          </button>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="guest-welcome">
        <p className="welcome-kicker">Invitation Verified</p>

        <h1>Welcome, {guestName}</h1>

        <p>We&apos;re so happy to celebrate this special day with you.</p>

        <div className="guest-summary">
          <div>
            <span>Invitation</span>
            <strong>{verifiedGuest.invitation_code}</strong>
          </div>

          <div>
            <span>Companion allowance</span>
            <strong>{verifiedGuest.maximum_companions}</strong>
          </div>

          <div>
            <span>RSVP status</span>
            <strong>
              {hasExistingRSVP ? "Response received" : "Awaiting response"}
            </strong>
          </div>
        </div>

        {hasExistingRSVP ? (
          <p className="existing-rsvp-message">
            You already submitted an RSVP. You may update your response below.
          </p>
        ) : null}
      </section>

      <RSVPForm guest={verifiedGuest} onSubmitted={setSubmissionResult} />

      <div className="guest-actions">
        <button type="button" onClick={resetGuest}>
          Use another invitation
        </button>
      </div>
    </main>
  );
}

export default App;
