import { sendSignInLinkToEmail } from 'firebase/auth';
import { auth } from '../firebase';

export const PENDING_EMAIL_SIGNUP_KEY = 'nova_pending_email_signup';
export const EMAIL_FOR_SIGN_IN_KEY = 'nova_email_for_signin';

export const sendFirebaseEmailSignInLink = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const actionCodeSettings = {
    url: `${window.location.origin}/?emailSignIn=1`,
    handleCodeInApp: true
  };

  localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, normalizedEmail);
  try {
    await sendSignInLinkToEmail(auth, normalizedEmail, actionCodeSettings);
  } catch (error) {
    localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
    throw error;
  }
};
