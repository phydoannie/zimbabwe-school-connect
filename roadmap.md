# Phase 1
- [ ] Username login and secure initial administrator account
- [ ] Administrator-managed staff usernames/passwords and read-only Headmaster
- [ ] School profile, term/year and account settings
- [ ] Expenses entry, filters, and CSV export
- [ ] Permission tests and signed-in flow verification
# Android device pairing
- [x] Device pairing approval page (built in this app's backend; Android must call /api/public/device-pair)
# Offline PWA
- [x] Phase 1: installation setup, per-user saved views, offline access expiry, connection indicator and signed-in preview verification
- [ ] Phase 1 published verification: generated worker, Android installation and cold offline reopening (requires publishing these changes)
- [ ] Phase 2: complete indexed school records, student/fee/expense queue and conflict-safe synchronization
- [ ] Phase 3: idempotent offline payments, receipt numbering and balance updates
- [ ] Phase 4: backups, device conflict recovery and published Android/offline acceptance tests
