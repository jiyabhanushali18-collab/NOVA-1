# Quick Start: Signup Email Verification

Signup uses Firebase Authentication's passwordless email-link sign-in. No SMTP credentials, Resend API key, or paid email domain are required.

## Firebase setup

In the Firebase console for the project used by the app:

1. Go to **Authentication → Sign-in method**.
2. Enable **Email/Password**, including **Email link (passwordless sign-in)**.
3. Go to **Authentication → Settings → Authorized domains** and add your Netlify hostname, for example `nova-ai-fashion.netlify.app`. Add `localhost` for local testing if missing.
4. Review the **Email address sign-in** template.

Firebase Authentication plan quotas and limits apply; check the Firebase console's usage and billing pages.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, choose **Create an Account**, and submit the signup form. Open the email link in the same browser where you started signup. The app should verify the email and continue to profile setup.

## Deployment

- **Netlify:** No email-related environment variables are needed. Add the Netlify hostname to Firebase Authentication's authorized domains and deploy the frontend.
- **Render:** No SMTP or Resend configuration is needed for signup email delivery. Render continues to serve other backend APIs.

## Troubleshooting

- `auth/operation-not-allowed`: Enable the Email link sign-in method in Firebase Authentication.
- `auth/unauthorized-domain`: Add the exact site's hostname to Firebase Authentication's authorized domains.
- Link is expired or already used: Start again and request a fresh link.
- Link opens but signup cannot continue: Open it in the same browser used for signup.
- Email is missing: Check spam and review Firebase Authentication templates and usage.

See [EMAIL_VERIFICATION_GUIDE.md](./EMAIL_VERIFICATION_GUIDE.md) for details and [API_REFERENCE.md](./API_REFERENCE.md) for the implementation flow.
