# SchoolSys offline implementation

## Audit
- TanStack Start routes and React Query provide the existing screens and reads. School membership selects the workspace, and database RLS remains authoritative.
- Students, fee types, expenses and school settings write directly to the cloud. Staff credentials use protected server functions. Payments and voids use existing RPCs.
- Collection, balances, arrears, receipt numbering and allocation rules stay unchanged. Cashbook and reports retain their current financial helpers.
- Attendance currently contains only a placeholder; this phase does not invent attendance functionality.

## Incremental delivery
1. Installable shell, guarded generated worker, IndexedDB saved query views per user, session-limited offline access and connection status. Only previously opened views are available; writes remain online-only.
2. Indexed entity stores and incremental downloads, local student search and queue for non-payment changes, explicit conflicts and idempotent uploads.
3. Extend existing financial RPCs with idempotency and a device-safe receipt strategy before enabling offline collections, allocations and balance changes.
4. Validated backup/restore and recovery; test two devices, large data and installed Android reopening without internet.

## Phase one checks
Tests cover school/user separation, expiry, preview registration guards and existing financial rules. Signed-in browser checks cover saved records, disconnection, disabled changes, reconnect refresh and mobile layout. Generated production worker, installed Android and cold offline launch require published-app verification; previews intentionally never register a worker.