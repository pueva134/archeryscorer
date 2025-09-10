import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Your actual Firebase project config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();
// -------------------------------
// Authentication Functions
// -------------------------------
function loginUser(email, password) {
return signInWithEmailAndPassword(auth, email, password);
}
function registerUser(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
}
function logoutUser() {
    return signOut(auth);
}
// -------------------------------
// Theme Toggle
// -------------------------------
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const theme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
}
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') document.body.classList.add('dark-theme');
}
// -------------------------------
// Save New Archery Session
// -------------------------------
async function saveSession(scores) {
    const user = auth.currentUser;
    if (!user) return;
const totalScore = scores.flat().reduce((sum, arrow) => sum + arrow, 0);
    const sessionData = {
        userId: user.uid,
        timestamp: new Date().toISOString(),
        scores: scores,  // e.g., [[10,9,8], [7,10,10], ...]
        totalScore: totalScore
    };
    await setDoc(doc(collection(db, "sessions")), sessionData);
    console.log("Session saved successfully.");
}
// -------------------------------
// Retrieve Session History
// -------------------------------
async function getSessionHistory() {
    const user = auth.currentUser;
    if (!user) return [];
    const sessionsQuery = query(
        collection(db, "sessions"),
        where("userId", "==", user.uid)
    );
    const querySnapshot = await getDocs(sessionsQuery);
    const sessions = [];
    querySnapshot.forEach(doc => {
        sessions.push({ id: doc.id, ...doc.data() });
    });
 return sessions;
}
// -------------------------------
// Export Session as CSV
// -------------------------------
function exportSessionAsCSV(session) {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Round,Arrow 1,Arrow 2,Arrow 3\n";
    session.scores.forEach((round, index) => {
        csvContent += `${index + 1},${round.join(",")}\n`;
    });
    csvContent += `Total Score,,${session.totalScore}\n`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `session_${session.timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
// -------------------------------
// Auth State Handling
// -------------------------------
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User logged in:", user.email);

        // Example scores for testing purpose
        const exampleScores = [
            [10, 9, 8],
            [7, 10, 10],
            [8, 9, 9]
        ];
        saveSession(exampleScores);
        getSessionHistory().then(history => {
            console.log("User Session History:", history);
            // You can populate UI elements here with history
        });
    } else {
        console.log("User not logged in.");
    }
});
// -------------------------------
// Initialize Theme on Page Load
// -------------------------------
window.addEventListener('DOMContentLoaded', () => {
    loadTheme();
});
