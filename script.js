import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import Chart from "https://cdn.jsdelivr.net/npm/chart.js"; // Chart.js import (ensure this is valid in context)

// Firebase Config & Init
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

// Globals
let currentUser = null;
let currentUserRole = null;
let currentSession = {
  ends: []
};
let arrowScores = [];
let currentEndCoords = [];
let currentEndNumber = 1;

const canvas = document.getElementById("target");
const ctx = canvas?.getContext("2d");

// Show screen helper
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if(el) el.classList.add("active");
  if(id === "scoringArea") drawTarget();
  if(id === "setup") updateSessionSetupOptions();
}

// Draw outdoor archery target
function drawTarget() {
  if(!ctx) return;
  const radius = canvas.width / 2;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for(let i=10; i>0; i--) {
    const ringRadius = radius * i / 10;
    let color = '#FFFFFF'; // white
    if(i > 8) color = '#FFFF00'; // yellow
    else if(i > 6) color = '#FF0000'; // red
    else if(i > 4) color = '#0000FF'; // blue
    else if(i > 2) color = '#000000'; // black
    else color = '#FFFFFF'; // white
    ctx.beginPath();
    ctx.arc(radius,radius,ringRadius,0,Math.PI*2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

// Update scores UI
function updateEndScores() {
  const endScoresDiv = document.getElementById("endScores");
  const endTotalDiv = document.getElementById("endTotal");
  if(endScoresDiv) endScoresDiv.innerText = arrowScores.join(" | ");
  if(endTotalDiv){
    const total = arrowScores.filter(s => typeof s === "number").reduce((a,b) => a + b, 0);
    endTotalDiv.innerText = "End Total: " + total;
  }
}

// Update buttons visibility
function updateEndSessionButtons() {
  const nextBtn = document.getElementById("nextEndBtn");
  const endBtn = document.getElementById("endSessionBtn");
  const lastEnd = currentEndNumber === currentSession.endsCount;
  const arrowsComplete = arrowScores.length === currentSession.arrowsPerEnd;
  if(lastEnd && arrowsComplete) {
    nextBtn.style.display = "none";
    endBtn.style.display = "inline-block";
  } else {
    nextBtn.style.display = "inline-block";
    endBtn.style.display = "none";
  }
}

// Handle scoring on canvas click and record coordinates
function handleCanvasScoreClick(e) {
  if(!currentSession.arrowsPerEnd) return;
  if(arrowScores.length >= currentSession.arrowsPerEnd){
    alert("All arrows scored");
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const dist = Math.sqrt((x-centerX)**2 + (y-centerY)**2);
  const maxRadius = canvas.width / 2;
  const ringWidth = maxRadius / 10;

  let score = "M";
  for(let i=1; i<=10; i++){
    if(dist <= ringWidth*i){
      score = 11 - i;
      break;
    }
  }

  arrowScores.push(score);
  currentEndCoords.push({ x: x - centerX, y: centerY - y }); // Y inverted for chart

  updateEndScores();
  updateEndSessionButtons();
}

// Signup
async function signup() {
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;
  const msgDiv = document.getElementById("loginMessage");
  msgDiv.innerText = "";
  if(!username || !email || !password) {
    msgDiv.innerText = "Please fill all fields!";
    return;
  }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    await setDoc(doc(db,"users",uid),{name:username,role,sessions:{}});
    currentUser = userCredential.user;
    msgDiv.innerText = "Signup successful! Please login.";
    showScreen("loginPage");
  } catch(e) {
    msgDiv.innerText = e.message;
  }
}

// Login
async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msgDiv = document.getElementById("loginMessage");
  msgDiv.innerText = "";
  if(!email || !password){
    msgDiv.innerText = "Please enter email and password!";
    return;
  }
  try {
    await signInWithEmailAndPassword(auth,email,password);
  } catch(e){
    msgDiv.innerText = e.message;
  }
}

// Update setup options for session
function updateSessionSetupOptions() {
  const bowDistances = {
    Recurve: [10,12,15,18,20,30,40,50,60,70,80],
    Compound: [10,12,15,18,20,30,40,50],
    Barebow: [10,12,15,18,20,30],
    Longbow: [10,12,15,18,20,30],
  };
  const bowTargetFaces = {
    Compound: [
      {value:"60", label:"60cm (Compound Only)"},
      {value:"40", label:"40cm (Indoor)"},
      {value:"3spot", label:"40cm 3-Spot (Indoor)"},
      {value:"9spot", label:"40cm 9-Spot (Indoor)"}
    ],
    indoorOnly: [
      {value:"40", label:"40cm (Indoor)"},
      {value:"3spot", label:"40cm 3-Spot (Indoor)"},
      {value:"9spot", label:"40cm 9-Spot (Indoor)"}
    ],
    outdoorOnly: [
      {value:"122", label:"122cm (Outdoor)"},
      {value:"80", label:"80cm (Outdoor)"}
    ]
  };

  const bowSelect = document.getElementById("bowStyle");
  const distSelect = document.getElementById("distance");
  const faceSelect = document.getElementById("targetFace");

  if(bowSelect.options.length === 0) {
    Object.keys(bowDistances).forEach(bow => {
      const opt = document.createElement("option");
      opt.value = bow;
      opt.textContent = bow;
      bowSelect.appendChild(opt);
    });
  }

  function updateDistances() {
    distSelect.innerHTML = "";
    const selectedBow = bowSelect.value;
    bowDistances[selectedBow].forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = `${d}m`;
      distSelect.appendChild(opt);
    });
    updateTargetFaces();
  }

  function updateTargetFaces(){
    faceSelect.innerHTML = "";
    const selectedBow = bowSelect.value;
    const distance = parseInt(distSelect.value);
    let faces = [];
    if(distance <= 18){
      faces = selectedBow === "Compound" ? bowTargetFaces.Compound : bowTargetFaces.indoorOnly;
    } else {
      faces = selectedBow === "Compound" ? bowTargetFaces.Compound : bowTargetFaces.outdoorOnly.concat(bowTargetFaces.indoorOnly);
    }
    faces.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.value;
      opt.textContent = f.label;
      faceSelect.appendChild(opt);
    });
  }

  bowSelect.onchange = updateDistances;
  distSelect.onchange = updateTargetFaces;

  updateDistances();
}

// Start session
function startSession() {
  if(currentUserRole !== "archer") {
    alert("Only Archers can start a scoring session.");
    return;
  }

  currentSession = {
    bowStyle: document.getElementById("bowStyle").value,
    distance: parseInt(document.getElementById("distance").value),
    targetFace: document.getElementById("targetFace").value,
    arrowsPerEnd: parseInt(document.getElementById("arrowsPerEnd").value),
    endsCount: parseInt(document.getElementById("endsCount").value),
    ends: [],
    totalScore: 0
  };

  arrowScores = [];
  currentEndCoords = [];
  currentEndNumber = 1;
  document.getElementById("currentEnd").innerText = currentEndNumber;
  showScreen("scoringArea");
  drawTarget();
  updateEndScores();
  updateEndSessionButtons();
}

function undoLastArrow() {
  if (arrowScores.length === 0) {
    alert("No arrows to undo");
    return;
  }
  arrowScores.pop();
  currentEndCoords.pop();
  updateEndScores();
  updateEndSessionButtons();
}

async function nextEnd() {
  if (arrowScores.length !== currentSession.arrowsPerEnd) {
    alert("Please score all arrows!");
    return;
  }
  currentSession.ends.push({
    scores: [...arrowScores],
    coords: [...currentEndCoords]
  });
  currentSession.totalScore += arrowScores.filter(s => typeof s === "number").reduce((a,b) => a + b, 0);
  arrowScores = [];
  currentEndCoords = [];
  updateEndScores();
  updateEndSessionButtons();

  if(currentEndNumber === currentSession.endsCount){
    alert("All ends complete. Please end the session.");
    return;
  }

  currentEndNumber++;
  document.getElementById("currentEnd").innerText = currentEndNumber;
}

// Save session to Firestore
async function saveSession() {
  if (!currentUser) return;

  const userRef = doc(db, "users", currentUser.uid);
  const sessionKey = Date.now().toString();

  const newSession = {
    bowStyle: currentSession.bowStyle,
    distance: currentSession.distance,
    targetFace: currentSession.targetFace,
    arrowsPerEnd: currentSession.arrowsPerEnd,
    endsCount: currentSession.endsCount,
    ends: currentSession.ends,
    totalScore: currentSession.totalScore,
    date: Timestamp.now()
  };

  try {
    await updateDoc(userRef, {
      [`sessions.${sessionKey}`]: newSession
    });
    console.log("Session saved:", sessionKey);
  } catch (e) {
    console.error("Failed to save session:", e);
  }
}

async function endSession() {
  if (currentSession.ends.length > 0) {
    await saveSession();
  }
  currentSession = {};
  arrowScores = [];
  currentEndCoords = [];
  currentEndNumber = 1;
  showScreen("menuScreen");
}

// View session history
async function loadArchersList() {
  const archerList = document.getElementById("archerList");
  archerList.innerHTML = "";
  const q = query(collection(db, "users"), where("role", "==", "archer"));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    archerList.innerHTML = "<li>No archers found.</li>";
    return;
  }
  snapshot.forEach(docSnap => {
    const archer = docSnap.data();
    const li = document.createElement("li");
    li.textContent = archer.name;
    li.style.cursor = "pointer";
    li.addEventListener("click", () => loadArcherSessions(docSnap.id));
    archerList.appendChild(li);
  });
}

async function loadArcherSessions(archerUID) {
  const sessionListDiv = document.getElementById("archerSessionList");
  sessionListDiv.innerHTML = "Loading sessions...";
  const userDoc = await getDoc(doc(db, "users", archerUID));
  if (!userDoc.exists()) {
    sessionListDiv.innerHTML = "Archer not found.";
    return;
  }
  const sessions = userDoc.data().sessions || {};
  const sessionEntries = Object.entries(sessions);
  if (sessionEntries.length === 0) {
    sessionListDiv.innerHTML = "No sessions found.";
    return;
  }
  const ul = document.createElement("ul");
  ul.style.listStyle = "none";
  ul.style.paddingLeft = "0";
  sessionEntries.forEach(([sessionId, sessionData]) => {
    const li = document.createElement("li");
    const date = sessionData.date ? new Date(sessionData.date.seconds * 1000).toLocaleString() : "No date";
    const total = sessionData.totalScore || 0;
    li.textContent = `Date: ${date} - Total Score: ${total}`;
    li.style.cursor = "pointer";
    li.style.padding = "5px";
    li.style.borderBottom = "1px solid #555";
    li.addEventListener("click", () => displaySessionResult(sessionData));
    ul.appendChild(li);
  });
  sessionListDiv.innerHTML = "";
  sessionListDiv.appendChild(ul);
}

// Display session details with charts
function displaySessionResult(sessionData) {
  const container = document.getElementById("sessionResultContainer");
  container.style.display = "block";

  const summaryDiv = document.getElementById("sessionResultSummary");
  const tableDiv = document.getElementById("sessionResultTable");
  const scoreChartCanvas = document.getElementById("sessionResultChart");
  const dispersionCanvas = document.getElementById("dispersionChart");

  summaryDiv.innerHTML = `
    <p><strong>Bow Style:</strong> ${sessionData.bowStyle}</p>
    <p><strong>Distance:</strong> ${sessionData.distance}m</p>
    <p><strong>Target Face:</strong> ${sessionData.targetFace}</p>
    <p><strong>Total Score:</strong> ${sessionData.totalScore}</p>
    <p><strong>Ends:</strong> ${sessionData.ends.length}</p>
  `;

  // Build table
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";

  let header = "<tr><th>End</th>";
  for (let i = 1; i <= sessionData.arrowsPerEnd; i++) {
    header += `<th>Arrow ${i}</th>`;
  }
  header += "<th>End Total</th></tr>";
  table.innerHTML = header;

  sessionData.ends.forEach((end, idx) => {
    const endScores = end.scores || [];
    const endTotal = endScores.filter((s) => typeof s === "number").reduce((a, b) => a + b, 0);
    let row = `<tr><td>${idx + 1}</td>`;
    endScores.forEach((score) => (row += `<td>${score}</td>`));
    row += `<td>${endTotal}</td></tr>`;
    table.innerHTML += row;
  });

  tableDiv.innerHTML = "";
  tableDiv.appendChild(table);

  // Score Chart
  const scoreCtx = scoreChartCanvas.getContext("2d");
  if (window.sessionScoreChart) window.sessionScoreChart.destroy();

  const endTotals = sessionData.ends.map((end) =>
    (end.scores || []).filter((s) => typeof s === "number").reduce((a, b) => a + b, 0)
  );

  window.sessionScoreChart = new Chart(scoreCtx, {
    type: "bar",
    data: {
      labels: sessionData.ends.map((_, i) => `End ${i + 1}`),
      datasets: [
        {
          label: "End Total",
          data: endTotals,
          backgroundColor: "rgba(59, 130, 246, 0.7)"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  // Dispersion Chart
  const dispCtx = dispersionCanvas.getContext("2d");
  if (window.sessionDispersionChart) window.sessionDispersionChart.destroy();

  const scatterData = sessionData.ends.flatMap((end, i) =>
    (end.coords || []).map((coord, idx) => ({
      x: coord.x,
      y: coord.y,
      label: `End ${i + 1} Arrow ${idx + 1}`
    }))
  );

  window.sessionDispersionChart = new Chart(dispCtx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Arrow Dispersion",
          data: scatterData,
          backgroundColor: "rgba(255, 99, 132, 0.6)"
        }
      ]
    },
    options: {
      scales: {
        x: { type: "linear", position: "bottom", title: { display: true, text: "X" } },
        y: { type: "linear", title: { display: true, text: "Y" }, reverse: true }
      }
    }
  });
}

// Event handler to hide session result view and show coach dashboard
document.getElementById("coachBackBtn").addEventListener("click", () => {
  document.getElementById("sessionResultContainer").style.display = "none";
  showScreen("coachDashboard");
});

// Show screen helper
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  if (id === "scoringArea") drawTarget();
  if (id === 'setup') updateSessionSetupOptions();
}

// Attach buttons and event listeners
function attachButtonHandlers() {
  document.getElementById("signupBtn")?.addEventListener("click", signup);
  document.getElementById("loginBtn")?.addEventListener("click", login);
  document.getElementById("menuStartBtn")?.addEventListener("click", () => showScreen("setup"));
  document.getElementById("menuHistoryBtn")?.addEventListener("click", () => showScreen("historyScreen"));
  document.getElementById("menuLogoutBtn")?.addEventListener("click", () => signOut(auth).then(() => showScreen("loginPage")));
  document.getElementById("startSessionBtn")?.addEventListener("click", startSession);
  document.getElementById("undoBtn")?.addEventListener("click", undoLastArrow);
  document.getElementById("nextEndBtn")?.addEventListener("click", nextEnd);
  document.getElementById("endSessionBtn")?.addEventListener("click", endSession);
  document.getElementById("backToSetupBtn")?.addEventListener("click", () => {
    arrowScores = [];
    currentSession = { ends: [] };
    currentEndCoords = [];
    currentEndNumber = 1;
    showScreen("setup");
    drawTarget();
    updateEndScores();
    updateEndSessionButtons();
  });
  document.getElementById("backToMenuBtn")?.addEventListener("click", () => showScreen("menuScreen"));
  document.getElementById("coachBackBtn")?.addEventListener("click", () => {
    document.getElementById("sessionResultContainer").style.display = "none";
    showScreen("coachDashboard");
  });
  if (canvas) canvas.addEventListener("click", handleCanvasScoreClick);
}

// Firebase auth listener
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      currentUserRole = data.role || "archer";
      document.getElementById("greeting").innerText = `Hello, ${data.name}! (${currentUserRole})`;
      if (currentUserRole === "coach") {
        showScreen("coachDashboard");
        await loadArchersList();
      } else {
        showScreen("menuScreen");
      }
    }
  } else {
    currentUser = null;
    currentUserRole = null;
    showScreen("loginPage");
  }
});

// Initialization on DOM ready
window.addEventListener("DOMContentLoaded", () => {
  attachButtonHandlers();
  updateSessionSetupOptions();
  drawTarget();
  updateEndScores();
  updateEndSessionButtons();
});
