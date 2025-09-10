// script.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, setDoc, doc, getDoc, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { Chart } from "https://cdn.jsdelivr.net/npm/chart.js";

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

// Cached DOM elements
const welcomePage = document.getElementById("welcomePage");
const authForm = document.getElementById("authForm");
const dashboard = document.getElementById("dashboard");
const dashboardTitle = document.getElementById("dashboardTitle");
const sessionSetupContainer = document.getElementById("sessionSetupContainer");
const sessionInputContainer = document.getElementById("sessionInputContainer");
const sessionResultsContainer = document.getElementById("sessionResultsContainer");

// Button event handlers
document.getElementById("loginWelcomeBtn").onclick = () => showAuthForm("Login");
document.getElementById("signupWelcomeBtn").onclick = () => showAuthForm("Sign Up");
document.getElementById("authBackBtn").onclick = () => showPage(welcomePage);
document.getElementById("dashboardLogoutBtn").onclick = async () => {
  await signOut(auth);
  showPage(welcomePage);
};
document.getElementById("dashboardStartSessionBtn").onclick = () => prepareSessionSetup();
document.getElementById("dashboardHistoryBtn").onclick = () => window.location.href = "history.html";
document.getElementById("dashboardThemeBtn").onclick = () => document.body.classList.toggle("dark-theme");

// Authentication form submit handler
authForm.onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById("authEmail").value;
  const password = document.getElementById("authPassword").value;
  const role = document.getElementById("authRole").value;

  try {
    if (document.getElementById("authFormTitle").innerText === "Sign Up") {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", userCredential.user.uid), { email, role });
      await updateProfile(userCredential.user, { displayName: role });
    }
    await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    showDashboard(userDoc.data().role);
  } catch (error) {
    alert("Error: " + error.message);
  }
};

// Listen for auth state changes (auto signin)
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) showDashboard(userDoc.data().role);
    else {
      alert("User profile data missing.");
      await signOut(auth);
      showPage(welcomePage);
    }
  } else {
    showPage(welcomePage);
  }
});

// Helper functions

function showAuthForm(mode) {
  welcomePage.classList.add("hidden");
  authForm.classList.remove("hidden");
  document.getElementById("authFormTitle").textContent = mode;
  document.getElementById("authSubmitBtn").textContent = mode === "Login" ? "Login" : "Sign Up";
}

function showPage(element) {
  [welcomePage, authForm, dashboard].forEach(el => el.classList.add("hidden"));
  element.classList.remove("hidden");
}

function showDashboard(role) {
  authForm.classList.add("hidden");
  welcomePage.classList.add("hidden");
  dashboard.classList.remove("hidden");
  dashboardTitle.textContent = `${role} Dashboard`;
  sessionSetupContainer.classList.add("hidden");
  sessionInputContainer.classList.add("hidden");
  sessionResultsContainer.classList.add("hidden");
}

// Session setup
function prepareSessionSetup() {
  sessionSetupContainer.innerHTML = `
    <h3>Session Setup</h3>
    <form id="setupForm">
      <label>Bow Style
        <select id="bowType" required>
          <option value="Recurve">Recurve</option>
          <option value="Compound">Compound</option>
          <option value="Longbow">Longbow</option>
        </select>
      </label>
      <label>Distance (m)
        <input id="distance" type="number" min="5" max="100" required />
      </label>
      <label>Target Face
        <select id="targetFace" required>
          <option value="Indoor">Indoor</option>
          <option value="Outdoor">Outdoor</option>
        </select>
      </label>
      <label>Arrows per End
        <input id="arrowsPerEnd" type="number" min="1" max="6" value="3" required />
      </label>
      <label>Number of Ends
        <input id="numberOfEnds" type="number" min="1" max="20" value="3" required />
      </label>
      <label>Session Notes
        <input id="sessionNotes" type="text" />
      </label>
      <button type="submit">Next</button>
    </form>
  `;

  sessionSetupContainer.classList.remove("hidden");
  sessionInputContainer.classList.add("hidden");
  sessionResultsContainer.classList.add("hidden");

  document.getElementById("setupForm").onsubmit = (e) => {
    e.preventDefault();
    startSessionInput({
      bowType: document.getElementById("bowType").value,
      distance: document.getElementById("distance").value,
      targetFace: document.getElementById("targetFace").value,
      arrowsPerEnd: +document.getElementById("arrowsPerEnd").value,
      numEnds: +document.getElementById("numberOfEnds").value,
      notes: document.getElementById("sessionNotes").value,
    });
  };
}

function startSessionInput(setup) {
  const { arrowsPerEnd, numEnds } = setup;
  let scores = Array(numEnds).fill(null).map(() => Array(arrowsPerEnd).fill(null));
  let currentEnd = 0;

  function renderInput() {
    sessionInputContainer.innerHTML = `
      <h3>Score Input (End ${currentEnd + 1} of ${numEnds})</h3>
      <form id="scoreForm">
        ${scores[currentEnd].map((_, idx) => `<label>Arrow ${idx + 1}<input type="number" min="0" max="10" required /></label>`).join('')}
        <button type="submit">Submit End</button>
        <button type="button" id="undoBtn" ${currentEnd === 0 ? 'disabled' : ''}>Undo Last End</button>
      </form>
      <p>Current End Total: <span id="currentEndTotal">0</span></p>
    `;
    sessionInputContainer.classList.remove("hidden");
    sessionSetupContainer.classList.add("hidden");
    sessionResultsContainer.classList.add("hidden");

    const inputs = sessionInputContainer.querySelectorAll("input");
    const totalDisplay = document.getElementById("currentEndTotal");

    inputs.forEach(input => {
      input.addEventListener("input", () => {
        let total = 0;
        inputs.forEach(inp => {
          let val = parseInt(inp.value);
          if (!isNaN(val)) total += val;
        });
        totalDisplay.textContent = total;
      });
    });

    document.getElementById("scoreForm").onsubmit = (e) => {
      e.preventDefault();
      inputs.forEach((input, idx) => {
        scores[currentEnd][idx] = parseInt(input.value);
      });
      if (currentEnd + 1 < numEnds) {
        currentEnd++;
        renderInput();
      } else {
        submitSession(setup, scores);
      }
    };

    document.getElementById("undoBtn").onclick = () => {
      if (currentEnd > 0) {
        scores[currentEnd] = Array(arrowsPerEnd).fill(null);
        currentEnd--;
        renderInput();
      }
    };
  }

  renderInput();
}

async function submitSession(setup, scores) {
  let totalScore = scores.flat().reduce((sum, val) => sum + (val || 0), 0);
  try {
    await addDoc(collection(db, "sessions"), {
      userId: auth.currentUser.uid,
      timestamp: new Date().toISOString(),
      scores,
      totalScore,
      ...setup,
    });
    renderResults(scores, totalScore);
  } catch (error) {
    alert("Error saving session: " + error.message);
  }
}

function renderResults(scores, totalScore) {
  sessionResultsContainer.innerHTML = `
    <h3>Session Results</h3>
    <table>
      <thead><tr><th>End</th>
        ${scores[0].map((_, i) => `<th>Arrow ${i + 1}</th>`).join('')}
        <th>Total</th>
      </tr></thead>
      <tbody>
        ${scores.map((end, idx) => `<tr><td>${idx + 1}</td>${end.map(val => `<td>${val}</td>`).join('')}<td>${end.reduce((a, b) => a + b)}</td></tr>`).join('')}
        <tr><th colspan="${scores[0].length + 1}">Grand Total: ${totalScore}</th></tr>
      </tbody>
    </table>
    <canvas id="scoreChart" width="400" height="150"></canvas>
    <button id="startNewSessionBtn">New Session</button>
  `;

  sessionSetupContainer.classList.add("hidden");
  sessionInputContainer.classList.add("hidden");
  sessionResultsContainer.classList.remove("hidden");

  const ctx = document.getElementById("scoreChart").getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: scores.map((_, idx) => `End ${idx + 1}`),
      datasets: [{
        label: "Score per End",
        data: scores.map((end) => end.reduce((a, b) => a + b)),
        borderColor: "blue",
        fill: false,
      }],
    },
  });

  document.getElementById("startNewSessionBtn").onclick = () => prepareSessionSetup();
}
