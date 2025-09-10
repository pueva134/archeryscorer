// history.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  // Your Firebase config goes here
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

const historyTable = document.getElementById("historyTable");
const exportButton = document.getElementById("exportHistoryBtn");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const userDoc = await getDoc(doc(db, "users", user.uid));
  let q;

  if (userDoc.data().role === "Coach") {
    q = query(collection(db, "sessions"));
  } else {
    q = query(collection(db, "sessions"), where("userId", "==", user.uid));
  }

  const sessionDocs = await getDocs(q);
  const sessions = [];
  sessionDocs.forEach((doc) => sessions.push({ id: doc.id, ...doc.data() }));

  let html = `<table>
    <thead><tr><th>Date</th><th>Bow Style</th><th>Target Face</th><th>Total Score</th><th>Notes</th></tr></thead>
    <tbody>`;
  sessions.forEach((s) => {
    html += `<tr>
      <td>${new Date(s.timestamp).toLocaleString()}</td>
      <td>${s.bowType}</td>
      <td>${s.targetFace}</td>
      <td>${s.totalScore}</td>
      <td>${s.notes || ""}</td>
    </tr>`;
  });
  html += "</tbody></table>";

  historyTable.innerHTML = html;
});

exportButton.onclick = async () => {
  const user = auth.currentUser;
  if (!user) return;
  const userDoc = await getDoc(doc(db, "users", user.uid));
  let q;

  if (userDoc.data().role === "Coach") {
    q = query(collection(db, "sessions"));
  } else {
    q = query(collection(db, "sessions"), where("userId", "==", user.uid));
  }

  const sessionDocs = await getDocs(q);

  let csv = "Date,Bow Style,Target Face,Total Score,Notes\n";
  sessionDocs.forEach((doc) => {
    const s = doc.data();
    csv += `"${new Date(s.timestamp).toLocaleString()}","${s.bowType}","${s.targetFace}",${s.totalScore},"${s.notes || ""}"\n`;
  });

  const encodedUri = encodeURI(`data:text/csv;charset=utf-8,${csv}`);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "archery_session_history.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
