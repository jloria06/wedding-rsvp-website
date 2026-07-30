-- Wedding RSVP database creation script
-- Run as a MySQL administrative account.

CREATE DATABASE IF NOT EXISTS wedding_rsvp_development
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS wedding_rsvp_staging
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS wedding_rsvp_production
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
    