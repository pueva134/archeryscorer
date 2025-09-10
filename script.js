// script.js

// Make sure to properly configure Firebase SDKs as module imports
// Example: import { ... } from "https://www.gstatic.com/firebasejs/9.x.x/firebase-xxx.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, setDoc, doc, getDoc, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { Chart } from "https://cdn.jsdelivr.net/npm/chart.js"; // For charts in results

const firebaseConfig = { /* Your config here */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

const welcomePage = document.getElementById("welcomePage");
const authForm = document.getElementById("authForm");
const dashboard = document.getElementById("dashboard");
const dashboardTitle = document.getElementById("dashboardTitle");
const sessionSetupContainer = document.getElementById("sessionSetupContainer");
const sessionInputContainer = document.getElementById("sessionInputContainer");
const sessionResultsContainer = document.getElementById("sessionResultsContainer");

// Navigation
document.getElementById("loginWelcomeBtn").onclick = () => { showAuthForm("Login"); };
document.getElementById("signupWelcomeBtn").onclick = () => { showAuthForm("Sign Up"); };
document.getElementById("authBackBtn").onclick = () => { showPage(welcomePage); };

// Authentication
document.getElementById("authForm").onsubmit = async function(e) {
  e.preventDefault();
  const email = document.getElementById("authEmail").value;
  const password = document.getElementById("authPassword").value;
  const role = document.getElementById("authRole").value;
  if (authFormTitle.innerText === "Sign Up") {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), { email, role });
    await updateProfile(cred.user, { displayName: role });
  }
  await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
  showDashboard(userDoc.data().role);
};

// Auth state
onAuthStateChanged(auth, async user => {
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    showDashboard(userDoc.data().role);
  } else {
    showPage(welcomePage);
  }
});

// Dashboard UI
function showDashboard(role) {
  showPage(dashboard);
  dashboardTitle.innerText = `${role} Dashboard`;
  sessionSetupContainer.classList.add("hidden");
  sessionInputContainer.classList.add("hidden");
  sessionResultsContainer.classList.add("hidden");
}

// Logout
document.getElementById("dashboardLogoutBtn").onclick = async () => {
  await signOut(auth); showPage(welcomePage);
};

// Session workflow (Setup → Input → Results)
document.getElementById("dashboardStartSessionBtn").onclick = () => {
  sessionSetupContainer.innerHTML = `
    <h3>Session Setup</h3>
    <form id="setupForm">
      <label>Bow Style<select id="bowType"><option>Recurve</option><option>Compound</option></select></label>
      <label>Distance (m)<input id="distance" type="number" min="1" max="90" required></label>
      <label>Target Face<select id="targetFace"><option>Indoor</option><option>Outdoor</option></select></label>
      <label>Arrows/End<input id="arrowsPerEnd" type="number" min="1" max="6" value="3"></label>
      <label>Number of Ends<input id="numberOfEnds" type="number" min="1" max="10" value="3"></label>
      <label>Session Notes<input id="sessionNotes" type="text"></label>
      <button type="submit">Next</button>
    </form>
  `;
  sessionSetupContainer.classList.remove("hidden");
  sessionInputContainer.classList.add("hidden");
  sessionResultsContainer.classList.add("hidden");

  document.getElementById("setupForm").onsubmit = function(e) {
    e.preventDefault();
    startSessionInput({
      bowType: document.getElementById("bowType").value,
      distance: document.getElementById("distance").value,
      targetFace: document.getElementById("targetFace").value,
      arrowsPerEnd: +document.getElementById("arrowsPerEnd").value,
      numEnds: +document.getElementById("numberOfEnds").value,
      notes: document.getElementById("sessionNotes").value
    });
  };
};

function startSessionInput(setup) {
  const { arrowsPerEnd, numEnds } = setup;
  let arrows = Array.from({ length: numEnds }, () =>
    Array.from({ length: arrowsPerEnd }, () => "")
  );
  let currentEnd = 0;

  function renderInput() {
    sessionInputContainer.innerHTML = `
      <h3>Score Input (End ${currentEnd + 1}/${numEnds})</h3>
      <form id="scoreForm">
        ${arrows[currentEnd]
          .map((val, i) =>
            `<label>Arrow ${i + 1}<input type="number" min="0" max="10" value="${val}" required></label>`
          )
          .join("")}
        <button type="submit">Save End</button>
        ${currentEnd > 0 ? `<button type="button" id="undoArrowBtn">Undo Last End</button>` : ""}
      </form>
      <p>End Total: ${arrows[currentEnd].reduce((s, v) => s + (+v || 0), 0)}</p>
    `;
    sessionInputContainer.classList.remove("hidden");
    sessionSetupContainer.classList.add("hidden");
    sessionResultsContainer.classList.add("hidden");
    document.getElementById("scoreForm").onsubmit = function(e) {
      e.preventDefault();
      arrows[currentEnd] = Array.from(
        e.target.querySelectorAll("input[type='number']")
      ).map(inp => +inp.value);
      if (currentEnd < numEnds - 1) {
        currentEnd++;
        renderInput();
      } else {
        submitSession(setup, arrows);
      }
    };
    if (document.getElementById("undoArrowBtn"))
      document.getElementById("undoArrowBtn").onclick = function() {
        currentEnd--;
        arrows[currentEnd] = arrows[currentEnd].map(() => "");
        renderInput();
      };
  }
  renderInput();
}

async function submitSession(setup, arrows) {
  const totalScore = arrows.flat().reduce((sum, a) => sum + (+a || 0), 0);
  await addDoc(collection(db, "sessions"), {
    userId: auth.currentUser.uid,
    timestamp: new Date().toISOString(),
    scores: arrows,
    totalScore,
    ...setup
  });
  sessionInputContainer.classList.add("hidden");
  renderResults(arrows, totalScore);
}

// Results
function renderResults(arrows, totalScore) {
  sessionResultsContainer.innerHTML = `
    <h3>Session Results</h3>
    <table>
      <tr><th>End</th>${arrows.map((_, i) => `<th>Arrow ${i + 1}</th>`).join("")}</tr>
      ${arrows.map(
        (end, eIdx) =>
          `<tr><td>${eIdx + 1}</td>${end
            .map(val => `<td>${val}</td>`)
            .join("")}</tr>`
      ).join("")}
      <tr><th colspan="${arrows.length + 1}">Total Score: ${totalScore}</th></tr>
    </table>
    <canvas id="scoreChart" width="350" height="120"></canvas>
    <button id="startNewSessionBtn">New Session</button>
  `;
  sessionResultsContainer.classList.remove("hidden");
  sessionSetupContainer.classList.add("hidden");
  sessionInputContainer.classList.add("hidden");
  // Draw chart
  const ctx = document.getElementById("scoreChart").getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: arrows.map((_, i) => `End ${i + 1}`),
      datasets: [{
        label: "End Score",
        data: arrows.map(end => end.reduce((sum, v) => sum + (+v || 0), 0)),
        borderColor: "#006cff",
        fill: false,
      }]
    }
  });
  document.getElementById("startNewSessionBtn").onclick = () => {
    sessionResultsContainer.classList.add("hidden");
    sessionSetupContainer.classList.remove("hidden");
  };
}

// History navigation
document.getElementById("dashboardHistoryBtn").onclick = () => {
  window.location.href = "history.html";
};

// Theme toggle
document.getElementById("dashboardThemeBtn").onclick = () => {
  document.body.classList.toggle("dark-theme");
};

function showAuthForm(mode) {
  welcomePage.classList.add("hidden");
  authForm.classList.remove("hidden");
  document.getElementById("authFormTitle").innerText = mode;
  document.getElementById("authSubmitBtn").innerText = mode === "Login" ? "Login" : "Sign Up";
}

function showPage(el) {
  [welcomePage, authForm, dashboard].forEach(e => e.classList.add("hidden"));
  el.classList.remove("hidden");
}
