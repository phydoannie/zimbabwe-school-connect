# SchoolSys Pro launch readiness notes

## Implemented in this patch
- School account self-registration by email/password; existing staff username login remains supported. Email confirmation behavior follows the Supabase project's Auth settings.
- Student creation supports selected opening arrears by the school's active fee types for the current academic term. The database RPC creates the student and fee arrears in one transaction.
- Per-fee arrears are included in student balances, debtors-by-fee and overall debtor totals. Legacy students with only `opening_balance` remain supported.
- School Settings can update the school identity, contact information, receipt bank details, currency, academic year and term (subject to the existing `settings` permission).
- Expenses supports recording, monthly listing, totals and CSV export.
- Staff attendance supports teacher records and daily attendance marking.
- Reports provides current-term collections, outstanding balances, student counts, annual expenses and CSV export.

## Required before publishing
1. Apply `drizzle/migrations/0003_launch_readiness.sql` to the connected Supabase database. Review it against the live schema first and back up production data.
2. Test registration with Supabase email confirmation both enabled and disabled; set the production redirect/site URL and email templates in Supabase Auth.
3. Verify Row Level Security for every exposed table and RPC, especially that a user from School A cannot read or write School B data.
4. Test student creation with zero arrears, one fee arrear, multiple fee arrears, duplicate registration number, boarding-only fees and class-specific fees.
5. Test payment allocation and receipt voiding after arrears are added; confirm balances recalculate correctly.
6. Test attendance entry for duplicate saves and verify staff roles can only perform permitted actions.
7. Test school onboarding, staff membership approval, account recovery, mobile layout, production build and backups.

## Important note on arrears
Arrears are linked to the selected fee-type record for the current school year and term. If fee types are recreated each term, define and test a term-rollover process before relying on the system to carry old balances into a new term.
