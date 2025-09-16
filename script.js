import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.0.2/firebase-auth.js";
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
  Timestamp,
} from "https://www.gstatic.com/firebasejs/9.0.2/firebase-firestore.js";

// Firebase config and initialization
const firebaseConfig = {
  apiKey: "AIzaSyDhk1JX8LXrt0GXe8YnxprkFP6r4cMmmRw",
  authDomain: "my-scorer.firebaseapp.com",
  projectId: "my-scorer",
  storageBucket: "my-scorer.appspot.com",
  messagingSenderId: "243500946215",
  appId: "1:243500946215:web:ae6599bc986a721fbc9e3a"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global app state
let currentUser = null;
let currentUserRole = null;
let currentSession = {};
let arrowScores = [];
let currentEndNumber = 1;

let canvas = null;
let ctx = null;

// Utility: capitalize strings
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Manage display of single active screen
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  attachBackToMenuHandlers(); // always call this
  if (id === "scoringArea") {
    canvas = document.getElementById("target");
    ctx = canvas?.getContext("2d");
    drawTarget();
  }
  if (id === "setup") updateSessionSetupOptions();
}

// Draw archery target rings to a canvas
function drawTarget(targetCanvas) {
  const c = targetCanvas || canvas;
  if (!c) return;
  const context = c.getContext("2d");
  if (!context) return;

  const radius = c.width / 2;
  // Ring colors from outer to inner
  const rings = [
    { color: "#FFFFFF", radius: radius },
    { color: "#000000", radius: radius * 0.8 },
    { color: "#0000FF", radius: radius * 0.6 },
    { color: "#FF0000", radius: radius * 0.4 },
    { color: "#FFFF00", radius: radius * 0.2 }
  ];

  // Clear canvas before redrawing
  context.clearRect(0, 0, c.width, c.height);

  rings.forEach(ring => {
    context.beginPath();
    context.arc(radius, radius, ring.radius, 0, 2 * Math.PI);
    context.fillStyle = ring.color;
    context.fill();
  });
}

// Capture click or tap scores on target
function handleScoreClick(e) {
  if (!currentSession.arrowsPerEnd) return;

  if (arrowScores.length >= currentSession.arrowsPerEnd) {
    alert("All arrows scored in this end");
    return;
  }

  const c = canvas || document.getElementById("target");
  if (!c) return;

  const rect = c.getBoundingClientRect();
  // Support touch and mouse events
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const centerX = c.width / 2;
  const centerY = c.height / 2;
  const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

  const maxRadius = c.width / 2;
  const ringWidth = maxRadius / 10;

  let score = 'M'; // Miss default

  if (distance <= ringWidth * 1) score = 10;
  else if (distance <= ringWidth * 2) score = 9;
  else if (distance <= ringWidth * 3) score = 8;
  else if (distance <= ringWidth * 4) score = 7;
  else if (distance <= ringWidth * 5) score = 6;
  else if (distance <= ringWidth * 6) score = 5;
  else if (distance <= ringWidth * 7) score = 4;
  else if (distance <= ringWidth * 8) score = 3;
  else if (distance <= ringWidth * 9) score = 2;
  else if (distance <= ringWidth * 10) score = 1;

  arrowScores.push({ score, x, y });

  updateScoreUI();
  updateButtons();
}

// Update current scoring UI display
function updateScoreUI() {
  const scoreDiv = document.getElementById("endScores");
  const totalDiv = document.getElementById("endTotal");
  if (scoreDiv) {
    scoreDiv.textContent = arrowScores.map(a => (typeof a === 'object' ? a.score : a)).join(" | ");
  }
  if (totalDiv) {
    const total = arrowScores.filter(a => typeof a.score !== 'undefined')
      .reduce((sum, a) => sum + (a.score || 0), 0);
    totalDiv.textContent = `Total: ${total}`;
  }
}

// Update Next and End buttons visibility
function updateButtons() {
  const nextBtn = document.getElementById("nextEnd");
  const endBtn = document.getElementById("endSession");

  if (!currentSession.arrowsPerEnd || !currentSession.endsCount) {
    if (nextBtn) nextBtn.style.display = 'none';
    if (endBtn) endBtn.style.display = 'none';
    return;
  }

  const ended = (arrowScores.length === currentSession.arrowsPerEnd);

  if (ended) {
    if (currentEndNumber < currentSession.endsCount) {
      if (nextBtn) nextBtn.style.display = 'inline-block';
      if (endBtn) endBtn.style.display = 'none';
    } else {
      if (nextBtn) nextBtn.style.display = 'none';
      if (endBtn) endBtn.style.display = 'inline-block';
    }
  } else {
    if (nextBtn) nextBtn.style.display = 'none';
    if (endBtn) endBtn.style.display = 'none';
  }
}

// Signup user
async function signup() {
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;
  const messageDiv = document.getElementById("loginMessage");

  messageDiv.textContent = '';

  if (!username || !email || !password) {
    messageDiv.textContent = "Please fill all fields";
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", userCredential.user.uid), {
      name: username,
      role,
      sessions: {}
    });
    messageDiv.textContent = "Signup successful! Please login";
    showScreen("loginPage");
  } catch (err) {
    messageDiv.textContent = err.message;
  }
}

// Login user
async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const messageDiv = document.getElementById("loginMessage");

  messageDiv.textContent = '';

  if (!email || !password) {
    messageDiv.textContent = "Please enter email and password";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    messageDiv.textContent = err.message;
  }
}

// Initialize dropdowns for setup form
function updateSetupOptions() {
  const bowDistances = {
    "Recurve": [10, 12, 15, 18, 20, 30, 40, 50, 60, 70, 80],
    "Compound": [10, 12, 15, 18, 20, 30, 40, 50],
    "Barebow": [10, 12, 15, 18, 20, 30],
    "Longbow": [10, 12, 15, 18, 20, 30]
  };

  const bowFaces = {
    compound: [
      { value: "60", label: "60cm (Compound Only)" },
      { value: "40", label: "40cm (Indoor)" },
      { value: "3spot", label: "40cm 3-Spot (Indoor)" },
      { value: "9spot", label: "40cm 9-Spot (Indoor)" }
    ],
    indoorOnly: [
      { value: "40", label: "40cm (Indoor)" },
      { value: "3spot", label: "40cm 3-Spot (Indoor)" },
      { value: "9spot", label: "40cm 9-Spot (Indoor)" }
    ],
    outdoorOnly: [
      { value: "122", label: "122cm (Outdoor)" },
      { value: "80", label: "80cm (Outdoor)" }
    ]
  };

  const bowSelect = document.getElementById("bowStyle");
  const distanceSelect = document.getElementById("distance");
  const faceSelect = document.getElementById("targetFace");

  if (!bowSelect || !distanceSelect || !faceSelect) return;

  if (bowSelect.options.length === 0) {
    for (const bow of Object.keys(bowDistances)) {
      const option = document.createElement("option");
      option.value = bow;
      option.textContent = bow;
      bowSelect.appendChild(option);
    }
  }

  function populateDistances() {
    distanceSelect.innerHTML = '';
    const bow = bowSelect.value;
    if (!bowDistances[bow]) return;
    for (const dist of bowDistances[bow]) {
      const option = document.createElement("option");
      option.value = dist;
      option.textContent = dist + "m";
      distanceSelect.appendChild(option);
    }
    populateFaces();
  }

  function populateFaces() {
    faceSelect.innerHTML = '';
    const bow = bowSelect.value;
    const dist = parseInt(distanceSelect.value, 10);
    let faces = [];

    if (bow.toLowerCase() === "compound") {
      faces = bowFaces.compound;
    } else if (dist && dist <= 18) {
      faces = bowFaces.indoorOnly;
    } else {
      faces = bowFaces.outdoorOnly.concat(bowFaces.indoorOnly);
    }

    for (const face of faces) {
      const option = document.createElement("option");
      option.value = face.value;
      option.textContent = face.label;
      faceSelect.appendChild(option);
    }
  }

  bowSelect.onchange = populateDistances;
  distanceSelect.onchange = populateFaces;

  populateDistances();
}

// Start session with provided setup
function startSession() {
  if (currentUserRole !== "archer") {
    alert("Only archers can start sessions.");
    return;
  }

  const bowStyle = document.getElementById("bowStyle")?.value;
  const distance = parseInt(document.getElementById("distance")?.value, 10);
  const face = document.getElementById("targetFace")?.value;
  const arrowsPerEnd = parseInt(document.getElementById("arrowsPerEnd")?.value, 10);
  const endsCount = parseInt(document.getElementById("endsCount")?.value, 10);

  if (!bowStyle || isNaN(distance) || !face || isNaN(arrowsPerEnd) || isNaN(endsCount)) {
    alert("Please fill all setup fields properly.");
    return;
  }

  currentSession = { bowStyle, distance, targetFace: face, arrowsPerEnd, endsCount, ends: [], totalScore: 0 };
  arrowScores = [];
  currentEndNumber = 1;

  const currentEndSpan = document.getElementById("currentEnd");
  if (currentEndSpan) currentEndSpan.textContent = currentEndNumber;

  showScreen("scoringArea");
  drawTarget();
  updateScoreUI();
  updateButtons();
}

// Undo last arrow
function undoLast() {
  if (arrowScores.length === 0) return;
  arrowScores.pop();
  updateScoreUI();
  updateButtons();
}

// Move to next end
async function nextEnd() {
  if (!currentSession.arrowsPerEnd) return;
  if (arrowScores.length !== currentSession.arrowsPerEnd) {
    alert("Score all arrows for this end.");
    return;
  }

  currentSession.ends.push([...arrowScores]);
  const total = arrowScores.reduce((sum, a) => sum + (a.score || 0), 0);
  currentSession.totalScore += total;
  arrowScores = [];

  updateScoreUI();
  updateButtons();

  if (currentEndNumber < currentSession.endsCount) {
    currentEndNumber++;
    const currentEndSpan = document.getElementById("currentEnd");
    if (currentEndSpan) currentEndSpan.textContent = currentEndNumber;
  }
}

// Save session to Firestore
async function saveSession() {
  if (!currentUser) return;

  const key = Date.now().toString();
  const sessionData = {
    bowStyle: currentSession.bowStyle,
    distance: currentSession.distance,
    targetFace: currentSession.targetFace,
    arrowsPerEnd: currentSession.arrowsPerEnd,
    endsCount: currentSession.endsCount,
    ends: currentSession.ends.map(e => ({ arrows: e })),
    totalScore: currentSession.totalScore,
    date: Timestamp.now()
  };

  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, { [`sessions.${key}`]: sessionData });
  } catch (err) {
    console.error("Error saving session:", err);
  }
}

// End session logic
async function endSession() {
  if (!currentSession.arrowsPerEnd) return;
  if (arrowScores.length && arrowScores.length !== currentSession.arrowsPerEnd) {
    alert("Finish scoring all arrows before ending the session.");
    return;
  }
  if (arrowScores.length) {
    currentSession.ends.push([...arrowScores]);
    currentSession.totalScore += arrowScores.reduce((sum, a) => sum + (a.score || 0), 0);
    arrowScores = [];
  }
  await saveSession();
  showSessionResults(currentSession);
}

// Attach handlers for all back buttons to show menu and reset session state
// Attach Back to Menu handlers for all navigation
function attachBackToMenuHandlers() {
  const ids = [
    "backToMenuBtn",
    "backToMenuBtnResults",
    "backToMenuBtnHistory",
    "coachBackBtn"
  ];
  ids.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.onclick = function (e) {
        e.preventDefault();
        currentSession = {};
        arrowScores = [];
        currentEndNumber = 1;
        showScreen("menuScreen");
      };
    }
  });
}

// Show session results
function showSessionResults(session) {
  showScreen("sessionResults");

  const summary = document.getElementById("sessionSummary");
  if (!summary) return;

  const dateStr = session.date && session.date.seconds
    ? new Date(session.date.seconds * 1000).toLocaleString()
    : 'N/A';

  summary.innerHTML = `
    <h2>Session Results</h2>
    <p><strong>Date:</strong> ${dateStr}</p>
    <p><strong>Bow:</strong> ${session.bowStyle}</p>
    <p><strong>Distance:</strong> ${session.distance}m</p>
    <p><strong>Target Face:</strong> ${session.targetFace}</p>
    <p><strong>Total Score:</strong> ${session.totalScore} / ${session.arrowsPerEnd * 10 * session.endsCount}</p>
    <button id="backToMenuBtnResults">Back to Menu</button>
  `;

  // Build and show table
  const tableContainer = document.getElementById("sessionResultsTable");
  tableContainer.innerHTML = '';

  const table = document.createElement("table");
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const cols = ['End'];
  for (let i = 1; i <= session.arrowsPerEnd; i++) cols.push(`Arrow ${i}`);
  cols.push('Total');
  cols.forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    th.style.border = '1px solid #ccc';
    th.style.padding = '8px';
    th.style.backgroundColor = '#394a79';
    th.style.color = 'white';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');

  session.ends.forEach((end, i) => {
    const row = document.createElement('tr');
    row.style.border = '1px solid #ccc';
    row.style.color = 'white';

    const endCell = document.createElement('td');
    endCell.textContent = i + 1;
    endCell.style.border = '1px solid #ccc';
    endCell.style.padding = '8px';
    row.appendChild(endCell);

    const arrows = end.arrows || end;
    for (let j = 0; j < session.arrowsPerEnd; j++) {
      const td = document.createElement('td');
      td.textContent = arrows[j]?.score ?? arrows[j] ?? '';
      td.style.border = '1px solid #ccc';
      td.style.padding = '8px';
      row.appendChild(td);
    }
    const total = arrows.reduce((sum, val) => sum + ((val?.score) ?? val ?? 0), 0);
    const totalCell = document.createElement('td');
    totalCell.textContent = total;
    totalCell.style.border = '1px solid #ccc';
    totalCell.style.padding = '8px';
    row.appendChild(totalCell);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  tableContainer.appendChild(table);

  // Horizontal bar chart
  let chartCanvas = document.getElementById("sessionChart");
  if (!chartCanvas) {
    chartCanvas = document.createElement("canvas");
    chartCanvas.id = "sessionChart";
    chartCanvas.style.width = '100%';
    chartCanvas.style.height = '300px';
    tableContainer.parentElement.appendChild(chartCanvas);
  }

  const ctx = chartCanvas.getContext('2d');
  if (window.sessionChartInstance) window.sessionChartInstance.destroy();

  const points = session.ends.map(end => (end.arrows ?? end)
    .reduce((sum, val) => sum + (val.score ?? val ?? 0), 0));

  window.sessionChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: points.map((_, i) => `End ${i + 1}`),
      datasets: [{
        label: 'Points per End',
        data: points,
        backgroundColor: 'rgba(59,130,246,0.75)',
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      scales: {
        x: { beginAtZero: true, max: session.arrowsPerEnd * 10 },
        y: {}
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      }
    }
  });

  // Dispersion plot
  let dispersionCanvas = document.getElementById("dispersionCanvas");
  if (!dispersionCanvas) {
    dispersionCanvas = document.createElement('canvas');
    dispersionCanvas.id = 'dispersionCanvas';
    dispersionCanvas.width = 400;
    dispersionCanvas.height = 400;
    dispersionCanvas.style.marginTop = '20px';
    dispersionCanvas.style.display = 'block';
    tableContainer.parentElement.appendChild(dispersionCanvas);
  }
  const dctx = dispersionCanvas.getContext('2d');

  dctx.clearRect(0, 0, dispersionCanvas.width, dispersionCanvas.height);
  drawTarget(dispersionCanvas);

  let arrows = [];
  session.ends.forEach(end => {
    (end.arrows ?? end).forEach(arrow => {
      if (arrow && typeof arrow === 'object' && 'x' in arrow && 'y' in arrow)
        arrows.push(arrow);
    });
  });

  dctx.fillStyle = "lime";
  dctx.strokeStyle = "#222";
  dctx.lineWidth = 2;

  arrows.forEach(({x, y}) => {
    dctx.beginPath();
    dctx.arc(x, y, 5, 0, 2 * Math.PI);
    dctx.fill();
    dctx.stroke();
  });

  // Attach back button handler after rendering
  attachBackButtonHandlers();
}

// Layout/UIs binders and entry point
function setupUI() {
  document.getElementById("signupBtn")?.addEventListener("click", signup);
  document.getElementById("loginBtn")?.addEventListener("click", login);
  document.getElementById("menuLogout")?.addEventListener("click", () => signOut(auth).then(() => showScreen("loginPage")));
  document.getElementById("startSession")?.addEventListener("click", startSession);
  document.getElementById("undoBtn")?.addEventListener("click", undoLast);
  document.getElementById("nextEnd")?.addEventListener("click", nextEnd);
  document.getElementById("endSession")?.addEventListener("click", endSession);
  document.getElementById("menuHistory")?.addEventListener("click", () => showScreen("history"));
  
  let c = document.getElementById("target");
  if (c) {
    c.addEventListener("click", handleScoreClick);
    c.addEventListener("touchstart", e => { e.preventDefault(); handleScoreClick(e); });
  }
  
  attachBackButtonHandlers();
}

// Firebase auth state management
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    currentUserRole = null;
    showScreen("loginPage");
    return;
  }
  currentUser = user;
  try {
    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (!docSnap.exists()) {
      showScreen("loginPage");
      return;
    }
    const userData = docSnap.data();
    currentUserRole = userData.role || "archer";

    const greeting = document.getElementById("greeting");
    if (greeting) greeting.textContent = `Hello, ${userData.name} (${capitalize(currentUserRole)})`;

    showScreen("menuScreen");
    if (currentUserRole === "archer") {
      const startBtn = document.getElementById("startSession");
      if (startBtn) startBtn.style.display = 'inline-block';
    }
  } catch (err) {
    console.error(err);
    showScreen("loginPage");
  }
});

// Initialization
window.addEventListener("DOMContentLoaded", () => {
  setupUI();
  updateSetupOptions();
  drawTarget();
  updateScoreUI();
  updateButtons();

  if (typeof Chart === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    document.head.appendChild(script);
  }
  attachBackToMenuHandlers(); 
});
