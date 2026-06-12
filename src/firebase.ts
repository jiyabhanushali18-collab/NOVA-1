import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
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
