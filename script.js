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

// Firebase Config
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
let currentSession = {};
let arrowScores = [];
let currentEndNumber = 1;
let sessionDataForResults = null;

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
    { color: "#FFFFFF", radius },
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

// Start session
function startSession() {
  if(currentUserRole !== "archer"){
    alert("Only archers can start a session");
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

// Undo last arrow score
function undoLastArrow(){
  if(arrowScores.length > 0){
    arrowScores.pop();
    updateEndScores();
    updateEndSessionButtons();
  }
}

// Go to next end
async function nextEnd(){
  if(arrowScores.length !== currentSession.arrowsPerEnd){
    alert("Please score all arrows!");
    return;
  }
  currentSession.ends.push([...arrowScores]);
  currentSession.totalScore += arrowScores.filter(s => typeof s === "number").reduce((a,b) => a+b, 0);
  arrowScores = [];
  updateEndScores();
  updateEndSessionButtons();
  if(currentEndNumber === currentSession.endsCount){
    alert("All ends completed. Please end session.");
    return;
  }
  currentEndNumber++;
  document.getElementById("currentEnd").innerText = currentEndNumber;
}

// Save session to Firestore
async function saveSession() {
  if(!currentUser) return;
  const endsObjects = currentSession.ends.map(arr => ({ arrows: arr }));
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
    await updateDoc(userRef, { [`sessions.${sessionKey}`]: newSession });
    sessionDataForResults = newSession;
  } catch(e) {
    console.error("Failed to save session:", e);
  }
}

// End session and save data
async function endSession() {
  if(arrowScores.length > 0 && arrowScores.length !== currentSession.arrowsPerEnd){
    alert("Please score all arrows in current end before ending session.");
    return;
  }
  if(arrowScores.length === currentSession.arrowsPerEnd){
    currentSession.ends.push([...arrowScores]);
    currentSession.totalScore += arrowScores.filter(s => typeof s === "number").reduce((a,b)=> a + b, 0);
    arrowScores = [];
  }
  if(currentSession.ends.length > 0){
    await saveSession();
  }
  currentSession = {};
  arrowScores = [];
  currentEndNumber = 1;
  showScreen("menuScreen");
}

// View history
async function viewHistory(){
  if(!currentUser) return;
  const userDoc = await getDoc(doc(db, "users", currentUser.uid));
  if(!userDoc.exists()) return;
  const sessions = userDoc.data().sessions || {};
  const container = document.getElementById("historyTable");
  container.innerHTML = "";
  if(Object.keys(sessions).length === 0){
    container.textContent = "No sessions found.";
    return;
  }
  let table = document.createElement("table");
  table.innerHTML = "<tr><th>Date</th><th>Total Score</th><th>Ends</th></tr>";
  Object.values(sessions).forEach(session => {
    const date = session.date ? new Date(session.date.seconds * 1000).toLocaleDateString() : "N/A";
    const score = session.totalScore || 0;
    const ends = session.ends ? session.ends.length : 0;
    table.innerHTML += `<tr><td>${date}</td><td>${score}</td><td>${ends}</td></tr>`;
  });
  container.appendChild(table);
  showScreen("historyScreen");
}

// Attach button handlers safely
function attachButtonHandlers() {
  document.getElementById("signupBtn")?.addEventListener("click", signup);
  document.getElementById("loginBtn")?.addEventListener("click", login);
  document.getElementById("menuStartBtn")?.addEventListener("click", () => showScreen("setup"));
  document.getElementById("menuHistoryBtn")?.addEventListener("click", viewHistory);
  document.getElementById("menuLogoutBtn")?.addEventListener("click", () => signOut(auth).then(() => showScreen("loginPage")));
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
  if(canvas) canvas.addEventListener("click", handleCanvasScoreClick);
}

// Auth state change handler
onAuthStateChanged(auth, async (user) => {
  console.log("Auth state changed", user);
  currentUser = user;
  if(user){
    const userDoc = await getDoc(doc(db, "users", user.uid));
    console.log("Fetched userDoc:", userDoc.exists(), userDoc.data());
    if(userDoc.exists()){
      const data = userDoc.data();
      currentUserRole = data.role || "archer";
      document.getElementById("greeting").innerText = `Hello, ${data.name} (${currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1)})!`;
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
    } else {
      showScreen("loginPage");
    }
  } else {
    currentUserRole = null;
    document.getElementById("greeting").innerText = "";
    showScreen("loginPage");
  }
});

// Coach dashboard
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
    endArr.forEach((score) => {
      row += `<td>${score}</td>`;
    });
    row += `<td>${endTotal}</td></tr>`;
    table.innerHTML += row;
  });
  tableDiv.innerHTML = '';
  tableDiv.appendChild(table);
  const ctx = chartCanvas.getContext('2d');
  if(window.sessionChartInstance) window.sessionChartInstance.destroy();
  const endTotals = sessionData.ends.map((end) => 
    (end.arrows || []).filter(s => typeof s === 'number').reduce((a, b) => a + b, 0)
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
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: 'easeOutQuart',
        loop: false
      },
      scales: {
        y: {
          beginAtZero: true,
          max: Math.max(...endTotals) + 10
        }
      }
    }
  });
}

document.getElementById('coachBackBtn').addEventListener('click', () => {
  document.getElementById('sessionResultContainer').style.display = 'none';
  showScreen('menuScreen');
});
