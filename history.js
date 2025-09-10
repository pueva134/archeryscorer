// history.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = { /* Your config here */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();
const historyTable = document.getElementById("historyTable");

onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = "index.html"; return; }
  const userDoc = await getDoc(doc(db, "users", user.uid));
  let sessions, q;
  if (userDoc.data().role === "Coach")
    q = query(collection(db, "sessions")); // all
  else
    q = query(collection(db, "sessions"), where("userId", "==", user.uid)); // own

  sessions = []; (await getDocs(q)).forEach(doc =>
    sessions.push({ id: doc.id, ...doc.data() }));

  let html = "<table><tr><th>Date</th><th>Score</th><th>Bow</th><th>Target</th><th>Notes</th></tr>";
  sessions.forEach(s =>
    html += `<tr>
      <td>${new Date(s.timestamp).toLocaleString()}</td>
      <td>${s.totalScore}</td>
      <td>${s.bowType}</td>
      <td>${s.targetFace}</td>
      <td>${s.notes || ""}</td>
    </tr>`);
  html += "</table>";
  historyTable.innerHTML = html;
});

// Export
document.getElementById("exportHistoryBtn").onclick = async () => {
  let sessions = [];
  let user = auth.currentUser;
  const userDoc = await getDoc(doc(db, "users", user.uid));
  let q;
  if (userDoc.data().role === "Coach") q = query(collection(db, "sessions"));
  else q = query(collection(db, "sessions"), where("userId", "==", user.uid));
  (await getDocs(q)).forEach(d => sessions.push({ ...d.data() }));
  let csv = "Date,Score,Bow,Target,Notes\n";
  sessions.forEach(s =>
    csv += `${new Date(s.timestamp).toLocaleString()},${s.totalScore},${s.bowType},${s.targetFace},"${s.notes || ""}"\n`);
  const link = document.createElement("a");
  link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  link.download = "session_history.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
