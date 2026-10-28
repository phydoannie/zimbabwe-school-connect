# SchoolSys Supabase connection

This copy is configured for the new Schoolsys project `rnyamtcivypavqdxkubp` at `https://rnyamtcivypavqdxkubp.supabase.co`.

## Environment variables
- `SUPABASE_URL` and `VITE_SUPABASE_URL`: project URL
- `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY`: public publishable key
- `SUPABASE_SERVICE_ROLE_KEY`: only add as a server-side hosting secret if staff administration server functions need it. Never place it in browser code or commit it.

## Current database status
The Schoolsys project has the initial tables and row-level security policies deployed. No school/student data was seeded. The web app should be tested with a newly registered Supabase Auth user and a school created through the app.

## Android
The Android app remains offline-first. Settings now opens a cloud connection screen for email/password authentication and first-stage student/fee-type synchronization. Use a Supabase Auth user already approved as an active member of the selected school. The current Android sync stage does not yet sync payments, expenses, attendance, invoices, historical term debts, or uploaded photos; do not treat it as a full accounting backup. Keep using the app's local database backup before testing.

## Important
The publishable key is intended for client use; data protection depends on RLS. Never ship the Supabase service-role key in the APK or web frontend. Test with a non-production school first.
