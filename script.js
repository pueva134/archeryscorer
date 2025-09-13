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
let currentSession = {};
let arrowScores = [];
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

// Draw outdoor archery target
function drawTarget() {
  if (!ctx) return;
  const radius = canvas.width / 2;
  const rings = [
    { color: "#FFFFFF", radius: radius },           // 1-2 White
    { color: "#000000", radius: radius * 0.8 },     // 3-4 Black
    { color: "#0000FF", radius: radius * 0.6 },     // 5-6 Blue
    { color: "#FF0000", radius: radius * 0.4 },     // 7-8 Red
    { color: "#FFFF00", radius: radius * 0.2 }      // 9-10 Yellow
  ];

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  rings.forEach(ring => {
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
  if (endScoresDiv) endScoresDiv.innerText = arrowScores.join(" | ");
  if (endTotalDiv) {
    const numeric = arrowScores.filter(s => typeof s === "number").reduce((a,b) => a + b, 0);
    endTotalDiv.innerText = "End Total: " + numeric;
  }
}

// Update Next/End buttons visibility
function updateEndSessionButtons() {
  const nextBtn = document.getElementById("nextEndBtn");
  const endBtn = document.getElementById("endSessionBtn");
  const lastEnd = currentEndNumber === currentSession.endsCount;
  const arrowsComplete = arrowScores.length === currentSession.arrowsPerEnd;
  // Only show "Next" if not the last end and current arrows are complete
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

  let score = "M"; // Miss by default
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
  updateEndScores();         // Update the UI display with new scores
  updateEndSessionButtons(); // Update Next/End Session buttons as needed
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

// Next end processing
async function nextEnd(){
  if(arrowScores.length !== currentSession.arrowsPerEnd){
    alert("Please score all arrows!");
    return;
  }
  currentSession.ends.push([...arrowScores]);

  currentSession.totalScore += arrowScores.filter(s=>typeof s=='number').reduce((a,b) => a+b, 0);

  arrowScores = [];

  updateEndScores();
  updateEndSessionButtons();

  if(currentEndNumber === currentSession.endsCount){
    console.log("All ends completed. Ready to save full session.");
    return;
  }

  currentEndNumber++;
  document.getElementById("currentEnd").innerText = currentEndNumber;
}

// Save session to Firestore
async function saveSession() {
  if(!currentUser) return;

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
    date: Timestamp.now()
  };

  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      [`sessions.${sessionKey}`]: newSession
    });
    console.log("Session saved:", sessionKey);
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
    currentSession.totalScore += arrowScores.filter(s => typeof s === "number").reduce((a, b) => a + b, 0);
    arrowScores = [];
    console.log("Final end pushed in endSession");
  }

  if (currentSession.ends.length > 0) {
    await saveSession();
    await showSessionResults(currentSession);
  }
  currentSession = {};
  arrowScores = [];
  currentEndNumber = 1;
  showScreen("menuScreen");
}

// Show session results with table and chart
async function showSessionResults(session) {
  showScreen("sessionResultsScreen");

  document.getElementById("sessionResultsSummary").innerHTML = `
    <strong>Score:</strong> ${session.totalScore} / ${session.endsCount * session.arrowsPerEnd * 10}
    <br><strong>Date:</strong> ${new Date().toLocaleString()}
    <br><strong>Bow:</strong> ${session.bowStyle} | <strong>Distance:</strong> ${session.distance}m
    <br><strong>Target Face:</strong> ${session.targetFace}
  `;

  const tableDiv = document.getElementById("sessionResultsTable");
  let table = "<table border='1'><tr><th>End</th>";
  for(let i=1; i<=session.arrowsPerEnd; i++) table += `<th>Arrow ${i}</th>`;
  table += "<th>End Total</th></tr>";
  session.ends.forEach((end, idx) => {
    const total = end.filter(s => typeof s === "number").reduce((a,b) => a+b, 0);
    table += `<tr><td>${idx+1}</td>`;
    end.forEach(score => table += `<td>${score}</td>`);
    table += `<td>${total}</td></tr>`;
  });
  table += "</table>";
  tableDiv.innerHTML = table;

  // Chart.js Trend Line Chart
  const chartCanvas = document.getElementById("sessionResultsTrendChart");
  if(window.resultTrendChart) window.resultTrendChart.destroy();
  const endPercentages = session.ends.map(end => {
    const total = end.filter(s => typeof s === "number").reduce((a, b) => a + b, 0);
    return ((total / (session.arrowsPerEnd * 10)) * 100).toFixed(1);
  });
  window.resultTrendChart = new Chart(chartCanvas.getContext("2d"), {
    type: 'line',
    data: {
      labels: session.ends.map((_, i) => `End ${i+1}`),
      datasets: [{
        label: 'End % Points',
        data: endPercentages,
        borderColor: '#38bdf8',
        fill: false
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Target Rings Visualization (last end)
  const targetCanvas = document.getElementById("sessionResultsTarget");
  const ctx = targetCanvas.getContext("2d");
  const radius = targetCanvas.width / 2;
  const rings = [
    { color: "#FFFFFF", r: radius },
    { color: "#000000", r: radius * 0.8 },
    { color: "#0000FF", r: radius * 0.6 },
    { color: "#FF0000", r: radius * 0.4 },
    { color: "#FFFF00", r: radius * 0.2 }
  ];
  ctx.clearRect(0,0,targetCanvas.width,targetCanvas.height);
  rings.forEach(rg => {
    ctx.beginPath(); ctx.arc(radius, radius, rg.r, 0, 2 * Math.PI);
    ctx.fillStyle = rg.color; ctx.fill();
  });
}

// View session history for current user
async function viewHistory(){
  if(!currentUser) return;
  const userDoc = await getDoc(doc(db, "users", currentUser.uid));
  if(!userDoc.exists()) return;
  const sessionsObject = userDoc.data().sessions || {};
  const sessionsArr = Object.entries(sessionsObject).sort((a,b) => {
    const dateA = a[1].date?.seconds || 0;
    const dateB = b[1].date?.seconds || 0;
    return dateB - dateA;
  });
  const container = document.getElementById("historyTable");
  container.innerHTML = "";

  let table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.border = "1";
  table.innerHTML = "<tr><th>Date</th><th>Total Score</th><th>Ends</th></tr>";

  sessionsArr.forEach(([key, s]) => {
    const date = s.date ? new Date(s.date.seconds * 1000).toLocaleDateString() : "N/A";
    const totalScore = s.totalScore || 0;
    const endsCount = s.ends ? s.ends.length : 0;
    table.innerHTML += `<tr>
      <td>${date}</td>
      <td>${totalScore}</td>
      <td>${endsCount}</td>
    </tr>`;
  });

  container.appendChild(table);
  showScreen("historyScreen");
}

// Attach all button handlers for UI controls
function attachButtonHandlers(){
  document.getElementById("signupBtn")?.addEventListener("click", signup);
  document.getElementById("loginBtn")?.addEventListener("click", login);
  document.getElementById("menuStartBtn")?.addEventListener("click", () => showScreen("setup"));
  document.getElementById("menuHistoryBtn")?.addEventListener("click", viewHistory);
  document.getElementById("menuLogoutBtn")?.addEventListener("click", () => signOut(auth).then(() => showScreen("loginPage")));
  document.getElementById("menuToggleBtn")?.addEventListener("click", () => {
    // Theme toggle implementation
    const themes = ['', 'light-theme', 'redblack-theme'];
    const currentTheme = document.body.className;
    const themeIndex = themes.indexOf(currentTheme);
    const nextIndex = (themeIndex + 1) % themes.length;
    document.body.className = themes[nextIndex];
    localStorage.setItem('selectedTheme', themes[nextIndex]);
  });
  document.getElementById("startSessionBtn")?.addEventListener("click", startSession);
  document.getElementById("viewHistoryBtn")?.addEventListener("click", viewHistory);
  document.getElementById("logoutBtn")?.addEventListener("click", () => signOut(auth).then(() => showScreen("loginPage")));
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
  document.getElementById("backToMenuBtn")?.addEventListener("click", () => showScreen("menuScreen"));
  if(canvas){
    canvas.addEventListener("click", handleCanvasScoreClick);
  }
}

// Auth state changes - update UI accordingly
onAuthStateChanged(auth, async user => {
  currentUser = user;
  if(user){
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if(userDoc.exists()){
      const data = userDoc.data();
      currentUserRole = data.role || "archer";
      document.getElementById("greeting").innerText = `Hello, ${data.name} (${currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1)})!`;

      // Role-based UI adjustments
      if(currentUserRole === "coach"){
        document.getElementById("startSessionBtn").style.display = "none";
        const coachBtn = document.getElementById("menuCoachBtn");
        if(!coachBtn){
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
      } else {
        document.getElementById("startSessionBtn").style.display = "inline-block";
        const coachBtn = document.getElementById("menuCoachBtn");
        if(coachBtn) coachBtn.style.display = "none";
      }
      showScreen("menuScreen");
    }
  }
  else {
    currentUserRole = null;
    document.getElementById("greeting").innerText = "";
    showScreen("loginPage");
  }
});

// Coach dashboard implementation
let selectedArcherUID = null;
let selectedArcherName = null;

async function loadArchersList() {
  const archerList = document.getElementById("archerList");
  archerList.innerHTML = '';
  const q = query(collection(db, "users"), where("role", "==", "archer"));
  const snapshot = await getDocs(q);
  if(snapshot.empty){
    archerList.innerHTML = '<li>No archers found.</li>';
    return;
  }
  snapshot.forEach(docSnap => {
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
  const sessionListDiv = document.getElementById('archerSessionList');
  sessionListDiv.innerHTML = 'Loading sessions...';

  const userDoc = await getDoc(doc(db, "users", archerUID));
  if (!userDoc.exists()) {
    sessionListDiv.innerHTML = 'Archer not found.';
    return;
  }
  const sessions = userDoc.data().sessions || {};
  const sessionEntries = Object.entries(sessions);
  if (sessionEntries.length === 0) {
    sessionListDiv.innerHTML = 'No sessions found.';
    return;
  }

  const ul = document.createElement('ul');
  ul.style.listStyle = 'none';
  ul.style.paddingLeft = '0';

  sessionEntries.forEach(([sessionId, sessionData]) => {
    const li = document.createElement('li');
    const date = sessionData.date ? new Date(sessionData.date.seconds * 1000).toLocaleString() : 'No date';
    const total = sessionData.totalScore || 0;
    li.textContent = `Date: ${date} - Total Score: ${total}`;
    li.style.cursor = 'pointer';
    li.style.padding = '5px';
    li.style.borderBottom = '1px solid #555';
    li.onclick = () => {
      displaySessionResult(sessionData);
    };
    ul.appendChild(li);
  });

  sessionListDiv.innerHTML = '';
  sessionListDiv.appendChild(ul);
}

// Display detailed session result with table and Chart.js
async function displaySessionResult(sessionData) {
  document.getElementById('sessionResultContainer').style.display = 'block';
  const summaryDiv = document.getElementById('sessionResultSummary');
  const tableDiv = document.getElementById('sessionResultTable');
  const chartCanvas = document.getElementById('sessionResultChart');

  summaryDiv.innerHTML = `
    <p><strong>Bow Style:</strong> ${sessionData.bowStyle}</p>
    <p><strong>Distance:</strong> ${sessionData.distance}m</p>
    <p><strong>Target Face:</strong> ${sessionData.targetFace}</p>
    <p><strong>Total Score:</strong> ${sessionData.totalScore}</p>
    <p><strong>Ends:</strong> ${sessionData.ends.length}</p>
  `;

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';

  let headerRow = '<tr><th>End</th>';
  const arrowsCount = sessionData.arrowsPerEnd || (sessionData.ends[0]?.arrows.length || 0);
  for (let i = 1; i <= arrowsCount; i++) {
    headerRow += `<th>Arrow ${i}</th>`;
  }
  headerRow += '<th>End Total</th></tr>';
  table.innerHTML = headerRow;

  sessionData.ends.forEach((endObj, idx) => {
    const endArr = endObj.arrows || [];
    const endTotal = endArr.filter(s => typeof s === 'number').reduce((a, b) => a + b, 0);
    let row = `<tr><td>${idx + 1}</td>`;
    endArr.forEach(score => {
      row += `<td>${score}</td>`;
    });
    row += `<td>${endTotal}</td></tr>`;
    table.innerHTML += row;
  });

  tableDiv.innerHTML = '';
  tableDiv.appendChild(table);

  const ctx = chartCanvas.getContext('2d');
  if(window.sessionChartInstance) window.sessionChartInstance.destroy();

  const endTotals = sessionData.ends.map(end =>
    (end.arrows || []).filter(s => typeof s === 'number').reduce((a,b) => a+b, 0)
  );

  window.sessionChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sessionData.ends.map((_, i) => `End ${i + 1}`),
      datasets: [{
        label: 'End Total',
        data: endTotals,
        backgroundColor: 'rgba(59, 130, 246, 0.7)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

// Show coach dashboard screen and load archers list
function showCoachDashboard() {
  showScreen('coachDashboard');
  loadArchersList();
}

// Navigation control for coach dashboard back button
document.getElementById('coachBackBtn').addEventListener('click', () => {
  document.getElementById('sessionResultContainer').style.display = 'none';
  showScreen('menuScreen');
});

// Initialization on page ready
window.addEventListener("DOMContentLoaded", () => {
  attachButtonHandlers();
  updateSessionSetupOptions();
  drawTarget();
  updateEndScores();
  updateEndSessionButtons();

  // Load saved theme from local storage
  const savedTheme = localStorage.getItem('selectedTheme') || '';
  const themes = ['', 'light-theme', 'redblack-theme'];
  if (themes.includes(savedTheme)) document.body.className = savedTheme;
});

// Load Chart.js library dynamically for charts
const chartScript = document.createElement('script');
chartScript.src = "https://cdn.jsdelivr.net/npm/chart.js";
document.head.appendChild(chartScript);
