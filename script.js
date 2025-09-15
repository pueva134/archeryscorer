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
  writeBatch,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Firebase Config & Init (Keep config secret in production)
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

// Globals - minimized mutations, scoped updates prefered
let currentUser = null;
let currentUserRole = null;
let currentSession = {};
let arrowScores = [];
let currentEndNumber = 1;
const canvas = document.getElementById("target");
const ctx = canvas?.getContext("2d");

// --- Helper: Show Screen ---
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  if (id === "scoringArea") drawTarget();
  if (id === "setup") updateSessionSetupOptions();
}

// --- Draw Archery Target with dynamic rings ---
function drawTarget() {
  if (!ctx || !canvas) return;
  const radius = canvas.width / 2;
  const rings = [
    { color: "#FFFF00", radius: radius * 0.2 }, // 9-10 (inner yellow)
    { color: "#FF0000", radius: radius * 0.4 }, // 7-8
    { color: "#0000FF", radius: radius * 0.6 }, // 5-6
    { color: "#000000", radius: radius * 0.8 }, // 3-4
    { color: "#FFFFFF", radius: radius },       // 1-2 outer white
  ];
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw rings from outer to inner for proper layering
  for (let i = rings.length - 1; i >= 0; i--) {
    ctx.beginPath();
    ctx.arc(radius, radius, rings[i].radius, 0, 2 * Math.PI);
    ctx.fillStyle = rings[i].color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#333";
    ctx.stroke();
  }
}

// --- Update End Scores display ---
function updateEndScores() {
  const endScoresDiv = document.getElementById("endScores");
  const endTotalDiv = document.getElementById("endTotal");
  if (endScoresDiv) {
    endScoresDiv.innerText = arrowScores.map(a => (typeof a === "object" ? a.score : a)).join(" | ");
  }
  if (endTotalDiv) {
    const numericTotal = arrowScores
      .map(a => (typeof a === "object" ? a.score : a))
      .filter(s => typeof s === "number")
      .reduce((acc, val) => acc + val, 0);
    endTotalDiv.innerText = `End Total: ${numericTotal}`;
  }
}

// --- Update Next/End Buttons visibility ---
function updateEndSessionButtons() {
  const nextBtn = document.getElementById("nextEndBtn");
  const endBtn = document.getElementById("endSessionBtn");
  const lastEnd = currentEndNumber === currentSession.endsCount;
  const arrowsComplete = arrowScores.length === currentSession.arrowsPerEnd;

  if (arrowsComplete) {
    if (!lastEnd) {
      nextBtn.style.display = "inline-block";
      endBtn.style.display = "none";
    } else {
      nextBtn.style.display = "none";
      endBtn.style.display = "inline-block";
    }
  } else {
    nextBtn.style.display = "none";
    endBtn.style.display = "none";
  }
}

// --- Calculate score based on click position more precisely ---
function calculateScoreFromClick(x, y) {
  if (!canvas) return "M";
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
  const maxRadius = canvas.width / 2;
  const ringWidth = maxRadius / 10;

  if (dist > maxRadius) return "M"; // Miss outside target

  // Determine scoring ring (1-10). Inner yellow ring = 9-10, scored as 10 here.
  for (let ring = 1; ring <= 10; ring++) {
    if (dist <= ringWidth * ring) {
      // Score 10 if in first ring (center)
      return ring === 1 ? 10 : 11 - ring; // Rings count down from center outwards
    }
  }
  return "M";
}

// --- Canvas click handler to score arrow ---
function handleCanvasScoreClick(e) {
  if (!currentSession.arrowsPerEnd) return;
  if (arrowScores.length >= currentSession.arrowsPerEnd) {
    alert("All arrows for this end are scored.");
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const score = calculateScoreFromClick(x, y);
  arrowScores.push({ score, x, y });
  updateEndScores();
  updateEndSessionButtons();
}

// --- Signup Function with input validation and Firestore user creation ---
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
    // Store user profile with role
    await setDoc(doc(db, "users", uid), {
      name: username,
      role: role,
      sessions: {},
    });
    msgDiv.innerText = "Signup successful! Please login.";
    showScreen("loginPage");
  } catch (e) {
    msgDiv.innerText = e.message;
  }
}

// --- Login Function with role fetching and session persistence ---
async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msgDiv = document.getElementById("loginMessage");
  msgDiv.innerText = "";

  if (!email || !password) {
    msgDiv.innerText = "Please enter both email and password!";
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    currentUser = userCredential.user;

    // Fetch user role after login for session use & UI gating
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    currentUserRole = userDoc.exists() ? userDoc.data().role : null;

    // Proceed to session setup or main screen based on role
    if (currentUserRole === "archer") {
      showScreen("setup");
    } else {
      alert("You do not have permission to start a session.");
      showScreen("loginPage");
    }
  } catch (e) {
    msgDiv.innerText = e.message;
  }
}

// --- Keep user state synced ---
onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    currentUserRole = userDoc.exists() ? userDoc.data().role : null;
    if (currentUserRole === "archer") {
      showScreen("setup");
    } else {
      showScreen("loginPage");
    }
  } else {
    currentUserRole = null;
    showScreen("loginPage");
  }
});

// --- Logout ---
async function logout() {
  try {
    await signOut(auth);
  } catch (e) {
    alert("Error during sign out: " + e.message);
  }
}

// --- Session Setup Options with modular DOM updates ---
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

  // Initialize only once
  if (bowSelect.options.length === 0) {
    const fragment = document.createDocumentFragment();
    Object.keys(bowDistances).forEach(bow => {
      const opt = document.createElement("option");
      opt.value = bow;
      opt.textContent = bow;
      fragment.appendChild(opt);
    });
    bowSelect.appendChild(fragment);
  }

  function updateDistances() {
    distSelect.innerHTML = "";
    const selectedBow = bowSelect.value;
    const fragment = document.createDocumentFragment();
    bowDistances[selectedBow].forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = `${d}m`;
      fragment.appendChild(opt);
    });
    distSelect.appendChild(fragment);
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
      faces =
        selectedBow === "Compound"
          ? bowTargetFaces.Compound
          : bowTargetFaces.outdoorOnly.concat(bowTargetFaces.indoorOnly);
    }
    const fragment = document.createDocumentFragment();
    faces.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.value;
      opt.textContent = f.label;
      fragment.appendChild(opt);
    });
    faceSelect.appendChild(fragment);
  }

  bowSelect.onchange = () => {
    updateDistances();
  };
  distSelect.onchange = () => {
    updateTargetFaces();
  };

  updateDistances();
}

// --- Start Session with validation ---
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
    date: Timestamp.now(),
  };

  arrowScores = [];
  currentEndNumber = 1;
  document.getElementById("currentEnd").innerText = currentEndNumber;

  showScreen("scoringArea");
  drawTarget();
  updateEndScores();
  updateEndSessionButtons();
}

// --- Undo last arrow safely ---
function undoLastArrow() {
  if (arrowScores.length === 0) return;
  arrowScores.pop();
  updateEndScores();
  updateEndSessionButtons();
}

// --- Next End with validation & cleanup ---
function nextEnd() {
  if (arrowScores.length !== currentSession.arrowsPerEnd) {
    alert("Please score all arrows before proceeding to next end.");
    return;
  }
  // Append current end scores
  currentSession.ends.push([...arrowScores]);
  currentSession.totalScore += arrowScores
    .map(a => (typeof a === "object" ? a.score : a))
    .filter(s => typeof s === "number")
    .reduce((a, b) => a + b, 0);

  arrowScores = [];
  updateEndScores();
  updateEndSessionButtons();

  if (currentEndNumber < currentSession.endsCount) {
    currentEndNumber++;
    document.getElementById("currentEnd").innerText = currentEndNumber;
  }
}

// --- Save session to Firestore using batch for scalability ---
async function saveSession() {
  if (!currentUser || !currentUser.uid) return;

  const sessionKey = Date.now().toString();
  const endsObjects = currentSession.ends.map(endArr => ({ arrows: endArr }));

  const newSession = {
    bowStyle: currentSession.bowStyle,
    distance: currentSession.distance,
    targetFace: currentSession.targetFace,
    arrowsPerEnd: currentSession.arrowsPerEnd,
    endsCount: currentSession.endsCount,
    ends: endsObjects,
    totalScore: currentSession.totalScore,
    date: currentSession.date || Timestamp.now(),
  };

  try {
    const userRef = doc(db, "users", currentUser.uid);

    // Use batch write to update session - scalable for future multiple ops
    const batch = writeBatch(db);
    batch.update(userRef, {
      [`sessions.${sessionKey}`]: newSession,
    });
    await batch.commit();
  } catch (e) {
    console.error("Failed to save session:", e);
    alert("Error saving session. Please try again.");
  }
}

// --- End session with checks and result display ---
async function endSession() {
  if (
    arrowScores.length > 0 &&
    arrowScores.length !== currentSession.arrowsPerEnd
  ) {
    alert(`Please score all arrows in End ${currentEndNumber} before ending session.`);
    return;
  }

  if (arrowScores.length === currentSession.arrowsPerEnd) {
    currentSession.ends.push([...arrowScores]);
    currentSession.totalScore += arrowScores
      .map(a => (typeof a === "object" ? a.score : a))
      .filter(s => typeof s === "number")
      .reduce((a, b) => a + b, 0);
    arrowScores = [];
  }

  if (currentSession.ends.length > 0) {
    await saveSession();
    showSessionResults(currentSession);
  }
}

// --- Show session results with detailed table and Chart.js line graph ---
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

  // Build result table efficiently using DocumentFragment
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
    headerRow.appendChild(th);
  }

  const thTotal = document.createElement("th");
  thTotal.textContent = "Total";
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
    row.appendChild(endCell);

    scores.forEach(scoreItem => {
      const val = typeof scoreItem === "object" && scoreItem.score !== undefined ? scoreItem.score : scoreItem;
      const td = document.createElement("td");
      td.textContent = val;
      row.appendChild(td);
    });

    const totalCell = document.createElement("td");
    totalCell.textContent = total;
    row.appendChild(totalCell);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  tableDiv.appendChild(table);

  // Chart.js line graph of end totals
  const chartCanvas = document.getElementById("sessionResultsTrendChart");
  if (!chartCanvas) return;
  const ctxChart = chartCanvas.getContext("2d");

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
        y: { beginAtZero: true, max: session.arrowsPerEnd * 10 },
      },
    },
  });
}

// Event Listeners
canvas?.addEventListener("click", handleCanvasScoreClick);
document.getElementById("signupBtn")?.addEventListener("click", signup);
document.getElementById("loginBtn")?.addEventListener("click", login);
document.getElementById("logoutBtn")?.addEventListener("click", logout);
document.getElementById("startSessionBtn")?.addEventListener("click", startSession);
document.getElementById("undoArrowBtn")?.addEventListener("click", undoLastArrow);
document.getElementById("nextEndBtn")?.addEventListener("click", nextEnd);
document.getElementById("endSessionBtn")?.addEventListener("click", endSession);

// Initialize setup options on page load or when setup screen shows
updateSessionSetupOptions();
