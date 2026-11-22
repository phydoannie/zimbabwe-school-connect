# Phase 1
# Current request: publishing security and school receipts
- [ ] Offline student enrolment with entered fee arrears and retry-safe syncing
- [ ] Offline expenses with saved registers and retry-safe syncing
- [ ] Resolve active publish security findings and verify protections
- [ ] School-specific optional receipt starting numbers, safe online and offline sync
- [ ] Immediate receipt printing and school logo file selection on PDFs
- [ ] Test receipt settings, logo and printing flows
# Super administrator
- [ ] Owner account and private school directory
- [x] Provision owner with the latest supplied password after rejected weak passwords
- [ ] Owner-managed registration, activation, extensions, school gateways
- [ ] Enforce school subscriptions online and offline; seven-day warnings
- [ ] Verify permissions and management flow

- [ ] Username login and secure initial administrator account
- [ ] Administrator-managed staff usernames/passwords and read-only Headmaster
- [ ] School profile, term/year and account settings
- [ ] Expenses entry, filters, and CSV export
- [ ] Permission tests and signed-in flow verification
# Android device pairing
- [x] Device pairing approval page (built in this app's backend; Android must call /api/public/device-pair)
# Offline PWA
- [x] Current build: seven-day offline reopening, full student/debt download, offline filtering and durable cash receipt queue (27 tests passed; fresh signed-in offline reopening verified; installed-phone cold launch awaits publication)
- [x] Phase 1: installation setup, per-user saved views, offline access expiry, connection indicator and signed-in preview verification
- [ ] Phase 1 published verification: generated worker, Android installation and cold offline reopening (requires publishing these changes)
- [ ] Phase 2: complete indexed school records, student/fee/expense queue and conflict-safe synchronization
- [ ] Phase 3: idempotent offline payments, receipt numbering and balance updates
- [ ] Phase 4: backups, device conflict recovery and published Android/offline acceptance tests

# Current priority: arrears and phase-one offline collection
- [x] Apply consistent fee-level and overall balances, atomic enrolment and arrears saving
- [x] Offline cash collection, saved student search, receipt outbox and retry-safe sync
- [x] Financial regression tests and signed-in offline collection verification (24 tests; $5 cash sync/replay, fee-sum totals and isolated profile arrears; test values restored)
