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

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAAc3sRW7WuQXbvlVKKdb8pFa3UOpidalM",
  authDomain: "my-scorer.firebaseapp.com",
  projectId: "my-scorer",
  storageBucket: "my-scorer.appspot.com",
  messagingSenderId: "243500946215",
  appId: "1:243500946215:web:bd976f1bd437edce684f02",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Globals
let currentUser = null;
let currentUserRole = null;
let currentSession = {};
let arrowScores = [];
let currentEndNumber = 1;

let canvas = document.getElementById("target");
let ctx = canvas?.getContext("2d");

// Show screen helper - toggles screen visibility by id
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

// Draw archery target rings on given or global canvas
function drawTarget(targetElem) {
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

// Update displayed arrow scores and total for current end
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

// Show/hide Next and End buttons based on session state
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

// Handle canvas click or tap to record arrow score
function handleCanvasScoreClick(e) {
  if (!currentSession || !currentSession.arrowsPerEnd) return;
  if (arrowScores.length >= currentSession.arrowsPerEnd) {
    alert("All arrows scored");
    return;
  }

  const c = canvas || document.getElementById("target");
  if (!c) return;

  const rect = c.getBoundingClientRect();
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

  arrowScores.push({ score, x, y });
  updateEndScores();
  updateEndSessionButtons();
}

// Signup new user with form inputs and Firebase Auth + Firestore
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

// User login with Firebase Auth
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

// Update session setup options dynamically based on bow choice and distance
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

// Start a new scoring session with setup data
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

// Undo last scored arrow
function undoLastArrow() {
  if (arrowScores.length === 0) return;
  arrowScores.pop();
  updateEndScores();
  updateEndSessionButtons();
}

// Complete current end and prepare for next
async function nextEnd() {
  if (!currentSession || !currentSession.arrowsPerEnd) return;
  if (arrowScores.length !== currentSession.arrowsPerEnd) {
    alert("Please score all arrows!");
    return;
  }

  currentSession.ends.push([...arrowScores]);

  const endTotal = arrowScores
    .map((s) => (typeof s === "object" && s.score !== undefined ? s.score : s))
    .filter((s) => typeof s === "number")
    .reduce((a, b) => a + b, 0);

  currentSession.totalScore = (currentSession.totalScore || 0) + endTotal;

  arrowScores = [];

  updateEndScores();
  updateEndSessionButtons();

  if (currentEndNumber === currentSession.endsCount) return;

  currentEndNumber++;
  const currentEndEl = document.getElementById("currentEnd");
  if (currentEndEl) currentEndEl.innerText = currentEndNumber;
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

// End session and save if arrows are fully scored
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

// Attach Back to Menu button handler and call on session results screen show
function attachBackToMenuHandler() {
  const backBtn = document.getElementById("backToMenuBtn");
  if (backBtn) {
    backBtn.onclick = (event) => {
      event.preventDefault();
      currentSession = {};
      arrowScores = [];
      currentEndNumber = 1;
      showScreen("menuScreen");
    };
  }
}

// Show session results: summary, table, horizontal bar chart, dispersion pattern
function showSessionResults(session) {
  showScreen("sessionResultsScreen");

  const maxPossible =
    (session.endsCount || session.ends.length || 0) * (session.arrowsPerEnd || 0) * 10;

  let dateTimeStr = "N/A";
  if (session.date) {
    let dtObj;
    if (session.date.seconds) {
      dtObj = new Date(session.date.seconds * 1000);
    } else if (session.date instanceof Date) {
      dtObj = session.date;
    } else if (typeof session.date === "string") {
      dtObj = new Date(session.date);
    }
    if (dtObj instanceof Date && !isNaN(dtObj)) {
      dateTimeStr = dtObj.toLocaleString();
    }
  }

  const summaryEl = document.getElementById("sessionResultsSummary");
  if (summaryEl) {
    summaryEl.innerHTML = `
      <h2>Session Results</h2>
      <p><b>Date & Time:</b> ${dateTimeStr}</p>
      <p><b>Bow:</b> ${session.bowStyle}</p>
      <p><b>Distance:</b> ${session.distance}m</p>
      <p><b>Target Face:</b> ${session.targetFace}</p>
      <p><b>Total Score:</b> ${session.totalScore} / ${maxPossible}</p>
      <button id="backToMenuBtn" type="button">Back to Menu</button>
    `;
  }

  // Build score table, horizontal bar chart, and dispersion pattern
  // --- SCORE TABLE ---
  const tableDiv = document.getElementById("sessionResultsTable");
  if (!tableDiv) return;
  tableDiv.innerHTML = "";

  const endsArr = Array.isArray(session.ends) ? session.ends : [];
  if (endsArr.length === 0) {
    tableDiv.innerHTML = "<p>No session data available.</p>";
    return;
  }

  const arrowsPerEnd = session.arrowsPerEnd || (endsArr[0]?.arrows?.length || 0);
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.tableLayout = "fixed";

  // Table header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["End", ...Array.from({ length: arrowsPerEnd }, (_, i) => `Arrow ${i + 1}`), "Total"].forEach(
    (text) => {
      const th = document.createElement("th");
      th.textContent = text;
      th.style.border = "1px solid #ccc";
      th.style.padding = "6px";
      th.style.backgroundColor = "#f0f0f0";
      th.style.textAlign = "center";
      headerRow.appendChild(th);
    }
  );
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Table body
  const tbody = document.createElement("tbody");
  endsArr.forEach((endObjOrArr, idx) => {
    const endArr = Array.isArray(endObjOrArr)
      ? endObjOrArr
      : Array.isArray(endObjOrArr.arrows)
      ? endObjOrArr.arrows
      : [];
    const processed = endArr.map((itm) =>
      typeof itm === "object" && itm.score !== undefined ? itm.score : itm
    );
    const total = processed.filter((v) => typeof v === "number").reduce((a, b) => a + b, 0);

    const tr = document.createElement("tr");
    tr.style.border = "1px solid #ddd";
    tr.style.textAlign = "center";

    const tdEnd = document.createElement("td");
    tdEnd.textContent = idx + 1;
    tdEnd.style.border = "1px solid #ccc";
    tdEnd.style.padding = "6px";
    tr.appendChild(tdEnd);

    for (let i = 0; i < arrowsPerEnd; i++) {
      const td = document.createElement("td");
      td.textContent = processed[i] !== undefined ? processed[i] : "";
      td.style.border = "1px solid #ccc";
      td.style.padding = "6px";
      tr.appendChild(td);
    }

    const tdTotal = document.createElement("td");
    tdTotal.textContent = total;
    tdTotal.style.border = "1px solid #ccc";
    tdTotal.style.padding = "6px";
    tr.appendChild(tdTotal);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableDiv.appendChild(table);

  // --- HORIZONTAL LINE GRAPH ---
  let horizChartCanvas = document.getElementById("sessionResultsHorizontalChart");
  if (!horizChartCanvas) {
    horizChartCanvas = document.createElement("canvas");
    horizChartCanvas.id = "sessionResultsHorizontalChart";
    horizChartCanvas.style.width = "100%";
    horizChartCanvas.style.maxHeight = "200px";
    horizChartCanvas.style.marginTop = "20px";
    tableDiv.parentElement?.appendChild(horizChartCanvas);
  }
  const ctxH = horizChartCanvas.getContext("2d");

  if (window.sessionHorizontalChartInstance) {
    try {
      window.sessionHorizontalChartInstance.destroy();
    } catch {}
    window.sessionHorizontalChartInstance = null;
  }

  const endTotals = endsArr.map((endObjOrArr) => {
    const arr = Array.isArray(endObjOrArr)
      ? endObjOrArr
      : Array.isArray(endObjOrArr.arrows)
      ? endObjOrArr.arrows
      : [];
    const values = arr.map((itm) =>
      typeof itm === "object" && itm.score !== undefined ? itm.score : itm
    );
    return values.filter((v) => typeof v === "number").reduce((a, b) => a + b, 0);
  });

  window.sessionHorizontalChartInstance = new Chart(ctxH, {
    type: "bar",
    data: {
      labels: endsArr.map((_, i) => `End ${i + 1}`),
      datasets: [
        {
          label: "Points per End",
          data: endTotals,
          backgroundColor: "rgba(59, 130, 246, 0.85)",
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          min: 0,
          max: (session.arrowsPerEnd || 0) * 10,
          title: { display: true, text: "Points" },
        },
        y: {
          title: { display: true, text: "End" },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
    },
  });

  // --- ARROW DISPERSION PATTERN ---
  let dispCanvas = document.getElementById("sessionResultsDispersion");
  if (!dispCanvas) {
    dispCanvas = document.createElement("canvas");
    dispCanvas.id = "sessionResultsDispersion";
    dispCanvas.width = 400;
    dispCanvas.height = 400;
    dispCanvas.style.marginTop = "20px";
    dispCanvas.style.border = "1px solid #ccc";
    tableDiv.parentElement?.appendChild(dispCanvas);
  }
  const dispCtx = dispCanvas.getContext("2d");
  if (!dispCtx) return;

  // Clear canvas
  dispCtx.clearRect(0, 0, dispCanvas.width, dispCanvas.height);

  // Draw target rings for scale reference
  drawTarget(dispCanvas);

  // Collect all arrow points from all ends
  const allArrows = [];
  endsArr.forEach((endObj) => {
    const endArr = Array.isArray(endObj)
      ? endObj
      : Array.isArray(endObj.arrows)
      ? endObj.arrows
      : [];
    endArr.forEach((arrow) => {
      if (arrow && typeof arrow === "object" && "x" in arrow && "y" in arrow) {
        allArrows.push(arrow);
      }
    });
  });

  // Draw arrows as green circles with stroke
  dispCtx.fillStyle = "lime";
  dispCtx.strokeStyle = "#222";
  dispCtx.lineWidth = 2;
  allArrows.forEach(({ x, y }) => {
    dispCtx.beginPath();
    dispCtx.arc(x, y, 5, 0, 2 * Math.PI);
    dispCtx.fill();
    dispCtx.stroke();
  });

  // Attach back to menu button handler
  attachBackToMenuHandler();
}

// Attach back to menu button: resets session and switches to menu screen
function attachBackToMenuHandler() {
  const backBtn = document.getElementById("backToMenuBtn");
  if (backBtn) {
    backBtn.onclick = (event) => {
      event.preventDefault();
      currentSession = {};
      arrowScores = [];
      currentEndNumber = 1;
      showScreen("menuScreen");
    };
  }
}

// Attach main buttons and events
function attachButtonHandlers() {
  document.getElementById("signupBtn")?.addEventListener("click", signup);
  document.getElementById("loginBtn")?.addEventListener("click", login);
  document.getElementById("menuStartBtn")?.addEventListener("click", () => showScreen("setup"));
  document.getElementById("menuLogoutBtn")?.addEventListener("click", () =>
    signOut(auth).then(() => showScreen("loginPage"))
  );
  document.getElementById("startSessionBtn")?.addEventListener("click", startSession);
  document.getElementById("undoBtn")?.addEventListener("click", undoLastArrow);
  document.getElementById("nextEndBtn")?.addEventListener("click", nextEnd);
  document.getElementById("endSessionBtn")?.addEventListener("click", endSession);

  const c = document.getElementById("target");
  if (c) {
    c.addEventListener("click", handleCanvasScoreClick);
    c.addEventListener("touchstart", (ev) => {
      ev.preventDefault();
      handleCanvasScoreClick(ev);
    });
  }
}

// On Firebase auth state change, update UI and user info
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    currentUserRole = null;
    showScreen("loginPage");
    return;
  }
  currentUser = user;

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      showScreen("loginPage");
      return;
    }
    const data = userDoc.data();
    currentUserRole = data.role || "archer";

    const greetingEl = document.getElementById("greeting");
    if (greetingEl) {
      greetingEl.innerText = `Hello, ${data.name} (${currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1)})!`;
    }

    if (currentUserRole === "archer") {
      showScreen("menuScreen");
      const startBtn = document.getElementById("startSessionBtn");
      if (startBtn) startBtn.style.display = "inline-block";
    } else {
      showScreen("menuScreen");
    }
  } catch (error) {
    console.error("Error fetching user role:", error);
    showScreen("loginPage");
  }
});

// Initialize UI after DOM loaded
window.addEventListener("DOMContentLoaded", () => {
  attachButtonHandlers();
  updateSessionSetupOptions();
  drawTarget();
  updateEndScores();
  updateEndSessionButtons();

  // Dynamically load Chart.js if not present
  if (typeof Chart === "undefined") {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js";
    document.head.appendChild(script);
  }
});
