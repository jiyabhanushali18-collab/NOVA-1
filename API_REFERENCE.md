# NOVA Email Verification Reference

Signup email verification is handled directly by Firebase Authentication. The frontend does not call backend OTP endpoints, and the Render server does not send the verification email.

## Firebase setup

For the Firebase project configured in `src/firebase.ts`:

1. In **Authentication → Sign-in method**, enable **Email/Password** and its **Email link (passwordless sign-in)** option.
2. In **Authentication → Settings → Authorized domains**, add the deployed Netlify hostname (for example, `nova-ai-fashion.netlify.app`) and `localhost` for local development when needed.
3. Review **Authentication → Templates → Email address sign-in**.

The Firebase email sender does not require the app owner to purchase a separate sending domain. Firebase plan quotas and limits apply; check the Firebase console for current usage.

## Signup sequence

1. `AuthView` validates signup data and legal consent.
2. `sendFirebaseEmailSignInLink` calls Firebase's `sendSignInLinkToEmail` with the current app origin as the return URL.
3. The app stores the email and pending signup profile in browser local storage.
4. Firebase returns the user to the app after they open the link. `EmailVerificationView` completes `signInWithEmailLink`.
5. Firebase returns a signed-in user with a verified email. The app saves the profile to Firestore and continues to preference setup.

The email link must be opened in the same browser that started signup because the app associates it with locally stored signup data and email.

## Relevant implementation

- `src/services/emailLinkAuth.ts`
  - `sendFirebaseEmailSignInLink(email)` sends the passwordless sign-in email and stores the email needed to complete the link.
  - `PENDING_EMAIL_SIGNUP_KEY` and `EMAIL_FOR_SIGN_IN_KEY` identify the browser storage entries.
- `src/components/AuthView.tsx`
  - Starts the flow after validating the signup form.
- `src/components/EmailVerificationView.tsx`
  - Completes the sign-in link, and can resend it or change the target email.
- `src/App.tsx`
  - Restores pending signup state on the Firebase return link, then persists profile and consent data.

## Deployment checklist

### Netlify

- No SMTP, Resend, or email API key environment variable is needed.
- Add the site's exact hostname to Firebase Authentication's authorized domains.
- Deploy the frontend so it uses the current Firebase project configuration.

### Render

- No SMTP or Resend configuration is needed for signup verification.
- The existing Express API remains in use for other app features.

## Troubleshooting

| Error or symptom | Check |
|---|---|
| `auth/operation-not-allowed` | Enable Email/Password and Email link sign-in in Firebase Authentication. |
| `auth/unauthorized-domain` or `auth/unauthorized-continue-uri` | Add the exact Netlify hostname to Firebase Authentication's authorized domains. |
| Link is invalid or expired | Request a fresh link; Firebase sign-in links are single-use. |
| Link opens, but signup details are missing | Open the link in the browser that started signup. |
| No email arrives | Check spam, confirm the entered address, and review Firebase Authentication templates, quotas, and usage. |
