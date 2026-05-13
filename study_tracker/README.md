# Study Tracker

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start MySQL and create the database schema.
   - If you have MySQL installed, run the SQL in `database.sql`.
   - Default database connection values are:
     - host: `127.0.0.1`
     - user: `root`
     - password: ``
     - database: `study_tracker`

3. Start the server:

   ```bash
   node server.js
   ```

4. Open the site in your browser:
   - `http://127.0.0.1:8000/login.html`

## Notes

- The frontend now uses the Express API endpoints under `/api/*`.
- Legacy `.php` frontend API references are still accepted by the server via URL aliasing.
- Admins and users are created through the API:
  - Register as a normal user via the registration form.
  - Use the login form and select `admin` to sign in if an admin exists.

## Troubleshooting

- If the server starts but the database is not reachable, start MySQL and ensure the database is available.
- If you need a different MySQL user or password, set environment variables before running:
  - `DB_HOST`
  - `DB_USER`
  - `DB_PASS`
  - `DB_NAME`
  - `ADMIN_EMAIL`
  - `ADMIN_PASS`
