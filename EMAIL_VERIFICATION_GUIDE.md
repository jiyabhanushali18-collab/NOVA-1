# NOVA Email Verification

Signup uses Firebase Authentication's passwordless email-link sign-in. Firebase sends the email, verifies access to the mailbox, and signs the user in when the link is opened. This removes the app's dependency on SMTP, Resend, and a purchased sending domain.

## Firebase setup

In the Firebase console for the project configured in `src/firebase.ts`:

1. Open **Authentication → Sign-in method**.
2. Enable **Email/Password**, then enable **Email link (passwordless sign-in)**.
3. Open **Authentication → Settings → Authorized domains** and add the deployed Netlify hostname, such as `nova-ai-fashion.netlify.app`. Add `localhost` for local development if it is not already listed.
4. In **Authentication → Templates**, review the email-link template and sender display name.

Firebase Authentication's no-cost usage allowance and limits depend on the Firebase plan and current quotas. Check the Firebase console's usage and billing pages for the active project.

## Signup flow

1. The user enters their name, email, phone, and accepts the legal terms.
2. The app stores the pending signup details in the browser and asks Firebase to send a sign-in link.
3. The user opens the link in the same browser where they started signup.
4. Firebase signs the user in and verifies the email. The app saves the profile and proceeds to preference setup.

The browser's local storage is used to associate the returning link with the pending signup. Opening the link on another device or browser may not restore the signup details; restart signup in the original browser if that happens.

## Netlify and Render

- **Netlify:** No email API key or email sender environment variable is needed. The deployed hostname must be in Firebase Authentication's authorized domains.
- **Render:** Signup email delivery no longer uses the Express backend. Existing `RESEND_*` or `SMTP_*` variables are not required for this flow.
- **Firebase:** Email-link authentication must be enabled for the same Firebase project used by the app.

## Troubleshooting

- **`auth/operation-not-allowed`:** Enable Email/Password and Email link sign-in in Firebase Authentication.
- **`auth/unauthorized-domain` or `auth/unauthorized-continue-uri`:** Add the exact Netlify hostname under Firebase Authentication's authorized domains, then retry.
- **Link says it is invalid or expired:** Request a new link from the signup screen. Firebase links are single-use and expire.
- **Link opens but signup cannot continue:** Open it in the same browser where signup began so the pending signup and email are available in local storage.
- **No email arrives:** Check spam, verify the email address, and inspect Firebase Authentication usage/quotas and the email template.

## Implementation files

- `src/services/emailLinkAuth.ts` sends and stores Firebase email-link sign-in state.
- `src/components/AuthView.tsx` requests the email link during signup.
- `src/components/EmailVerificationView.tsx` completes link sign-in and supports resend/change-email.
- `src/App.tsx` restores pending signup details when Firebase returns to the app.
