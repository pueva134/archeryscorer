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

// Initialize Firebase
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

let canvas = document.getElementById("target");
let ctx = canvas?.getContext("2d");

// Show screen helper
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");

  if (id === "scoringArea") {
    canvas = document.getElementById("target");
    ctx = canvas?.getContext("2d");
    drawTarget();
  }
  if (id === "setup") updateSessionSetupOptions();
}

// Draw archery target rings on given or global canvas
function drawTarget(targetElem) {
  const c = targetElem || canvas || document.getElementById("target");
  if (!c) return;
  const cctx = c.getContext("2d");
  if (!cctx) return;

  const radius = c.width / 2;
  const rings = [
    { color: "#FFFFFF", radius: radius },
    { color: "#000000", radius: radius * 0.8 },
    { color: "#0000FF", radius: radius * 0.6 },
    { color: "#FF0000", radius: radius * 0.4 },
    { color: "#FFFF00", radius: radius * 0.2 },
  ];
  cctx.clearRect(0, 0, c.width, c.height);
  rings.forEach(ring => {
    cctx.beginPath();
    cctx.arc(radius, radius, ring.radius, 0, 2 * Math.PI);
    cctx.fillStyle = ring.color;
    cctx.fill();
  });
}

// Update displayed end arrow scores and total
function updateEndScores() {
  const endScoresDiv = document.getElementById("endScores");
  const endTotalDiv = document.getElementById("endTotal");

  if (endScoresDiv) {
    endScoresDiv.innerText = arrowScores
      .map(a => (typeof a === "object" && a.score !== undefined ? a.score : a))
      .join(" | ");
  }

  if (endTotalDiv) {
    const numeric = arrowScores
      .map(a => (typeof a === "object" && a.score !== undefined ? a.score : a))
      .filter(s => typeof s === "number")
      .reduce((acc, val) => acc + val, 0);
    endTotalDiv.innerText = "End Total: " + numeric;
  }
}

// Show or hide next/end buttons based on session/end state
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

// Handle clicks or tap on canvas to record arrow score
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

// Signup new user
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

// User login handler
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

// Dynamically update session setup options based on bow selection
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
    const distances = bowDistances[selectedBow] || [];
    distances.forEach(d => {
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
      faces = selectedBow === "Compound"
        ? bowTargetFaces.Compound
        : (bowTargetFaces.outdoorOnly || []).concat(bowTargetFaces.indoorOnly || []);
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

// Start scoring session initialization
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

// Proceed to next end after scoring completion
async function nextEnd() {
  if (!currentSession || !currentSession.arrowsPerEnd) return;
  if (arrowScores.length !== currentSession.arrowsPerEnd) {
    alert("Please score all arrows!");
    return;
  }

  currentSession.ends.push([...arrowScores]);

  const endTotal = arrowScores
    .map(s => (typeof s === "object" && s.score !== undefined ? s.score : s))
    .filter(s => typeof s === "number")
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

// Save session data to Firestore
async function saveSession() {
  if (!currentUser) return;

  const endsObjects = currentSession.ends.map(endArr => ({ arrows: endArr }));
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

// End session and save if all scored
async function endSession() {
  if (!currentSession || !currentSession.arrowsPerEnd) return;

  if (arrowScores.length > 0 && arrowScores.length !== currentSession.arrowsPerEnd) {
    alert(`Please score all arrows in End ${currentEndNumber} before ending session.`);
    return;
  }

  if (arrowScores.length === currentSession.arrowsPerEnd) {
    currentSession.ends.push([...arrowScores]);
    const endTotal = arrowScores
      .map(s => (typeof s === "object" && s.score !== undefined ? s.score : s))
      .filter(s => typeof s === "number")
      .reduce((a, b) => a + b, 0);
    currentSession.totalScore = (currentSession.totalScore || 0) + endTotal;
    arrowScores = [];
  }

  if (currentSession.ends.length > 0) {
    await saveSession();
    showSessionResults(currentSession);
  }
}

// Display session scores and line chart using Chart.js
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

  const maxPossible = (session.endsCount || session.ends.length || 0) * (session.arrowsPerEnd || 0) * 10;
  const summaryEl = document.getElementById("sessionResultsSummary");
  if (summaryEl) {
    summaryEl.innerHTML = `
      <strong>Score:</strong> ${session.totalScore} / ${maxPossible}<br>
      <strong>Date:</strong> ${dateStr}<br>
      <strong>Bow:</strong> ${session.bowStyle} | <strong>Distance:</strong> ${session.distance}m<br>
      <strong>Target Face:</strong> ${session.targetFace}
    `;
  }

  const tableDiv = document.getElementById("sessionResultsTable");
  if (!tableDiv) return;
  tableDiv.innerHTML = "";

  const endsArr = Array.isArray(session.ends) ? session.ends : [];
  if (endsArr.length === 0) {
    tableDiv.innerHTML = "<p>No session data available.</p>";
    return;
  }

  const arrowsPerEnd = session.arrowsPerEnd || (endsArr[0]?.arrows?.length || 0);
  let table = "<table border='1' style='width:100%; border-collapse: collapse;'>";
  table += "<thead><tr><th>End</th>";
  for (let i = 1; i <= arrowsPerEnd; i++) {
    table += `<th>Arrow ${i}</th>`;
  }
  table += "<th>Total</th></tr></thead><tbody>";

  endsArr.forEach((endObjOrArr, idx) => {
    const endArr = Array.isArray(endObjOrArr)
      ? endObjOrArr
      : Array.isArray(endObjOrArr.arrows)
      ? endObjOrArr.arrows
      : [];
    const processed = endArr.map(itm => (typeof itm === "object" && itm.score !== undefined ? itm.score : itm));
    const total = processed.filter(v => typeof v === "number").reduce((a, b) => a + b, 0);

    table += `<tr><td>${idx + 1}</td>`;
    for (let i = 0; i < arrowsPerEnd; i++) {
      const val = processed[i] !== undefined ? processed[i] : "";
      table += `<td>${val}</td>`;
    }
    table += `<td>${total}</td></tr>`;
  });

  table += "</tbody></table>";
  tableDiv.innerHTML = table;

  // Chart.js canvas and rendering
  let chartCanvas = document.getElementById("sessionResultsTrendChart");
  if (!chartCanvas) {
    // Create and append if missing
    chartCanvas = document.createElement("canvas");
    chartCanvas.width = 600;
    chartCanvas.height = 300;
    tableDiv.parentElement?.appendChild(chartCanvas);
  }

  const chartCtx = chartCanvas.getContext("2d");
  if (!chartCtx) return;
  chartCtx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);

  if (window.sessionChartInstance) {
    try {
      window.sessionChartInstance.destroy();
    } catch (_) {}
    window.sessionChartInstance = null;
  }

  const endTotals = endsArr.map(endObjOrArr => {
    const endArr = Array.isArray(endObjOrArr)
      ? endObjOrArr
      : Array.isArray(endObjOrArr.arrows)
      ? endObjOrArr.arrows
      : [];
    const values = endArr.map(itm => (typeof itm === "object" && itm.score !== undefined ? itm.score : itm));
    return values.filter(v => typeof v === "number").reduce((a, b) => a + b, 0);
  });

  try {
    window.sessionChartInstance = new Chart(chartCtx, {
      type: "line",
      data: {
        labels: endsArr.map((_, i) => `End ${i + 1}`),
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
            max: (session.arrowsPerEnd || 0) * 10,
            title: { display: true, text: "Points" },
          },
          x: {
            title: { display: true, text: "End Number" },
          },
        },
      },
    });
  } catch (e) {
    console.error("Chart rendering failed:", e);
  }

  // Draw target rings + arrow points on separate canvas if available
  const targetCanvas = document.getElementById("sessionResultsTarget");
  if (targetCanvas) {
    const targetCtx = targetCanvas.getContext("2d");
    if (targetCtx) {
      drawTarget(targetCanvas);
      const lastEndObj = endsArr[endsArr.length - 1];
      const lastEnd = Array.isArray(lastEndObj)
        ? lastEndObj
        : Array.isArray(lastEndObj?.arrows)
        ? lastEndObj.arrows
        : [];
      lastEnd.forEach(arrow => {
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
}

// Attach handlers for all functional buttons and events
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

  // Canvas click and touch
  const c = document.getElementById("target");
  if (c) {
    c.addEventListener("click", handleCanvasScoreClick);
    c.addEventListener("touchstart", ev => {
      ev.preventDefault();
      handleCanvasScoreClick(ev);
    });
  }
}

// Firebase auth state listener to update UI and user role
onAuthStateChanged(auth, async user => {
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
      // Hide archer controls or load coach dashboard here if needed
      showScreen("menuScreen");
    }
  } catch (error) {
    console.error("Error fetching user role:", error);
    showScreen("loginPage");
  }
});

window.addEventListener("DOMContentLoaded", () => {
  attachButtonHandlers();
  updateSessionSetupOptions();
  drawTarget();
  updateEndScores();
  updateEndSessionButtons();

  // Load Chart.js dynamically if not present
  if (typeof Chart === "undefined") {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js";
    document.head.appendChild(script);
  }
});
