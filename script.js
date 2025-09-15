import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
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
  Timestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Firebase Config & Init
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
let currentUserRole = null;
let currentSession = {};
let arrowScores = [];
let currentEndNumber = 1;

const canvas = document.getElementById("target");
const ctx = canvas?.getContext("2d");

// Show screen helper
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  if (id === "scoringArea") drawTarget();
  if (id === "setup") updateSessionSetupOptions();
}

// Draw outdoor archery target
function drawTarget() {
  if (!ctx) return;
  const radius = canvas.width / 2;
  const rings = [
    { color: "#FFFFFF", radius: radius }, // 1-2 White
    { color: "#000000", radius: radius * 0.8 }, // 3-4 Black
    { color: "#0000FF", radius: radius * 0.6 }, // 5-6 Blue
    { color: "#FF0000", radius: radius * 0.4 }, // 7-8 Red
    { color: "#FFFF00", radius: radius * 0.2 }, // 9-10 Yellow
  ];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  rings.forEach((ring) => {
    ctx.beginPath();
    ctx.arc(radius, radius, ring.radius, 0, 2 * Math.PI);
    ctx.fillStyle = ring.color;
    ctx.fill();
  });
}

// Update end arrow scores display
function updateEndScores() {
  const endScoresDiv = document.getElementById("endScores");
  const endTotalDiv = document.getElementById("endTotal");

  if (endScoresDiv) {
    endScoresDiv.innerText = arrowScores
      .map((a) => (typeof a === "object" ? a.score : a))
      .join(" | ");
  }

  if (endTotalDiv) {
    const numeric = arrowScores
      .map((a) => (typeof a === "object" ? a.score : a))
      .filter((s) => typeof s === "number")
      .reduce((a, b) => a + b, 0);
    endTotalDiv.innerText = "End Total: " + numeric;
  }
}

// Update Next/End buttons visibility
function updateEndSessionButtons() {
  const nextBtn = document.getElementById("nextEndBtn");
  const endBtn = document.getElementById("endSessionBtn");
  const lastEnd = currentEndNumber === currentSession.endsCount;
  const arrowsComplete = arrowScores.length === currentSession.arrowsPerEnd;

  if (!lastEnd && arrowsComplete) {
    nextBtn.style.display = "inline-block";
    endBtn.style.display = "none";
  } else if (lastEnd && arrowsComplete) {
    nextBtn.style.display = "none";
    endBtn.style.display = "inline-block";
  } else {
    nextBtn.style.display = "none";
    endBtn.style.display = "none";
  }
}

// Handle canvas click to calculate score
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

  let score = "M";

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
  else score = "M";

  arrowScores.push({ score, x, y });
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

  const bowSelect = document.getElementById("bowStyle");
  const distSelect = document.getElementById("distance");
  const faceSelect = document.getElementById("targetFace");

  // Populate bow styles once
  if (bowSelect.options.length === 0) {
    Object.keys(bowDistances).forEach((bow) => {
      const opt = document.createElement("option");
      opt.value = bow;
      opt.textContent = bow;
      bowSelect.appendChild(opt);
    });
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
    updateTargetFaces();
  }

  function updateTargetFaces() {
    faceSelect.innerHTML = "";
    const selectedBow = bowSelect.value;
    const distance = parseInt(distSelect.value);
    let faces = [];
    if (distance <= 18) {
      faces = selectedBow === "Compound" ? bowTargetFaces.Compound : bowTargetFaces.indoorOnly;
    } else {
      faces = selectedBow === "Compound"
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
  distSelect.onchange = updateTargetFaces;

  updateDistances();
}

// Start session processing
function startSession() {
  if (currentUserRole !== "archer") {
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
    totalScore: 0,
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
function undoLastArrow() {
  arrowScores.pop();
  updateEndScores();
  updateEndSessionButtons();
}

// Next end processing
async function nextEnd() {
  if (arrowScores.length !== currentSession.arrowsPerEnd) {
    alert("Please score all arrows!");
    return;
  }
  currentSession.ends.push([...arrowScores]);

  currentSession.totalScore += arrowScores
    .map((s) => (typeof s === "object" ? s.score : s))
    .filter((s) => typeof s === "number")
    .reduce((a, b) => a + b, 0);

  arrowScores = [];

  updateEndScores();
  updateEndSessionButtons();

  if (currentEndNumber === currentSession.endsCount) {
    return;
  }

  currentEndNumber++;
  document.getElementById("currentEnd").innerText = currentEndNumber;
}

// Save session to Firestore
async function saveSession() {
  if (!currentUser) return;

  const endsObjects = currentSession.ends.map((endArr) => ({ arrows: endArr }));
  const sessionKey = Date.now().toString();

  const newSession = {
    bowStyle: currentSession.bowStyle,
    distance: currentSession.distance,
    targetFace: currentSession.targetFace,
    arrowsPerEnd: currentSession.arrowsPerEnd,
    endsCount: currentSession.endsCount,
    ends: endsObjects,
    totalScore: currentSession.totalScore,
    date: Timestamp.now(),
  };

  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      [`sessions.${sessionKey}`]: newSession,
    });
  } catch (e) {
    console.error("Failed to save session:", e);
  }
}

// End session and save all data once complete
async function endSession() {
  if (arrowScores.length > 0 && arrowScores.length !== currentSession.arrowsPerEnd) {
    alert(`Please score all arrows in End ${currentEndNumber} before ending session.`);
    return;
  }
  if (arrowScores.length === currentSession.arrowsPerEnd) {
    currentSession.ends.push([...arrowScores]);
    currentSession.totalScore += arrowScores
      .map((s) => (typeof s === "object" ? s.score : s))
      .filter((s) => typeof s === "number")
      .reduce((a, b) => a + b, 0);
    arrowScores = [];
  }

  if (currentSession.ends.length > 0) {
    await saveSession();
    showSessionResults(currentSession);
  }
}

// Show session results with table and chart
function showSessionResults(session) {
  showScreen("sessionResultsScreen");
  let dateStr = "N/A";
  if (session.date) {
    if (session.date.seconds) {
      dateStr = new Date(session.date.seconds * 1000).toLocaleString();
    } else if (session.date instanceof Date) {
      dateStr = session.date.toLocaleString();
    } else if (typeof session.date === "string") {
      dateStr = session.date;
    }
  }

  document.getElementById("sessionResultsSummary").innerHTML = `
    <strong>Score:</strong> ${session.totalScore} / ${
    session.endsCount * session.arrowsPerEnd * 10
  }<br>
    <strong>Date:</strong> ${dateStr}<br>
    <strong>Bow:</strong> ${session.bowStyle} | <strong>Distance:</strong> ${session.distance}m<br>
    <strong>Target Face:</strong> ${session.targetFace}
  `;

  const tableDiv = document.getElementById("sessionResultsTable");
  tableDiv.innerHTML = "";

  if (!session.ends || session.ends.length === 0) {
    tableDiv.innerHTML = "<p>No session data available.</p>";
    return;
  }

  let table = "<table border='1' style='width:100%; border-collapse: collapse;'>";
  table += "<thead><tr><th>End</th>";
  for (let i = 1; i <= (session.arrowsPerEnd || 0); i++) {
    table += `<th>Arrow ${i}</th>`;
  }
  table += "<th>Total</th></tr></thead><tbody>";

  session.ends.forEach((end, idx) => {
    const scores = Array.isArray(end.arrows) ? end.arrows : end;
    const total = scores
      .map((s) => (typeof s === "object" && s.score !== undefined ? s.score : s))
      .filter((s) => typeof s === "number")
      .reduce((acc, val) => acc + val, 0);

    table += `<tr><td>${idx + 1}</td>`;
    scores.forEach((scoreItem) => {
      const val =
        typeof scoreItem === "object" && scoreItem.score !== undefined ? scoreItem.score : scoreItem;
      table += `<td>${val}</td>`;
    });
    table += `<td>${total}</td></tr>`;
  });

  table += "</tbody></table>";

  tableDiv.innerHTML = table;

  // Chart.js graph rendering for session results
  const chartCanvas = document.getElementById("sessionResultChart");
  const ctx = chartCanvas.getContext("2d");

  ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);

  if (window.sessionChartInstance) {
    window.sessionChartInstance.destroy();
  }

  const endTotals = session.ends.map((end) =>
    (end.arrows || []).filter((s) => typeof s === "number").reduce((a, b) => a + b, 0),
  );

  window.sessionChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: session.ends.map((_, i) => `End ${i + 1}`),
      datasets: [
        {
          label: "Points per End",
          data: endTotals,
          fill: false,
          borderColor: "rgba(59, 130, 246, 0.7)",
          backgroundColor: "rgba(59, 130, 246, 0.7)",
          tension: 0.3,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `Session Total Score: ${session.totalScore}`,
          font: { size: 16, weight: "bold" },
        },
        legend: { display: true },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: session.arrowsPerEnd * 10,
          title: { display: true, text: "Points" },
        },
        x: {
          title: { display: true, text: "End Number" },
        },
      },
    },
  });

  // Draw target rings for last end
  const targetCanvas = document.getElementById("sessionResultsTarget");
  const targetCtx = targetCanvas.getContext("2d");
  const radius = targetCanvas.width / 2;
  const rings = [
    { color: "#FFFFFF", r: radius },
    { color: "#000000", r: radius * 0.8 },
    { color: "#0000FF", r: radius * 0.6 },
    { color: "#FF0000", r: radius * 0.4 },
    { color: "#FFFF00", r: radius * 0.2 },
  ];
  targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  rings.forEach((rg) => {
    targetCtx.beginPath();
    targetCtx.arc(radius, radius, rg.r, 0, 2 * Math.PI);
    targetCtx.fillStyle = rg.color;
    targetCtx.fill();
  });

  const lastEnd = session.ends[session.ends.length - 1];
  if (lastEnd && lastEnd.length) {
    lastEnd.forEach((arrow) => {
      if (typeof arrow === "object" && arrow.x !== undefined && arrow.y !== undefined) {
        targetCtx.beginPath();
        targetCtx.arc(arrow.x, arrow.y, 7, 0, 2 * Math.PI);
        targetCtx.fillStyle = "lime";
        targetCtx.fill();
        targetCtx.strokeStyle = "#222";
        targetCtx.lineWidth = 2;
        targetCtx.stroke();
      }
    });
  }
}

// Attach a button to return to menu and clear session state
document.getElementById("backToMenuBtn").addEventListener("click", () => {
  currentSession = {};
  arrowScores = [];
  currentEndNumber = 1;
  showScreen("menuScreen");
});

// View history for current user
async function viewHistory() {
  if (!currentUser) return;
  const userDoc = await getDoc(doc(db, "users", currentUser.uid));
  if (!userDoc.exists()) return;
  const sessionsObject = userDoc.data().sessions || {};
  const sessionsArr = Object.values(sessionsObject);
  const container = document.getElementById("historyTable");
  container.innerHTML = "";
  let table = document.createElement("table");
  table.innerHTML = "<tr><th>Date</th><th>Total Score</th><th>Ends</th></tr>";
  sessionsArr.forEach((session, index) => {
    const date = session.date
      ? new Date(session.date.seconds * 1000).toLocaleDateString()
      : "N/A";
    const row = document.createElement("tr");
    row.style.cursor = "pointer";
    row.innerHTML = `<td>${date}</td><td>${session.totalScore}</td><td>${session.ends.length}</td>`;
    row.addEventListener("click", () => {
      showSessionResults(session);
    });
    table.appendChild(row);
  });
  container.appendChild(table);
  showScreen("historyScreen");
}

// Attach all button handlers for UI controls
function attachButtonHandlers() {
  document.getElementById("signupBtn")?.addEventListener("click", signup);
  document.getElementById("loginBtn")?.addEventListener("click", login);
  document.getElementById("menuStartBtn")?.addEventListener("click", () =>
    showScreen("setup")
  );
  document.getElementById("menuHistoryBtn")?.addEventListener("click", viewHistory);
  document.getElementById("menuLogoutBtn")?.addEventListener("click", () =>
    signOut(auth).then(() => showScreen("loginPage"))
  );
  document.getElementById("menuToggleBtn")?.addEventListener("click", () =>
    alert("Theme toggle not implemented")
  );
  document.getElementById("startSessionBtn")?.addEventListener("click", startSession);
  document.getElementById("viewHistoryBtn")?.addEventListener("click", viewHistory);
  document.getElementById("logoutBtn")?.addEventListener("click", () =>
    signOut(auth).then(() => showScreen("loginPage"))
  );
  document.getElementById("undoBtn")?.addEventListener("click", undoLastArrow);
  document.getElementById("nextEndBtn")?.addEventListener("click", nextEnd);
  document.getElementById("endSessionBtn")?.addEventListener("click", endSession);
  document.getElementById("backToSetupBtn")?.addEventListener("click", () => {
    arrowScores = [];
    currentSession = {};
    currentEndNumber = 1;
    showScreen("setup");
    drawTarget();
    updateEndScores();
    updateEndSessionButtons();
  });
  if (canvas) {
    canvas.addEventListener("click", handleCanvasScoreClick);
  }
}

// Auth state changes - update UI accordingly and show coach dashboard or menu
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    currentUserRole = null;
    showScreen("loginPage");
    return;
  }
  currentUser = user;
  const userDoc = await getDoc(doc(db, "users", user.uid));
  if (!userDoc.exists()) {
    showScreen("loginPage");
    return;
  }
  const data = userDoc.data();
  currentUserRole = data.role || "archer";
  document.getElementById("greeting").innerText = `Hello, ${data.name} (${
    currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1)
  })!`;

  if (currentUserRole === "coach") {
    document.getElementById("startSessionBtn").style.display = "none";
    const coachBtn = document.getElementById("menuCoachBtn");
    if (!coachBtn) {
      const menu = document.getElementById("menuScreen");
      const btn = document.createElement("button");
      btn.id = "menuCoachBtn";
      btn.textContent = "Coach Dashboard";
      btn.style.marginTop = "10px";
      btn.addEventListener("click", showCoachDashboard);
      menu.appendChild(btn);
    } else {
      coachBtn.style.display = "inline-block";
    }
    showScreen("coachDashboard");
    loadArchersList();
  } else {
    document.getElementById("startSessionBtn").style.display = "inline-block";
    const coachBtn = document.getElementById("menuCoachBtn");
    if (coachBtn) coachBtn.style.display = "none";
    showScreen("menuScreen");
  }
});

// Coach dashboard implementation
let selectedArcherUID = null;
let selectedArcherName = null;

async function loadArchersList() {
  const archerList = document.getElementById("archerList");
  archerList.innerHTML = "";
  const q = query(collection(db, "users"), where("role", "==", "archer"));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    archerList.innerHTML = "<li>No archers found.</li>";
    return;
  }
  snapshot.forEach((docSnap) => {
    const archer = docSnap.data();
    const li = document.createElement("li");
    li.textContent = archer.name;
    li.style.cursor = "pointer";
    li.onclick = () => loadArcherSessions(docSnap.id, archer.name);
    archerList.appendChild(li);
  });
}

async function loadArcherSessions(archerUID, archerName) {
  selectedArcherUID = archerUID;
  selectedArcherName = archerName;
  document.getElementById("selectedArcherName").innerText = archerName;
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
    const date = sessionData.date
      ? new Date(sessionData.date.seconds * 1000).toLocaleString()
      : "No date";
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
