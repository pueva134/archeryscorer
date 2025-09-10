// script.js

import {
  app, auth, db,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  setDoc, doc, getDoc, updateProfile, collection, addDoc, query, where, getDocs
} from "./firebase.js";

let currentRole = null;

// Register logic
document.getElementById("registerBtn").onclick = async function () {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const role = document.getElementById("roleSelect").value;
  await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", auth.currentUser.uid), {
    email: email,
    role: role,
    created: new Date().toISOString()
  });
  await updateProfile(auth.currentUser, { displayName: role });
  currentRole = role;
  showDashboardByRole();
};

// Login logic
document.getElementById("loginForm").onsubmit = async function (e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
  currentRole = userDoc.data().role;
  showDashboardByRole();
};

// Logout
document.getElementById("logoutBtn").onclick = async function () {
  await signOut(auth);
  location.reload();
};

// Dashboard renderer
function showDashboardByRole() {
  document.getElementById("auth-section").style.display = "none";
  document.getElementById("dashboard").style.display = "block";
  document.getElementById("archerDash").style.display = currentRole === "Archer" ? "block" : "none";
  document.getElementById("coachDash").style.display = currentRole === "Coach" ? "block" : "none";
}

// Archer session form
document.getElementById("startSessionBtn").onclick = function () {
  const container = document.getElementById("sessionFormContainer");
  container.innerHTML = `
    <form id="sessionForm">
      <input type="text" id="bowType" placeholder="Bow Type" required>
      <input type="text" id="targetFace" placeholder="Target Face" required>
      <input type="text" id="sessionNotes" placeholder="Session Notes">
      <input type="text" id="weather" placeholder="Weather">
      <div id="scoreInputs"></div>
      <button type="submit">Save Session</button>
    </form>
  `;

  // Simple 3 ends, 3 arrows input
  let scoreInputsHTML = "";
  for (let i = 1; i <= 3; i++) {
    scoreInputsHTML += `<div>End ${i}:
      <input type="number" min="0" max="10" id="end${i}arrow1" required>
      <input type="number" min="0" max="10" id="end${i}arrow2" required>
      <input type="number" min="0" max="10" id="end${i}arrow3" required>
    </div>`;
  }
  document.getElementById("scoreInputs").innerHTML = scoreInputsHTML;

  document.getElementById("sessionForm").onsubmit = async function (e) {
    e.preventDefault();
    const scores = [];
    for (let i = 1; i <= 3; i++) {
      scores.push([
        +document.getElementById(`end${i}arrow1`).value,
        +document.getElementById(`end${i}arrow2`).value,
        +document.getElementById(`end${i}arrow3`).value,
      ]);
    }
    const bowType = document.getElementById("bowType").value;
    const targetFace = document.getElementById("targetFace").value;
    const notes = document.getElementById("sessionNotes").value;
    const weather = document.getElementById("weather").value;
    await addDoc(collection(db, "sessions"), {
      userId: auth.currentUser.uid,
      timestamp: new Date().toISOString(),
      scores, bowType, targetFace, notes, weather,
      totalScore: scores.flat().reduce((s, v) => s+v, 0)
    });
    container.innerHTML = "<p>Session saved!</p>";
  };
};

// View history
document.getElementById("viewHistoryBtn").onclick = function () {
  location.href = "history.html";
};

// Coach view all sessions
document.getElementById("viewAllSessionsBtn").onclick = async function () {
  const container = document.getElementById("allSessionsContainer");
  const q = query(collection(db, "sessions"));
  const snap = await getDocs(q);
  let html = "<table><thead><tr><th>User</th><th>Date</th><th>Score</th></tr></thead><tbody>";
  snap.forEach(doc => {
    const data = doc.data();
    html += `<tr>
      <td>${data.userId}</td>
      <td>${data.timestamp}</td>
      <td>${data.totalScore}</td>
    </tr>`;
  });
  html += "</tbody></table>";
  container.innerHTML = html;
};
