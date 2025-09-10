// history.js

import { db, auth, query, collection, where, getDocs } from "./firebase.js";

// History renderer
window.onload = async function () {
  const tableDiv = document.getElementById("historyTableContainer");
  // Only fetch own sessions (Archer) otherwise all (Coach)
  const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
  const role = userDoc.data().role;
  let q;
  if (role === "Coach") q = query(collection(db, "sessions"));
  else q = query(collection(db, "sessions"), where("userId", "==", auth.currentUser.uid));
  const snap = await getDocs(q);

  let html = "<table><thead><tr><th>Date</th><th>Score</th><th>Bow</th><th>Target Face</th></tr></thead><tbody>";
  snap.forEach(doc => {
    const data = doc.data();
    html += `<tr>
      <td>${data.timestamp}</td>
      <td>${data.totalScore}</td>
      <td>${data.bowType}</td>
      <td>${data.targetFace}</td>
    </tr>`;
  });
  html += "</tbody></table>";
  tableDiv.innerHTML = html;
};

// Export
document.getElementById("exportHistoryBtn").onclick = async function() {
  const snap = await getDocs(query(collection(db, "sessions"), where("userId", "==", auth.currentUser.uid)));
  let csv = "Date,Score,Bow,Target Face\n";
  snap.forEach(doc => {
    const d = doc.data();
    csv += `${d.timestamp},${d.totalScore},${d.bowType},${d.targetFace}\n`;
  });
  const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csv);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `session_history.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
