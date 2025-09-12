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

let currentUser = null;
let currentUserRole = null;
let currentSession = { ends: [] };
let arrowScores = [];
let currentEndCoords = [];
let currentEndNumber = 1;

const canvas = document.getElementById("target");
const ctx = canvas?.getContext("2d");

// Show screen helper
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  if (id === "scoringArea") drawTarget();
  if (id === "setup") updateSessionSetupOptions();
}

// Draw target rings
function drawTarget() {
  if (!ctx) return;
  const radius = canvas.width / 2;
  const rings = [
    { color: "#FFFFFF", radius: radius }, // outer ring
    { color: "#000000", radius: radius * 0.8 },
    { color: "#0000FF", radius: radius * 0.6 },
    { color: "#FF0000", radius: radius * 0.4 },
    { color: "#FFFF00", radius: radius * 0.2 }
  ];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  rings.forEach(ring => {
    ctx.beginPath();
    ctx.arc(radius, radius, ring.radius, 0, 2 * Math.PI);
    ctx.fillStyle = ring.color;
    ctx.fill();
  });
}

// Update UI scores display
function updateEndScores() {
  const endScoresDiv = document.getElementById("endScores");
  const endTotalDiv = document.getElementById("endTotal");
  if (endScoresDiv) endScoresDiv.innerText = arrowScores.join(" | ");
  if (endTotalDiv) {
    const numeric = arrowScores.filter(s => typeof s === "number").reduce((a, b) => a + b, 0);
    endTotalDiv.innerText = "End Total: " + numeric;
  }
}

// Update show hide for next/end buttons
function updateEndSessionButtons() {
  const nextBtn = document.getElementById("nextEndBtn");
  const endBtn = document.getElementById("endSessionBtn");
  const isLastEnd = currentEndNumber === currentSession.endsCount;
  const arrowsComplete = arrowScores.length === currentSession.arrowsPerEnd;
  if (isLastEnd && arrowsComplete) {
    nextBtn.style.display = "none";
    endBtn.style.display = "inline-block";
  } else {
    nextBtn.style.display = "inline-block";
    endBtn.style.display = "none";
  }
}

// Handle target canvas clicks
function handleCanvasScoreClick(e) {
  if (!currentSession.arrowsPerEnd) return;
  if (arrowScores.length >= currentSession.arrowsPerEnd) {
    alert("All arrows scored");
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
  const maxRadius = canvas.width / 2;
  const ringWidth = maxRadius / 10;

  let score = "M"; // Default Miss

  if (dist <= ringWidth * 1) score = 10;
  else if (dist <= ringWidth * 2) score = 9;
  else if (dist <= ringWidth * 3) score = 8;
  else if (dist <= ringWidth * 4) score = 7;
  else if (dist <= ringWidth * 5) score = 6;
  else if (dist <= ringWidth * 6) score = 5;
  else if (dist <= ringWidth * 7) score = 4;
  else if (dist <= ringWidth * 8) score = 3;
  else if (dist <= ringWidth * 9) score = 2;
  else if (dist <= ringWidth * 10) score = 1;

  arrowScores.push(score);
  currentEndCoords.push({ x: x - centerX, y: centerY - y }); // Y inverted for chart orientation
  updateEndScores();
  updateEndSessionButtons();
}

// Signup handler
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
  }
}

// Login handler
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
  }
}

// Load session setup options dynamically
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
      {value:"9spot", label:"40cm 9-Spot (Indoor)"},
    ],
    indoorOnly: [
      {value:"40", label:"40cm (Indoor)"},
      {value:"3spot", label:"40cm 3-Spot (Indoor)"},
      {value:"9spot", label:"40cm 9-Spot (Indoor)"},
    ],
    outdoorOnly: [
      {value:"122", label:"122cm (Outdoor)"},
      {value:"80", label:"80cm (Outdoor)"},
    ],
  };

  const bowSelect = document.getElementById("bowStyle");
  const distSelect = document.getElementById("distance");
  const faceSelect = document.getElementById("targetFace");

  // Populate bow styles once
  if(bowSelect.options.length === 0){
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

  function updateTargetFaces() {
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

// Start session processing
function startSession(){
  // Role-based access control here: only archers can start session
  if(currentUserRole !== "archer"){
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
  currentEndNumber = 1;
  document.getElementById("currentEnd").innerText = currentEndNumber;
  showScreen("scoringArea");
  drawTarget();
  updateEndScores();
  updateEndSessionButtons();
}

// Undo last arrow
function undoLastArrow(){
  arrowScores.pop();
  updateEndScores();
  updateEndSessionButtons();
}

async function nextEnd() {
  if (arrowScores.length !== currentSession.arrowsPerEnd) {
    alert("Please score all arrows!");
    return;
  }
  currentSession.ends.push({
    arrows: [...arrowScores],
    coords: [...currentEndCoords]
  });
  currentSession.totalScore += arrowScores.filter(s => typeof s === "number").reduce((a, b) => a + b, 0);
  arrowScores = [];
  currentEndCoords = [];
  updateEndScores();
  updateEndSessionButtons();
  if (currentEndNumber === currentSession.endsCount) {
    return;
  }
  currentEndNumber++;
  document.getElementById("currentEnd").innerText = currentEndNumber;
}

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

// Load coach dashboard archers and sessions

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
    li.onclick = () => loadArcherSessions(docSnap.id);
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
    li.onclick = () => {
      displaySessionResult(sessionData);
    };
    ul.appendChild(li);
  });
  sessionListDiv.innerHTML = "";
  sessionListDiv.appendChild(ul);
}

// Display session result with charts

function displaySessionResult(sessionData) {
  document.getElementById("sessionResultContainer").style.display = "block";

  const summaryDiv = document.getElementById("sessionResultSummary");
  const tableDiv = document.getElementById("sessionResultTable");
  const chartCanvas = document.getElementById("sessionResultChart");
  const dispersionCanvas = document.getElementById("sessionDispersionChart");

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

  let headerRow = "<tr><th>End</th>";
  const arrowsCount = sessionData.arrowsPerEnd || (sessionData.ends[0]?.arrows.length || 0);
  for (let i = 1; i <= arrowsCount; i++) {
    headerRow += `<th>Arrow ${i}</th>`;
  }
  headerRow += "<th>End Total</th></tr>";
  table.innerHTML = headerRow;

  sessionData.ends.forEach((endObj, idx) => {
    const endArr = endObj.arrows || [];
    const endTotal = endArr.filter((s) => typeof s === "number").reduce((a, b) => a + b, 0);
    let row = `<tr><td>${idx + 1}</td>`;
    endArr.forEach((score) => {
      row += `<td>${score}</td>`;
    });
    row += `<td>${endTotal}</td></tr>`;
    table.innerHTML += row;
  });

  tableDiv.innerHTML = "";
  tableDiv.appendChild(table);

  // Score Chart
  const ctx = chartCanvas.getContext("2d");
  if (window.sessionChartInstance) window.sessionChartInstance.destroy();

  const endTotals = sessionData.ends.map((end) =>
    (end.arrows || []).filter((s) => typeof s === "number").reduce((a, b) => a + b, 0)
  );

  window.sessionChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sessionData.ends.map((_, i) => `End ${i + 1}`),
      datasets: [
        {
          label: "End Total",
          data: endTotals,
          backgroundColor: "rgba(59, 130, 246, 0.7)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });

  // Dispersion Chart
  if (!dispersionCanvas) return;
  const dispCtx = dispersionCanvas.getContext("2d");
  if (window.sessionDispersionChartInstance) window.sessionDispersionChartInstance.destroy();

  const scatterData = sessionData.ends.flatMap((end, i) =>
    (end.coords || []).map((coord, idx) => ({
      x: coord.x,
      y: coord.y,
      label: `End ${i + 1} Arrow ${idx + 1}`,
    }))
  );

  window.sessionDispersionChartInstance = new Chart(dispCtx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Arrow Dispersion",
          data: scatterData,
          backgroundColor: "rgba(255, 99, 132, 0.6)",
        },
      ],
    },
    options: {
      scales: {
        x: { type: "linear", position: "bottom", title: { display: true, text: "X position" } },
        y: { type: "linear", title: { display: true, text: "Y position" }, reverse: true },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: context => context.raw.label || ''
          }
        }
      }
    },
  });
}

// Show Coach Dashboard function
function showCoachDashboard() {
  showScreen("coachDashboard");
  loadArchersList();
}

// Add nav control for Coach Dashboard
document.getElementById("coachBackBtn").addEventListener("click", () => {
  document.getElementById("sessionResultContainer").style.display = "none";
  showScreen("menuScreen");
});

// Initialization
window.addEventListener("DOMContentLoaded", () => {
  attachButtonHandlers();
  updateSessionSetupOptions();
  drawTarget();
  updateEndScores();
  updateEndSessionButtons();
  if(canvas) canvas.addEventListener("click", handleCanvasScoreClick);
});
