// firebaseConfig.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD2YSaHTYcq4GYRzLlJsEFXXmk-USfFynE",
    authDomain: "minimalissuetracker-auth.firebaseapp.com",
    projectId: "minimalissuetracker-auth",
    storageBucket: "minimalissuetracker-auth.appspot.com",
    messagingSenderId: "1076665593581",
    appId: "1:1076665593581:web:00865ff086083634b7e6e4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
