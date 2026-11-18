import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, RecaptchaVerifier, signInWithPhoneNumber, linkWithPhoneNumber } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, query, where, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCQfr1Hx8bqbYVyTsBFYwNTAkeUKE7CvdI',
  authDomain: 'gen-lang-client-0782344491.firebaseapp.com',
  projectId: 'gen-lang-client-0782344491',
  storageBucket: 'gen-lang-client-0782344491.firebasestorage.app',
  messagingSenderId: '591125402376',
  appId: '1:591125402376:web:e2a8be452582af87f27523'
};

const DATABASE_ID = 'ai-studio-android-trustcra-af6ee663-7792-465c-abb8-86f9a5cbb138';
const app = initializeApp(firebaseConfig);

const APP_CHECK_SITE_KEY = 'REPLACE_WITH_RECAPTCHA_ENTERPRISE_SITE_KEY';
if (!APP_CHECK_SITE_KEY.startsWith('REPLACE_')) {
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
}

const auth = getAuth(app);
const db = getFirestore(app, DATABASE_ID);
const storage = getStorage(app);
const functions = getFunctions(app, 'europe-west1');
