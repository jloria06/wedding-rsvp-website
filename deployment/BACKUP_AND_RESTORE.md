# Production database backup and restoration

Aiven creates automatic full backups. Before launch, confirm the service is
Running, the latest backup is recent, and the recovery window is shown.

1. Record the incident time in UTC and stop administrator edits.
2. Choose an Aiven restore point immediately before the incident.
3. Restore or fork into a new service; do not overwrite the only production DB.
4. Verify guest, RSVP, content, media, seating, admin, audit, and check-in counts.
5. Test the restored DB with a temporary backend deployment.
6. After approval, update Render database variables and redeploy.
7. Keep the old service until the restored app and a new backup are verified.

Never commit production dumps or credentials. They contain personal data.
