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

// NOTE: canvas and ctx may be null if script runs before DOM; we re-query later if needed
let canvas = document.getElementById("target");
let ctx = canvas?.getContext("2d");

// Show screen helper
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  if (id === "scoringArea") {
    // ensure we have fresh canvas context
    canvas = document.getElementById("target");
    ctx = canvas?.getContext("2d");
    drawTarget();
  }
  if (id === "setup") updateSessionSetupOptions();
}

// Draw outdoor archery target
function drawTarget(targetElem) {
  // Accept optional canvas element; default to global canvas
  const c = targetElem || canvas || document.getElementById("target");
  if (!c) return;
  const cctx = c.getContext("2d");
  if (!cctx) return;

  const radius = c.width / 2;
  const rings = [
    { color: "#FFFFFF", radius: radius }, // outer white
    { color: "#000000", radius: radius * 0.8 }, // black
    { color: "#0000FF", radius: radius * 0.6 }, // blue
    { color: "#FF0000", radius: radius * 0.4 }, // red
    { color: "#FFFF00", radius: radius * 0.2 }, // yellow (center)
  ];
  cctx.clearRect(0, 0, c.width, c.height);
  rings.forEach((ring) => {
    cctx.beginPath();
    cctx.arc(radius, radius, ring.radius, 0, 2 * Math.PI);
    cctx.fillStyle = ring.color;
    cctx.fill();
  });
}

// Update end arrow scores display
function updateEndScores() {
  const endScoresDiv = document.getElementById("endScores");
  const endTotalDiv = document.getElementById("endTotal");

  if (endScoresDiv) {
    endScoresDiv.innerText = arrowScores
      .map((a) => (typeof a === "object" && a.score !== undefined ? a.score : a))
      .join(" | ");
  }

  if (endTotalDiv) {
    const numeric = arrowScores
      .map((a) => (typeof a === "object" && a.score !== undefined ? a.score : a))
      .filter((s) => typeof s === "number")
      .reduce((acc, val) => acc + val, 0);
    endTotalDiv.innerText = "End Total: " + numeric;
  }
}

// Update Next/End buttons visibility
function updateEndSessionButtons() {
  const nextBtn = document.getElementById("nextEndBtn");
  const endBtn = document.getElementById("endSessionBtn");
  if (!currentSession || !currentSession.endsCount || !currentSession.arrowsPerEnd) {
    if (nextBtn) nextBtn.style.display = "none";
    if (endBtn) endBtn.style.display = "none";
    return;
  }
  const lastEnd = currentEndNumber === currentSession.endsCount;
  const arrowsComplete = arrowScores.length === currentSession.arrowsPerEnd;

  if (!lastEnd && arrowsComplete) {
    if (nextBtn) nextBtn.style.display = "inline-block";
    if (endBtn) endBtn.style.display = "none";
  } else if (lastEnd && arrowsComplete) {
    if (nextBtn) nextBtn.style.display = "none";
    if (endBtn) endBtn.style.display = "inline-block";
  } else {
    if (nextBtn) nextBtn.style.display = "none";
    if (endBtn) endBtn.style.display = "none";
  }
}

// Handle canvas click to calculate score
function handleCanvasScoreClick(e) {
  // make sure currentSession exists and arrowsPerEnd defined
  if (!currentSession || !currentSession.arrowsPerEnd) return;
  if (arrowScores.length >= currentSession.arrowsPerEnd) {
    alert("All arrows scored");
    return;
  }

  const c = canvas || document.getElementById("target");
  if (!c) return;

  const rect = c.getBoundingClientRect();
  // Support both mouse and touch event (touch uses touches array)
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const centerX = c.width / 2;
  const centerY = c.height / 2;
  const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
  const maxRadius = c.width / 2;
  const ringWidth = maxRadius / 10;

  let score = "M";

  // Score mapping - tighter rings towards center
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
  const usernameEl = document.getElementById("username");
  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const roleEl = document.getElementById("role");
  const msgDiv = document.getElementById("loginMessage");

  const username = usernameEl ? usernameEl.value.trim() : "";
  const email = emailEl ? emailEl.value.trim() : "";
  const password = passwordEl ? passwordEl.value : "";
  const role = roleEl ? roleEl.value : "archer";

  if (msgDiv) msgDiv.innerText = "";
  if (!username || !email || !password) {
    if (msgDiv) msgDiv.innerText = "Please fill all fields!";
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
    if (msgDiv) msgDiv.innerText = "Signup successful! Please login.";
    showScreen("loginPage");
  } catch (e) {
    if (msgDiv) msgDiv.innerText = e.message || "Signup failed";
  }
}

// Login handler
async function login() {
  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const msgDiv = document.getElementById("loginMessage");

  const email = emailEl ? emailEl.value.trim() : "";
  const password = passwordEl ? passwordEl.value : "";

  if (msgDiv) msgDiv.innerText = "";
  if (!email || !password) {
    if (msgDiv) msgDiv.innerText = "Please enter email and password!";
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    if (msgDiv) msgDiv.innerText = e.message || "Login failed";
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

  if (!bowSelect || !distSelect || !faceSelect) return;

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
    const distances = bowDistances[selectedBow] || [];
    distances.forEach((d) => {
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
    const distance = parseInt(distSelect.value) || 0;
    let faces = [];
    if (distance <= 18) {
      faces = selectedBow === "Compound" ? bowTargetFaces.Compound : bowTargetFaces.indoorOnly;
    } else {
      faces =
        selectedBow === "Compound"
          ? bowTargetFaces.Compound
          : (bowTargetFaces.outdoorOnly || []).concat(bowTargetFaces.indoorOnly || []);
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

  const bowStyleEl = document.getElementById("bowStyle");
  const distanceEl = document.getElementById("distance");
  const targetFaceEl = document.getElementById("targetFace");
  const arrowsPerEndEl = document.getElementById("arrowsPerEnd");
  const endsCountEl = document.getElementById("endsCount");

  if (!bowStyleEl || !distanceEl || !targetFaceEl || !arrowsPerEndEl || !endsCountEl) {
    alert("Missing session setup fields.");
    return;
  }

  currentSession = {
    bowStyle: bowStyleEl.value,
    distance: parseInt(distanceEl.value) || 0,
    targetFace: targetFaceEl.value,
    arrowsPerEnd: parseInt(arrowsPerEndEl.value) || 6,
    endsCount: parseInt(endsCountEl.value) || 6,
    ends: [],
    totalScore: 0,
  };

  arrowScores = [];
  currentEndNumber = 1;
  const currentEndEl = document.getElementById("currentEnd");
  if (currentEndEl) currentEndEl.innerText = currentEndNumber;

  showScreen("scoringArea");
  drawTarget();
  updateEndScores();
  updateEndSessionButtons();
}

// Undo last arrow
function undoLastArrow() {
  if (arrowScores.length === 0) return;
  arrowScores.pop();
  updateEndScores();
  updateEndSessionButtons();
}

// Next end processing
async function nextEnd() {
  if (!currentSession || !currentSession.arrowsPerEnd) return;
  if (arrowScores.length !== currentSession.arrowsPerEnd) {
    alert("Please score all arrows!");
    return;
  }

  // store a copy of the arrows for this end
  currentSession.ends.push([...arrowScores]);

  // accumulate numeric total for this end
  const endTotal = arrowScores
    .map((s) => (typeof s === "object" && s.score !== undefined ? s.score : s))
    .filter((s) => typeof s === "number")
    .reduce((a, b) => a + b, 0);

  currentSession.totalScore = (currentSession.totalScore || 0) + endTotal;

  arrowScores = [];

  updateEndScores();
  updateEndSessionButtons();

  if (currentEndNumber === currentSession.endsCount) {
    // already last end
    return;
  }

  currentEndNumber++;
  const currentEndEl = document.getElementById("currentEnd");
  if (currentEndEl) currentEndEl.innerText = currentEndNumber;
}

// Save session to Firestore
async function saveSession() {
  if (!currentUser) return;

  // Ensure ends saved as objects with arrows array
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
  if (!currentSession || !currentSession.arrowsPerEnd) return;

  if (arrowScores.length > 0 && arrowScores.length !== currentSession.arrowsPerEnd) {
    alert(`Please score all arrows in End ${currentEndNumber} before ending session.`);
    return;
  }
  if (arrowScores.length === currentSession.arrowsPerEnd) {
    currentSession.ends.push([...arrowScores]);
    const endTotal = arrowScores
      .map((s) => (typeof s === "object" && s.score !== undefined ? s.score : s))
      .filter((s) => typeof s === "number")
      .reduce((a, b) => a + b, 0);
    currentSession.totalScore = (currentSession.totalScore || 0) + endTotal;
    arrowScores = [];
  }

  if (currentSession.ends.length > 0) {
    await saveSession();
    showSessionResults(currentSession);
  }
}

// Show session results with table and chart
// Show session results with detailed table and Chart.js line graph
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

  // Build results table using DOM methods
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.border = "1";

  // Table Header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const thEnd = document.createElement("th");
  thEnd.textContent = "End";
  headerRow.appendChild(thEnd);

  for (let i = 1; i <= (session.arrowsPerEnd || 0); i++) {
    const th = document.createElement("th");
    th.textContent = `Arrow ${i}`;
    th.style.backgroundColor = "#415a8c"; // consistent styling as in screenshot
    th.style.color = "white";
    th.style.padding = "6px";
    headerRow.appendChild(th);
  }

  const thTotal = document.createElement("th");
  thTotal.textContent = "Total";
  thTotal.style.backgroundColor = "#415a8c";
  thTotal.style.color = "white";
  thTotal.style.padding = "6px";
  headerRow.appendChild(thTotal);

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Table Body
  const tbody = document.createElement("tbody");

  session.ends.forEach((end, idx) => {
    const scores = Array.isArray(end.arrows) ? end.arrows : end;
    const total = scores
      .map(s => (typeof s === "object" && s.score !== undefined ? s.score : s))
      .filter(s => typeof s === "number")
      .reduce((acc, val) => acc + val, 0);

    const row = document.createElement("tr");

    const endCell = document.createElement("td");
    endCell.textContent = (idx + 1).toString();
    endCell.style.padding = "6px";
    row.appendChild(endCell);

    scores.forEach(scoreItem => {
      const val = typeof scoreItem === "object" && scoreItem.score !== undefined ? scoreItem.score : scoreItem;
      const td = document.createElement("td");
      td.textContent = val;
      td.style.padding = "6px";
      row.appendChild(td);
    });

    const totalCell = document.createElement("td");
    totalCell.textContent = total;
    totalCell.style.padding = "6px";
    row.appendChild(totalCell);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  tableDiv.appendChild(table);

  // Chart.js line graph of end totals
  const chartCanvas = document.getElementById("sessionResultsTrendChart");
  if (!chartCanvas) return;

  const ctxChart = chartCanvas.getContext("2d");
  if (!ctxChart) return;

  if (window.sessionChartInstance) {
    window.sessionChartInstance.destroy();
  }

  const endTotals = session.ends.map(end => {
    const scores = Array.isArray(end.arrows) ? end.arrows : end;
    return scores
      .map(s => (typeof s === "object" ? s.score : s))
      .filter(s => typeof s === "number")
      .reduce((a, b) => a + b, 0);
  });

  // Explicitly set canvas size for stable rendering
  chartCanvas.width = 400;
  chartCanvas.height = 200;

  window.sessionChartInstance = new Chart(ctxChart, {
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
          font: { size: 18 },
        },
        legend: { display: true },
        tooltip: { enabled: true },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: session.arrowsPerEnd * 10,
          ticks: {
            stepSize: 1,
          },
        },
      },
    },
  });
}

  // Draw target rings for last end (use sessionResultsTarget canvas if present)
  const targetCanvas = document.getElementById("sessionResultsTarget");
  if (targetCanvas) {
    const targetCtx = targetCanvas.getContext("2d");
    if (targetCtx) {
      drawTarget(targetCanvas);
      const lastEndObj = endsArr[endsArr.length - 1];
      const lastEnd = Array.isArray(lastEndObj) ? lastEndObj : Array.isArray(lastEndObj?.arrows) ? lastEndObj.arrows : [];
      lastEnd.forEach((arrow) => {
        const ax = typeof arrow === "object" && arrow.x !== undefined ? arrow.x : null;
        const ay = typeof arrow === "object" && arrow.y !== undefined ? arrow.y : null;
        if (ax !== null && ay !== null) {
          targetCtx.beginPath();
          targetCtx.arc(ax, ay, 7, 0, 2 * Math.PI);
          targetCtx.fillStyle = "lime";
          targetCtx.fill();
          targetCtx.strokeStyle = "#222";
          targetCtx.lineWidth = 2;
          targetCtx.stroke();
        }
      });
    }
  }


// Attach a button to return to menu and clear session state for all matching back buttons (handles duplicates)
function attachBackToMenuHandlers() {
  // select elements that might be used as back-to-menu (support duplicates or various ids)
  const selectors = ['#backToMenuBtn', '#backToMenuBtnResults', '#backToMenuBtnHistory'];
  selectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((btn) => {
      btn.addEventListener("click", () => {
        currentSession = {};
        arrowScores = [];
        currentEndNumber = 1;
        showScreen("menuScreen");
      });
    });
  });
}

// View history for current user
async function viewHistory() {
  if (!currentUser) return;
  const userDocRef = doc(db, "users", currentUser.uid);
  const userDoc = await getDoc(userDocRef);
  if (!userDoc.exists()) return;
  const sessionsObject = userDoc.data().sessions || {};
  const sessionsArr = Object.values(sessionsObject);
  const container = document.getElementById("historyTable");
  if (!container) return;
  container.innerHTML = "";
  let table = document.createElement("table");
  table.innerHTML = "<tr><th>Date</th><th>Total Score</th><th>Ends</th></tr>";
  sessionsArr.forEach((session, index) => {
    const date = session.date
      ? session.date.seconds
        ? new Date(session.date.seconds * 1000).toLocaleDateString()
        : session.date instanceof Date
        ? session.date.toLocaleDateString()
        : String(session.date)
      : "N/A";
    const row = document.createElement("tr");
    row.style.cursor = "pointer";
    row.innerHTML = `<td>${date}</td><td>${session.totalScore}</td><td>${(session.ends || []).length}</td>`;
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
  document.getElementById("menuStartBtn")?.addEventListener("click", () => showScreen("setup"));
  document.getElementById("menuHistoryBtn")?.addEventListener("click", viewHistory);
  document.getElementById("menuLogoutBtn")?.addEventListener("click", () =>
    signOut(auth).then(() => showScreen("loginPage"))
  );

  // Theme toggle: implement a single consistent toggle (preserves selection in localStorage)
  const toggleBtn = document.getElementById("menuToggleBtn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const themes = ["", "light-theme", "redblack-theme"];
      const currentTheme = document.body.className || "";
      const idx = themes.indexOf(currentTheme);
      const nextIndex = (idx + 1) % themes.length;
      document.body.className = themes[nextIndex];
      localStorage.setItem("selectedTheme", themes[nextIndex]);
    });
  }

  document.getElementById("startSessionBtn")?.addEventListener("click", startSession);
  document.getElementById("viewHistoryBtn")?.addEventListener("click", viewHistory);
  document.getElementById("logoutBtn")?.addEventListener("click", () =>
    signOut(auth).then(() => showScreen("loginPage"))
  );
  document.getElementById("undoBtn")?.addEventListener("click", undoLastArrow);
  document.getElementById("nextEndBtn")?.addEventListener("click", nextEnd);
  document.getElementById("endSessionBtn")?.addEventListener("click", endSession);

  // backToSetupBtn may or may not exist; guard it
  const backToSetup = document.getElementById("backToSetupBtn");
  if (backToSetup) {
    backToSetup.addEventListener("click", () => {
      arrowScores = [];
      currentSession = {};
      currentEndNumber = 1;
      showScreen("setup");
      drawTarget();
      updateEndScores();
      updateEndSessionButtons();
    });
  }

  // Canvas click handler (support touch as well)
  const c = document.getElementById("target");
  if (c) {
    c.addEventListener("click", handleCanvasScoreClick);
    c.addEventListener("touchstart", (ev) => {
      // prevent default to avoid scrolling while scoring
      ev.preventDefault();
      handleCanvasScoreClick(ev);
    });
  }

  // coach menu button might be added dynamically; attachBackToMenuHandlers separately
  attachBackToMenuHandlers();
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
  const greetingEl = document.getElementById("greeting");
  if (greetingEl) {
    greetingEl.innerText = `Hello, ${data.name} (${
      currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1)
    })!`;
  }

  if (currentUserRole === "coach") {
    const startBtn = document.getElementById("startSessionBtn");
    if (startBtn) startBtn.style.display = "none";
    const coachBtn = document.getElementById("menuCoachBtn");
    if (!coachBtn) {
      const menu = document.getElementById("menuScreen");
      if (menu) {
        const btn = document.createElement("button");
        btn.id = "menuCoachBtn";
        btn.textContent = "Coach Dashboard";
        btn.style.marginTop = "10px";
        btn.addEventListener("click", showCoachDashboard);
        menu.appendChild(btn);
      }
    } else {
      coachBtn.style.display = "inline-block";
    }
    showScreen("coachDashboard");
    loadArchersList();
  } else {
    const startBtn = document.getElementById("startSessionBtn");
    if (startBtn) startBtn.style.display = "inline-block";
    const coachBtn = document.getElementById("menuCoachBtn");
    if (coachBtn) coachBtn.style.display = "none";
    showScreen("menuScreen");
  }
});

// small helper to show coach dashboard (was referenced but missing)
function showCoachDashboard() {
  showScreen("coachDashboard");
}

// Coach dashboard implementation
let selectedArcherUID = null;
let selectedArcherName = null;

async function loadArchersList() {
  const archerList = document.getElementById("archerList");
  if (!archerList) return;
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
    li.textContent = archer.name || "Unnamed";
    li.style.cursor = "pointer";
    li.onclick = () => loadArcherSessions(docSnap.id, archer.name || "Archer");
    archerList.appendChild(li);
  });
}

async function loadArcherSessions(archerUID, archerName) {
  selectedArcherUID = archerUID;
  selectedArcherName = archerName;
  const selNameEl = document.getElementById("selectedArcherName");
  if (selNameEl) selNameEl.innerText = archerName;
  const sessionListDiv = document.getElementById("archerSessionList");
  if (!sessionListDiv) return;
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
      ? sessionData.date.seconds
        ? new Date(sessionData.date.seconds * 1000).toLocaleString()
        : sessionData.date instanceof Date
        ? sessionData.date.toLocaleString()
        : String(sessionData.date)
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

// Display detailed session result with table and Chart.js
async function displaySessionResult(sessionData) {
  const container = document.getElementById("sessionResultContainer");
  if (container) container.style.display = "block";

  const summaryDiv = document.getElementById("sessionResultSummary");
  const tableDiv = document.getElementById("sessionResultTable");
  const chartCanvas = document.getElementById("sessionResultChart");

  if (summaryDiv) {
    summaryDiv.innerHTML = `
      <p><strong>Bow Style:</strong> ${sessionData.bowStyle}</p>
      <p><strong>Distance:</strong> ${sessionData.distance}m</p>
      <p><strong>Target Face:</strong> ${sessionData.targetFace}</p>
      <p><strong>Total Score:</strong> ${sessionData.totalScore}</p>
      <p><strong>Ends:</strong> ${sessionData.ends.length}</p>
    `;
  }

  if (!tableDiv) return;
  tableDiv.innerHTML = "";

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";

  let headerRow = "<tr><th>End</th>";
  const arrowsCount = sessionData.arrowsPerEnd || (sessionData.ends[0]?.arrows?.length || 0);
  for (let i = 1; i <= arrowsCount; i++) {
    headerRow += `<th>Arrow ${i}</th>`;
  }
  headerRow += "<th>End Total</th></tr>";
  table.innerHTML = headerRow;

  (sessionData.ends || []).forEach((endObj, idx) => {
    const endArr = Array.isArray(endObj) ? endObj : Array.isArray(endObj.arrows) ? endObj.arrows : [];
    const processed = endArr.map((itm) => (typeof itm === "object" && itm.score !== undefined ? itm.score : itm));
    const endTotal = processed.filter((s) => typeof s === "number").reduce((a, b) => a + b, 0);
    let row = `<tr><td>${idx + 1}</td>`;
    for (let i = 0; i < arrowsCount; i++) {
      row += `<td>${processed[i] !== undefined ? processed[i] : ""}</td>`;
    }
    row += `<td>${endTotal}</td></tr>`;
    table.innerHTML += row;
  });

  tableDiv.appendChild(table);

  // Chart.js rendering fix: clear and destroy previous instance
  const ctxLocal = (chartCanvas && chartCanvas.getContext) ? chartCanvas.getContext("2d") : null;
  if (ctxLocal) {
    ctxLocal.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
  }
  if (window.sessionChartInstance) {
    try {
      window.sessionChartInstance.destroy();
    } catch (e) {}
    window.sessionChartInstance = null;
  }

  const endTotals = (sessionData.ends || []).map((end) => {
    const arr = Array.isArray(end) ? end : Array.isArray(end.arrows) ? end.arrows : [];
    const vals = arr.map((itm) => (typeof itm === "object" && itm.score !== undefined ? itm.score : itm));
    return vals.filter((v) => typeof v === "number").reduce((a, b) => a + b, 0);
  });

  if (ctxLocal) {
    try {
      window.sessionChartInstance = new Chart(ctxLocal, {
        type: "bar",
        data: {
          labels: (sessionData.ends || []).map((_, i) => `End ${i + 1}`),
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
    } catch (e) {
      console.error("Failed to render coach chart:", e);
    }
  }
}

// Initialization
window.addEventListener("DOMContentLoaded", () => {
  attachButtonHandlers();
  updateSessionSetupOptions();
  // ensure canvases drawn
  drawTarget();
  // ensure scoring UI shows current values
  updateEndScores();
  updateEndSessionButtons();

  // Apply saved theme if present
  const savedTheme = localStorage.getItem("selectedTheme") || "";
  const themes = ["", "light-theme", "redblack-theme"];
  if (themes.includes(savedTheme)) document.body.className = savedTheme;

  // Load Chart.js library dynamically if Chart not present
  if (typeof Chart === "undefined") {
    const chartScript = document.createElement("script");
    chartScript.src = "https://cdn.jsdelivr.net/npm/chart.js";
    document.head.appendChild(chartScript);
  }
});
