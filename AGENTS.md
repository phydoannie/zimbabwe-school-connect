<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Username-only accounts use normalized synthetic auth emails and a username-only profiles table; school roles stay in school_members so user-editable profile data cannot grant access.
- Staff creation and credential changes run through authenticated server functions that authorize school management before loading the privileged client; passwords are never stored in application tables.
- Database has_perm is authoritative; client ROLE_PERMS only controls visible actions and must mirror it.
- Initial administrator provisioning is a one-time administrative operation, never a public bootstrap endpoint or hardcoded login bypass.
- Offline access is an IndexedDB membership snapshot valid for seven days after online identity and membership verification; explicit sign-out revokes local access, and server authorization still governs all uploads.
- Offline school packs are isolated by user and school; cash receipts, student enrolments and expenses use immutable UUID outboxes and server-authorized idempotent replay to avoid duplicates after interrupted uploads.
- Debt RPCs share student_balances as the fee ledger; enrolment and arrears edits use atomic audited RPCs so overall totals cannot diverge from fee totals.
- App-shell caching uses vite-plugin-pwa generateSW and a single preview-safe registrar; never cache auth or data API responses in the service worker.
- Collection synchronization locks are scoped by user and school; distinct workspaces must never reuse another workspace's in-flight task.
- Saved cash data uses an explicit CashData contract rather than inferring the loader return type, preventing circular inference between finance loading and offline packs.
- Platform roles and school subscriptions are separate protected tables; management handlers verify the caller's platform role before privileged access, while member_role gates school data by the individual subscription.
- School provisioning creates Auth credentials followed by an atomic school/subscription/membership RPC, deleting the new Auth account if the database transaction fails.
- Offline membership snapshots include school subscriptions and deny access after their expiry; remote suspension takes effect at the next online verification, not instantly on disconnected devices.
- Offline enrolments retain their UUID as the cloud student identity and sync before dependent payments; local overlays deduplicate by identity until downloaded records include the upload.
- Receipt numbers are assigned under a school-row lock by a database insert trigger; offline receipts retain provisional references until sync so devices cannot reuse official numbers.
- School logos use private school-scoped Storage objects and per-user IndexedDB image copies; all PDF actions resolve the same logo for disconnected printing.
- Device approval status requires the private first-pair token, stored only as a hash on the server; public identifiers alone never reveal approval.
