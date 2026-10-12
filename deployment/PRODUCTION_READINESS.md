# Production readiness

## End-to-end test

1. Verify valid and invalid invitations.
2. Submit attending, declined, and updated RSVPs.
3. Download, print, and scan an event pass.
4. Verify the 150-person limit rejects only excess attendance.
5. Check in a party, update companions, and undo check-in.
6. Check in once offline and verify synchronization.
7. Add, edit, filter, import, and export a test guest.
8. Verify seating, reports, gallery, audit logs, and CSV exports.
9. Confirm viewer and super-admin permissions.
10. Test the admin portal on iPhone and Android.

## Security

- Set an explicit Cloudflare Pages domain in `FRONTEND_ORIGINS`; never `*`.
- Rotate JWT and refresh secrets before launch using different 32-byte values.
- Disable unused admin accounts.
- Verify login, invitation, and RSVP limits return HTTP 429.
- Confirm sign-out clears the offline roster.

## Release

After all checks pass, merge `develop` into `main`, tag the release, deploy,
and repeat the health and core smoke tests.
