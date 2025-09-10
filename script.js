// script.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  setDoc,
  doc,
  getDoc,
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { Chart } from "https://cdn.jsdelivr.net/npm/chart.js";

const firebaseConfig = {
  apiKey: "AIzaSyAAc3sRW7WuQXbvlVKKdb8pFa3UOpidalM",
  authDomain: "my-scorer.firebaseapp.com",
  projectId: "my-scorer",
  storageBucket: "my-scorer.appspot.com",
  messagingSenderId: "243500946215",
  appId: "1:243500946215:web:bd976f1bd437edce684f02"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const welcomePage = document.getElementById("welcomePage");
const authForm = document.getElementById("authForm");
const dashboard = document.getElementById("dashboard");
const dashboardTitle = document.getElementById("dashboardTitle");
const sessionSetupContainer = document.getElementById("sessionSetupContainer");
const sessionInputContainer = document.getElementById("sessionInputContainer");
const sessionResultsContainer = document.getElementById("sessionResultsContainer");

// Button event listeners

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

// Auth form submit handler
authForm.onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById("authEmail").value;
  const password = document.getElementById("authPassword").value;
  const role = document.getElementById("authRole").value;

  try {
    if (document.getElementById("authFormTitle").textContent === "Sign Up") {
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

// Monitor auth state
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) showDashboard(userDoc.data().role);
    else {
      alert("User data not found.");
      await signOut(auth);
      showPage(welcomePage);
    }
  } else {
    showPage(welcomePage);
  }
});

function showAuthForm(mode) {
  welcomePage.classList.add("hidden");
  authForm.classList.remove("hidden");
  document.getElementById("authFormTitle").textContent = mode;
  document.getElementById("authSubmitBtn").textContent = mode === "Login" ? "Login" : "Sign Up";
}

function showPage(el) {
  [welcomePage, authForm, dashboard].forEach(e => e.classList.add("hidden"));
  el.classList.remove("hidden");
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

// Session Setup Form
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
      <input id="sessionNotes" type="text"/>
    </label>
    <button type="submit">Next</button>
  </form>
  `;
  sessionSetupContainer.classList.remove("hidden");
  sessionInputContainer.classList.add("hidden");
  sessionResultsContainer.classList.add("hidden");

  document.getElementById("setupForm").onsubmit = (e) => {
    e.preventDefault();
    startSession({
      bowType: document.getElementById("bowType").value,
      distance: document.getElementById("distance").value,
      targetFace: document.getElementById("targetFace").value,
      arrowsPerEnd: +document.getElementById("arrowsPerEnd").value,
      numEnds: +document.getElementById("numberOfEnds").value,
      notes: document.getElementById("sessionNotes").value
    });
  };
}

// Arrow by Arrow score input - ends session after last arrow
function startSession(setup) {
  const { arrowsPerEnd, numEnds } = setup;
  const totalArrows = arrowsPerEnd * numEnds;
  let scores = Array(totalArrows).fill(null);
  let currentArrow = 0;

  function renderInput() {
    sessionInputContainer.innerHTML = `
      <h3>Arrow ${currentArrow + 1} of ${totalArrows}</h3>
      <form id="arrowForm">
        <label>
          Score for Arrow ${currentArrow + 1}:
          <input id="arrowScore" type="number" min="0" max="10" required autofocus />
        </label>
        <button type="submit">Submit</button>
        <button type="button" id="undoBtn" ${currentArrow === 0 ? 'disabled' : ''}>Undo</button>
      </form>
      <p>Total Score So Far: ${scores.filter(s => s !== null).reduce((a, b) => a + b, 0)}</p>
    `;
    sessionInputContainer.classList.remove("hidden");
    sessionSetupContainer.classList.add("hidden");
    sessionResultsContainer.classList.add("hidden");

    const arrowScoreInput = document.getElementById("arrowScore");
    arrowScoreInput.focus();

    document.getElementById("arrowForm").onsubmit = (e) => {
      e.preventDefault();
      const val = parseInt(arrowScoreInput.value);
      if (isNaN(val) || val < 0 || val > 10) {
        alert("Please enter a score between 0 and 10.");
        return;
      }
      scores[currentArrow] = val;
      currentArrow++;
      if (currentArrow < totalArrows) {
        renderInput();
      } else {
        // Convert flat scores to ends
        let scoresByEnds = [];
        for (let i = 0; i < scores.length; i += arrowsPerEnd) {
          scoresByEnds.push(scores.slice(i, i + arrowsPerEnd));
        }
        submitSession(setup, scoresByEnds);
      }
    };

    document.getElementById("undoBtn").onclick = () => {
      if (currentArrow > 0) {
        currentArrow--;
        scores[currentArrow] = null;
        renderInput();
      }
    };
  }

  renderInput();
}

// Save session to Firestore and show results
async function submitSession(setup, scores) {
  const totalScore = scores.flat().reduce((a, b) => a + b, 0);
  try {
    await addDoc(collection(db, "sessions"), {
      userId: auth.currentUser.uid,
      timestamp: new Date().toISOString(),
      scores,
      totalScore,
      ...setup
    });
    renderResults(scores, totalScore);
  } catch (error) {
    alert("Error saving session: " + error.message);
  }
}

// Display session results and chart
function renderResults(scores, totalScore) {
  sessionResultsContainer.innerHTML = `
    <h3>Session Results</h3>
    <table>
      <thead>
        <tr><th>End</th>${scores[0].map((_, i) => `<th>Arrow ${i + 1}</th>`).join("")}<th>End Total</th></tr>
      </thead>
      <tbody>
        ${scores
          .map(
            (end, i) =>
              `<tr><td>${i + 1}</td>${end.map(val => `<td>${val}</td>`).join("")}<td>${end.reduce(
                (a, b) => a + b,
                0
              )}</td></tr>`
          )
          .join("")}
        <tr><th colspan="${scores[0].length + 2}">Grand Total: ${totalScore}</th></tr>
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
      labels: scores.map((_, i) => `End ${i + 1}`),
      datasets: [
        {
          label: "End Score",
          data: scores.map(end => end.reduce((a, b) => a + b, 0)),
          borderColor: "blue",
          fill: false
        }
      ]
    }
  });

  document.getElementById("startNewSessionBtn").onclick = () => {
    sessionResultsContainer.classList.add("hidden");
    prepareSessionSetup();
  };
}
