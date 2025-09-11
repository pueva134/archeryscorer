// ------------------------------
// script.js (Full working with configs and features)
// ------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Firebase Config and Initialization
const firebaseConfig = {
  apiKey: "AIzaSyAAc3sRW7WuQXbvlVKKdb8pFa3UOpidalM",
  authDomain: "my-scorer.firebaseapp.com",
  projectId: "my-scorer",
  storageBucket: "my-scorer.appspot.com",
  messagingSenderId: "243500946215",
  appId: "1:243500946215:web:bd976f1bd437edce684f02",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Globals
let currentUser = null;
let currentSession = {};
let arrowScores = [];
let currentEndNumber = 1;

const canvas = document.getElementById("target");
const ctx = canvas?.getContext("2d");

// UI Screen Utility
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
  if (id === "setup") updateSessionSetupOptions();
}

// Canvas Drawing
function drawTarget() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const colors = [
    "rgba(255,255,255,1)",
    "rgba(0,0,0,1)",
    "rgba(0,140,255,1)",
    "rgba(255,0,0,1)",
    "rgba(255,255,43,1)",
  ];
  let radius = canvas.width / 2;
  for (let i = 0; i < colors.length; i++) {
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 30 * i, 0, 2 * Math.PI);
    ctx.fillStyle = colors[i];
    ctx.fill();
  }
}

// Update end scores display
function updateEndScores() {
  const endScoresDiv = document.getElementById("endScores");
  const endTotalDiv = document.getElementById("endTotal");
  if (endScoresDiv) endScoresDiv.innerText = arrowScores.join(" | ");
  if (endTotalDiv) endTotalDiv.innerText = "End Total: " + arrowScores.reduce((a, b) => a + b, 0);
}

// Manage visibility of Next and End Session buttons
function updateEndSessionButtons() {
  const nextEndBtn = document.getElementById("nextEndBtn");
  const endSessionBtn = document.getElementById("endSessionBtn");
  const lastEnd = currentEndNumber === currentSession.endsCount;
  const arrowsComplete = arrowScores.length === currentSession.arrowsPerEnd;
  if (lastEnd && arrowsComplete) {
    if (nextEndBtn) nextEndBtn.style.display = "none";
    if (endSessionBtn) endSessionBtn.style.display = "inline-block";
  } else {
    if (nextEndBtn) nextEndBtn.style.display = "inline-block";
    if (endSessionBtn) endSessionBtn.style.display = "none";
  }
}

// Firebase Auth listener — show welcome or login screen
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const username = userDoc.data().name;
        document.querySelector(".container h1").innerHTML = `🏹 My Scorer 🏹<br><span style="font-size:1rem;">Hello, ${username}!</span>`;
      }
    } catch (e) {
      console.error(e);
    }
    showScreen("setup");
  } else {
    document.querySelector(".container h1").innerHTML = "🏹 My Scorer 🏹";
    showScreen("loginPage");
  }
});

// Signup function
async function signup() {
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;
  const msgDiv = document.getElementById("loginMessage");
  msgDiv.innerText = "";

  if (!username || !email || !password) {
    msgDiv.innerText = "Please fill all fields!";
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    await setDoc(doc(db, "users", uid), {
      name: username,
      role: role,
      sessions: {},
    });
    currentUser = userCredential.user;
    msgDiv.innerText = "Signup successful! Please login.";
    showScreen("loginPage");
  } catch (e) {
    msgDiv.innerText = e.message;
    console.error("Signup error:", e);
  }
}

// Login function
async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msgDiv = document.getElementById("loginMessage");
  msgDiv.innerText = "";

  if (!email || !password) {
    msgDiv.innerText = "Please enter email and password!";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    msgDiv.innerText = e.message;
    console.error("Login error:", e);
  }
}

// Distances and faces for bows — dynamic adjustment
const bowDistances = {
  Recurve: [10, 12, 15, 18, 20, 30, 40, 50, 60, 70, 80],
  Compound: [10, 12, 15, 18, 20, 30, 40, 50],
  Barebow: [10, 12, 15, 18, 20, 30],
  Longbow: [10, 12, 15, 18, 20, 30],
};
const bowTargetFaces = {
  Compound: [
    { value: "60", label: "60cm (Compound Only)" },
    { value: "40", label: "40cm (Indoor)" },
    { value: "3spot", label: "40cm 3-Spot (Indoor)" },
    { value: "9spot", label: "40cm 9-Spot (Indoor)" },
  ],
  indoorOnly: [
    { value: "40", label: "40cm (Indoor)" },
    { value: "3spot", label: "40cm 3-Spot (Indoor)" },
    { value: "9spot", label: "40cm 9-Spot (Indoor)" },
  ],
  outdoorOnly: [
    { value: "122", label: "122cm (Outdoor)" },
    { value: "80", label: "80cm (Outdoor)" },
  ],
};

// Update session setup options dynamically
function updateSessionSetupOptions() {
  const bowSelect = document.getElementById("bowStyle");
  const distSelect = document.getElementById("distance");
  const faceSelect = document.getElementById("targetFace");

  if (!bowSelect.options.length) {
    for (const bow in bowDistances) {
      const opt = document.createElement("option");
      opt.value = bow;
      opt.textContent = bow;
      bowSelect.appendChild(opt);
    }
  }

  function updateDistances() {
    distSelect.innerHTML = "";
    const selectedBow = bowSelect.value;
    bowDistances[selectedBow].forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = `${d}m`;
      distSelect.appendChild(opt);
    });
    updateFaces();
  }

  function updateFaces() {
    faceSelect.innerHTML = "";
    const selectedBow = bowSelect.value;
    const distance = parseInt(distSelect.value);

    let faces = [];

    if (distance <= 18) {
      faces =
        selectedBow === "Compound"
          ? bowTargetFaces.Compound
          : bowTargetFaces.indoorOnly;
    } else {
      faces =
        selectedBow === "Compound"
          ? bowTargetFaces.Compound
          : bowTargetFaces.outdoorOnly.concat(bowTargetFaces.indoorOnly);
    }

    faces.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.value;
      opt.textContent = f.label;
      faceSelect.appendChild(opt);
    });
  }

  bowSelect.onchange = updateDistances;
  distSelect.onchange = updateFaces;

  updateDistances();
}

// Session and scoring control functions

function startSession() {
  currentSession = {
    bowStyle: document.getElementById("bowStyle").value,
    distance: parseInt(document.getElementById("distance").value),
    targetFace: document.getElementById("targetFace").value,
    arrowsPerEnd: parseInt(document.getElementById("arrowsPerEnd").value),
    endsCount: parseInt(document.getElementById("endsCount").value),
    ends: [],
    totalScore: 0,
  };
  arrowScores = [];
  currentEndNumber = 1;
  document.getElementById("currentEnd").innerText = currentEndNumber;
  showScreen("scoringArea");
  drawTarget();
  updateEndScores();
  document.getElementById("nextEndBtn").style.display = "inline-block";
  if (document.getElementById("endSessionBtn")) {
    document.getElementById("endSessionBtn").style.display = "none";
  }
}

function undoLastArrow() {
  arrowScores.pop();
  updateEndScores();
  updateEndSessionButtons();
}

async function nextEnd() {
  if (arrowScores.length !== currentSession.arrowsPerEnd) {
    alert("Shoot all arrows first!");
    return;
  }
  currentSession.ends.push([...arrowScores]);
  currentSession.totalScore += arrowScores.reduce((a, b) => a + b, 0);
  arrowScores = [];
  updateEndScores();
  if (currentEndNumber === currentSession.endsCount) {
    updateEndSessionButtons();
    return;
  }
  currentEndNumber++;
  document.getElementById("currentEnd").innerText = currentEndNumber;
  updateEndScores();
  updateEndSessionButtons();
}

async function saveSession() {
  if (!currentUser) return;
  const userRef = doc(db, "users", currentUser.uid);
  const sessionKey = Date.now().toString();
  const safeSession = {
    bowStyle: currentSession.bowStyle,
    distance: currentSession.distance,
    targetFace: currentSession.targetFace,
    arrowsPerEnd: currentSession.arrowsPerEnd,
    endsCount: currentSession.endsCount,
    ends: currentSession.ends.map((end) => [...end]),
    totalScore: currentSession.totalScore,
    date: Timestamp.now(),
  };
  try {
    await updateDoc(userRef, {
      [`sessions.${sessionKey}`]: safeSession,
    });
    console.log("Session saved!");
  } catch (e) {
    console.error("Error saving session:", e);
  }
}

async function endSession() {
  try {
    if (currentUser && currentSession && currentSession.ends.length > 0) {
      await saveSession();
    }
  } catch (e) {
    console.error("Failed to save session:", e);
  }
  currentEndNumber = 1;
  currentSession = {};
  arrowScores = [];
  showScreen("menuScreen");
}

function showResults() {
  showScreen("results");
  const summaryDiv = document.getElementById("sessionSummary");
  summaryDiv.innerHTML = `
    <p>Bow Style: ${currentSession.bowStyle}</p>
    <p>Distance: ${currentSession.distance}m</p>
    <p>Target Face: ${currentSession.targetFace}</p>
    <p>Arrows per End: ${currentSession.arrowsPerEnd}</p>
    <p>Ends Count: ${currentSession.endsCount}</p>
    <p>Total Score: ${currentSession.totalScore}</p>
  `;
  const scoreTableDiv = document.getElementById("scoreTable");
  const table = document.createElement("table");
  const header = document.createElement("tr");
  header.innerHTML =
    "<th>End</th>" +
    [...Array(currentSession.arrowsPerEnd).keys()]
      .map((i) => `<th>Arrow ${i + 1}</th>`)
      .join("") +
    "<th>End Total</th>";
  table.appendChild(header);

  currentSession.ends.forEach((end, i) => {
    const row = document.createElement("tr");
    const endTotal = end.reduce((a, b) => a + b, 0);
    row.innerHTML =
      `<td>${i + 1}</td>` +
      end.map((a) => `<td>${a}</td>`).join("") +
      `<td>${endTotal}</td>`;
    table.appendChild(row);
  });

  scoreTableDiv.innerHTML = "";
  scoreTableDiv.appendChild(table);

  const ctxChart = document.getElementById("scoreChart").getContext("2d");

  if (window.scoreChartInstance) {
    window.scoreChartInstance.destroy();
  }

  window.scoreChartInstance = new Chart(ctxChart, {
    type: "bar",
    data: {
      labels: currentSession.ends.map((_, i) => `End ${i + 1}`),
      datasets: [
        {
          label: "End Total",
          data: currentSession.ends.map((e) => e.reduce((a, b) => a + b, 0)),
          backgroundColor: "rgba(59, 130, 246, 0.7)",
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

function backToSetup() {
  currentEndNumber = 1;
  arrowScores = [];
  currentSession = {};
  showScreen("setup");
  drawTarget();
  updateEndScores();
}

async function viewHistory() {
  if (!currentUser) return;
  const userDoc = await getDoc(doc(db, "users", currentUser.uid));
  if (userDoc.exists()) {
    const sessionsObj = userDoc.data().sessions || {};
    const sessionsArr = Object.values(sessionsObj);
    const table = document.createElement("table");
    table.innerHTML = `<tr><th>Date</th><th>Total Score</th><th>Ends</th></tr>`;
    sessionsArr.forEach((s) => {
      const date = s.date ? new Date(s.date.seconds * 1000).toLocaleDateString() : "N/A";
      table.innerHTML += `<tr><td>${date}</td><td>${s.totalScore}</td><td>${s.ends?.length ?? 0}</td></tr>`;
    });
    const historyDiv = document.getElementById("historyTable");
    historyDiv.innerHTML = "";
    historyDiv.appendChild(table);
    showScreen("historyScreen");
  }
}

function attachButtonHandlers() {
  document.getElementById("signupBtn").addEventListener("click", signup);
  document.getElementById("loginBtn").addEventListener("click", login);

  document.getElementById("menuStartBtn").addEventListener("click", () => showScreen("setup"));
  document.getElementById("menuHistoryBtn").addEventListener("click", viewHistory);
  document.getElementById("menuLogoutBtn").addEventListener("click", () => auth.signOut());
  document.getElementById("menuToggleBtn").addEventListener("click", () => alert("Theme toggled")); // implement toggleTheme if you want

  document.getElementById("startSessionBtn").addEventListener("click", startSession);
  document.getElementById("viewHistoryBtn").addEventListener("click", viewHistory);
  document.getElementById("logoutBtn").addEventListener("click", () => auth.signOut());

  document.getElementById("undoBtn").addEventListener("click", undoLastArrow);
  document.getElementById("nextEndBtn").addEventListener("click", nextEnd);
  document.getElementById("endSessionBtn").addEventListener("click", endSession);

  document.getElementById("backToSetupBtn").addEventListener("click", backToSetup);
  document.getElementById("backToMenuBtn").addEventListener("click", () => showScreen("menuScreen"));

  if (canvas) {
    canvas.addEventListener("click", (e) => {
      if (!currentSession.arrowsPerEnd) return;
      if (arrowScores.length >= currentSession.arrowsPerEnd) {
        alert("All arrows for this end have been scored.");
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const center = canvas.width / 2;
      const dist = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
      let score = 0;
      if (dist < 10) score = X;
      else if (dist < 20) score = 10;
      else if (dist < 30) score = 9;
      else if (dist < 40) score = 8;
      else if (dist < 50) score = 7;
      else if (dist < 60) score = 6;
      else if (dist < 90) score = 4;
      else if (dist < 100) score = 3;
      else if (dist < 110) score = 2;
      else if (dist < 120) score = 1;
      else score = 0;
      arrowScores.push(score);
      updateEndScores();
      updateEndSessionButtons();
    });
  }
}

function init() {
  attachButtonHandlers();
  drawTarget();
  updateEndScores();
  updateSessionSetupOptions();
}
window.addEventListener("DOMContentLoaded", init);
