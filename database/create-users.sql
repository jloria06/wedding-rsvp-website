-- Wedding RSVP local application users
-- Replace every password placeholder before execution.
-- Do not commit this file after inserting real passwords.

CREATE USER IF NOT EXISTS 'wedding_dev'@'localhost'
    IDENTIFIED BY 'REPLACE_WITH_DEVELOPMENT_PASSWORD';

CREATE USER IF NOT EXISTS 'wedding_staging'@'localhost'
    IDENTIFIED BY 'REPLACE_WITH_STAGING_PASSWORD';

CREATE USER IF NOT EXISTS 'wedding_prod'@'localhost'
    IDENTIFIED BY 'REPLACE_WITH_PRODUCTION_PASSWORD';


GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX,
      DROP, REFERENCES
ON wedding_rsvp_development.*
TO 'wedding_dev'@'localhost';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX,
      DROP, REFERENCES
ON wedding_rsvp_staging.*
TO 'wedding_staging'@'localhost';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX,
      DROP, REFERENCES
ON wedding_rsvp_production.*
TO 'wedding_prod'@'localhost';

FLUSH PRIVILEGES;