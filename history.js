// history.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const historyTable = document.getElementById("historyTable");
const exportButton = document.getElementById("exportHistoryBtn");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  // Get user role
  const userDoc = await getDoc(doc(db, "users", user.uid));
  let sessionsQuery;
  if (userDoc.data().role === "Coach") {
    sessionsQuery = query(collection(db, "sessions"));
  } else {
    sessionsQuery = query(collection(db, "sessions"), where("userId", "==", user.uid));
  }

  const querySnapshot = await getDocs(sessionsQuery);
  let sessions = [];
  querySnapshot.forEach(doc => {
    sessions.push({ id: doc.id, ...doc.data() });
  });

  // Build table HTML
  let html = `<table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Bow Style</th>
        <th>Target Face</th>
        <th>Total Score</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>`;

  sessions.forEach(session => {
    html += `<tr>
      <td>${new Date(session.timestamp).toLocaleString()}</td>
      <td>${session.bowType || "-"}</td>
      <td>${session.targetFace || "-"}</td>
      <td>${session.totalScore || "-"}</td>
      <td>${session.notes || ""}</td>
    </tr>`;
  });

  html += "</tbody></table>";
  historyTable.innerHTML = html;
});

exportButton.onclick = async () => {
  const user = auth.currentUser;
  if (!user) return;
  const userDoc = await getDoc(doc(db, "users", user.uid));
  let sessionsQuery;
  if (userDoc.data().role === "Coach") {
    sessionsQuery = query(collection(db, "sessions"));
  } else {
    sessionsQuery = query(collection(db, "sessions"), where("userId", "==", user.uid));
  }

  const querySnapshot = await getDocs(sessionsQuery);
  let csvContent = "Date,Bow Style,Target Face,Total Score,Notes\n";

  querySnapshot.forEach(doc => {
    const s = doc.data();
    csvContent += `"${new Date(s.timestamp).toLocaleString()}","${s.bowType || ""}","${s.targetFace || ""}",${s.totalScore || ""},"${s.notes || ""}"\n`;
  });

  const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "session_history.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
