import { useState, type ChangeEvent, type FormEvent } from "react";

import { ApiError } from "../lib/api";
import { submitRSVP } from "../services/rsvp";
import type {
  AttendanceType,
  CompanionInput,
  GuestSummary,
  MealPreference,
  RSVPStatus,
  RSVPSubmissionResponse,
} from "../types/rsvp";

type RSVPFormProps = {
  guest: GuestSummary;
  onSubmitted: (response: RSVPSubmissionResponse) => void;
};

const emptyCompanion = (): CompanionInput => ({
  first_name: "",
  middle_name: null,
  last_name: "",
  meal_preference: "standard",
  dietary_restrictions: null,
});

export function RSVPForm({ guest, onSubmitted }: RSVPFormProps) {
  const [status, setStatus] = useState<RSVPStatus>("attending");

  const [attendanceType, setAttendanceType] = useState<AttendanceType>(
    "ceremony_and_reception",
  );

  const [mealPreference, setMealPreference] =
    useState<MealPreference>("standard");

  const [dietaryRestrictions, setDietaryRestrictions] = useState("");

  const [guestMessage, setGuestMessage] = useState("");

  const [companions, setCompanions] = useState<CompanionInput[]>([]);

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleStatusChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextStatus = event.target.value as RSVPStatus;

    setStatus(nextStatus);

    if (nextStatus === "not_attending") {
      setCompanions([]);
    }
  }

  function addCompanion(): void {
    if (companions.length >= guest.maximum_companions) {
      return;
    }

    setCompanions((current) => [...current, emptyCompanion()]);
  }

  function removeCompanion(index: number): void {
    setCompanions((current) =>
      current.filter((_, companionIndex) => companionIndex !== index),
    );
  }

  function updateCompanion(
    index: number,
    field: keyof CompanionInput,
    value: string | null,
  ): void {
    setCompanions((current) =>
      current.map((companion, companionIndex) =>
        companionIndex === index
          ? {
              ...companion,
              [field]: value,
            }
          : companion,
      ),
    );
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
        meal_preference: status === "attending" ? mealPreference : null,
        dietary_restrictions:
          status === "attending" && dietaryRestrictions.trim()
            ? dietaryRestrictions.trim()
            : null,
        guest_message: guestMessage.trim() ? guestMessage.trim() : null,
        companions: status === "attending" ? companions : [],
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

            <label htmlFor="meal-preference">Meal preference</label>

            <select
              id="meal-preference"
              value={mealPreference}
              onChange={(event) =>
                setMealPreference(event.target.value as MealPreference)
              }
              disabled={isSubmitting}
            >
              <option value="standard">Standard</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="halal">Halal</option>
              <option value="other">Other</option>
            </select>

            <label htmlFor="dietary-restrictions">Dietary restrictions</label>

            <textarea
              id="dietary-restrictions"
              value={dietaryRestrictions}
              onChange={(event) => setDietaryRestrictions(event.target.value)}
              maxLength={500}
              disabled={isSubmitting}
            />

            <h3>Companions</h3>

            <p>
              You may add up to {guest.maximum_companions} companion
              {guest.maximum_companions === 1 ? "" : "s"}.
            </p>

            {companions.map((companion, index) => (
              <fieldset key={index}>
                <legend>Companion {index + 1}</legend>

                <label>
                  First name
                  <input
                    type="text"
                    value={companion.first_name}
                    onChange={(event) =>
                      updateCompanion(index, "first_name", event.target.value)
                    }
                    required
                    disabled={isSubmitting}
                  />
                </label>

                <label>
                  Middle name
                  <input
                    type="text"
                    value={companion.middle_name ?? ""}
                    onChange={(event) =>
                      updateCompanion(
                        index,
                        "middle_name",
                        event.target.value || null,
                      )
                    }
                    disabled={isSubmitting}
                  />
                </label>

                <label>
                  Last name
                  <input
                    type="text"
                    value={companion.last_name}
                    onChange={(event) =>
                      updateCompanion(index, "last_name", event.target.value)
                    }
                    required
                    disabled={isSubmitting}
                  />
                </label>

                <label>
                  Meal preference
                  <select
                    value={companion.meal_preference ?? "standard"}
                    onChange={(event) =>
                      updateCompanion(
                        index,
                        "meal_preference",
                        event.target.value,
                      )
                    }
                    disabled={isSubmitting}
                  >
                    <option value="standard">Standard</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="halal">Halal</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => removeCompanion(index)}
                  disabled={isSubmitting}
                >
                  Remove companion
                </button>
              </fieldset>
            ))}

            <button
              type="button"
              onClick={addCompanion}
              disabled={
                isSubmitting || companions.length >= guest.maximum_companions
              }
            >
              Add companion
            </button>
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
