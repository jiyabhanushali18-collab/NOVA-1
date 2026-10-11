# NOVA Email Link Sign-in

Signup email verification now uses Firebase Authentication's passwordless email-link flow.

## Flow

1. `AuthView` validates signup and requests a Firebase email sign-in link.
2. `src/services/emailLinkAuth.ts` sends the link and stores the email needed to finish sign-in.
3. `App.tsx` persists the pending signup details and restores them when Firebase returns to the app.
4. `EmailVerificationView.tsx` completes `signInWithEmailLink`, verifies the signed-in user's email, and proceeds to signup.
5. `App.tsx` saves user profile and consent data to Firestore.

## Deployment setup

- Enable **Email/Password → Email link (passwordless sign-in)** in Firebase Authentication.
- Add the deployed Netlify hostname to Firebase Authentication's authorized domains.
- No SMTP, Resend, email API key, or custom sending domain is needed for this signup flow.
- Review Firebase Authentication quotas and usage in the Firebase console.

See [QUICK_START.md](./QUICK_START.md), [EMAIL_VERIFICATION_GUIDE.md](./EMAIL_VERIFICATION_GUIDE.md), and [API_REFERENCE.md](./API_REFERENCE.md) for setup and troubleshooting.
