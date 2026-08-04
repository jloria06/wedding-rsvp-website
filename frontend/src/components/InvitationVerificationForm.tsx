import { useState, type FormEvent } from "react";

import { ApiError } from "../lib/api";
import { verifyInvitationCode } from "../services/rsvp";
import type { GuestSummary } from "../types/rsvp";

type InvitationVerificationFormProps = {
  onVerified: (guest: GuestSummary, hasExistingRSVP: boolean) => void;
};

export function InvitationVerificationForm({
  onVerified,
}: InvitationVerificationFormProps) {
  const [invitationCode, setInvitationCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const normalizedCode = invitationCode.trim();

    if (!normalizedCode) {
      setErrorMessage("Enter your invitation code.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await verifyInvitationCode(normalizedCode);

      onVerified(response.guest, response.has_existing_rsvp);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to verify your invitation right now.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="invitation-heading">
      <h1 id="invitation-heading">Wedding RSVP</h1>

      <p>Enter the invitation code included in your wedding invitation.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="invitation-code">Invitation code</label>

        <input
          id="invitation-code"
          name="invitationCode"
          type="text"
          autoComplete="off"
          value={invitationCode}
          onChange={(event) => setInvitationCode(event.target.value)}
          disabled={isSubmitting}
          maxLength={64}
          required
        />

        {errorMessage ? <p role="alert">{errorMessage}</p> : null}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Verifying..." : "Verify invitation"}
        </button>
      </form>
    </section>
  );
}
