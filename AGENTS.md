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
