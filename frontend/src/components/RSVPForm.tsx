import { useState, type ChangeEvent, type FormEvent } from "react";

import { ApiError } from "../lib/api";
import { submitRSVP } from "../services/rsvp";
import type {
  AttendanceType,
  GuestSummary,
  RSVPStatus,
  RSVPSubmissionResponse,
} from "../types/rsvp";

type RSVPFormProps = {
  guest: GuestSummary;
  onSubmitted: (response: RSVPSubmissionResponse) => void;
};

export function RSVPForm({ guest, onSubmitted }: RSVPFormProps) {
  const [status, setStatus] = useState<RSVPStatus>("attending");

  const [attendanceType, setAttendanceType] = useState<AttendanceType>(
    "ceremony_and_reception",
  );

  const [dietaryRestrictions, setDietaryRestrictions] = useState("");

  const [guestMessage, setGuestMessage] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleStatusChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextStatus = event.target.value as RSVPStatus;

    setStatus(nextStatus);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await submitRSVP({
        invitation_code: guest.invitation_code,
        status,
        attendance_type: status === "attending" ? attendanceType : null,
        dietary_restrictions:
          status === "attending" && dietaryRestrictions.trim()
            ? dietaryRestrictions.trim()
            : null,
        guest_message: guestMessage.trim() ? guestMessage.trim() : null,
      });

      onSubmitted(response);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to submit your RSVP right now.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="rsvp-heading">
      <h2 id="rsvp-heading">Submit your RSVP</h2>

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>Will you attend?</legend>

          <label>
            <input
              type="radio"
              name="status"
              value="attending"
              checked={status === "attending"}
              onChange={handleStatusChange}
              disabled={isSubmitting}
            />
            Yes, I will attend
          </label>

          <label>
            <input
              type="radio"
              name="status"
              value="not_attending"
              checked={status === "not_attending"}
              onChange={handleStatusChange}
              disabled={isSubmitting}
            />
            No, I cannot attend
          </label>
        </fieldset>

        {status === "attending" ? (
          <>
            <label htmlFor="attendance-type">Attendance</label>

            <select
              id="attendance-type"
              value={attendanceType}
              onChange={(event) =>
                setAttendanceType(event.target.value as AttendanceType)
              }
              disabled={isSubmitting}
            >
              <option value="ceremony_and_reception">
                Ceremony and reception
              </option>
              <option value="ceremony_only">Ceremony only</option>
              <option value="reception_only">Reception only</option>
            </select>

            <label htmlFor="dietary-restrictions">Dietary restrictions</label>

            <textarea
              id="dietary-restrictions"
              value={dietaryRestrictions}
              onChange={(event) => setDietaryRestrictions(event.target.value)}
              maxLength={500}
              disabled={isSubmitting}
            />

          </>
        ) : null}

        <label htmlFor="guest-message">Message for the couple</label>

        <textarea
          id="guest-message"
          value={guestMessage}
          onChange={(event) => setGuestMessage(event.target.value)}
          maxLength={2000}
          disabled={isSubmitting}
        />

        {errorMessage ? <p role="alert">{errorMessage}</p> : null}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit RSVP"}
        </button>
      </form>
    </section>
  );
}
