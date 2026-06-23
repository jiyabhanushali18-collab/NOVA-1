import { initializeApp } from 'firebase/app';
import { getFirestore, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyC3ykyIodmGSXMGys3ETJfTEiMPb9AdiJ4',
  authDomain: 'nova-26b39.firebaseapp.com',
  projectId: 'nova-26b39',
  storageBucket: 'nova-26b39.firebasestorage.app',
  messagingSenderId: '1078365953930',
  appId: '1:1078365953930:web:c19ef73e47173979893273'
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

/**
 * Save user details to Firestore 'users' collection
 * @param name - User's full name
 * @param email - User's email address
 * @param phone - User's phone number
 * @param isNewUser - Whether this is a new signup or returning login
 */
export const saveUserToFirestore = async (
  name: string,
  email: string,
  phone: string,
  isNewUser: boolean = false
): Promise<void> => {
  try {
    const normalizedEmail = email.toLowerCase().replace(/[@.]/g, '_');
    const userRef = doc(db, 'users', normalizedEmail);
    const userData = {
      uid: normalizedEmail,
      name,
      email,
      phone,
      username: email.split('@')[0] || name,
      createdAt: isNewUser ? serverTimestamp() : new Date(),
      lastLogin: serverTimestamp(),
      profilePhoto: undefined
    };
    
    await setDoc(userRef, userData, { merge: true });
  } catch (err) {
    console.error('Error saving user to Firestore:', err);
    throw err;
  }
};
