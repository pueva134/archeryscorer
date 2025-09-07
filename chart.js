import Chart from 'chart.js/auto';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, Timestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
// import Chart from 'https://cdn.jsdelivr.net/npm/chart.js/dist/chart.esm.js';
    const score = getScoreFromCoordinates(x, y);