// ------------------------------
// Complete modified script.js with Coach Role-Based Access Control
// ------------------------------
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
  if (lastEnd && arrowsComplete) {
    nextBtn.style.display = "none";
    endBtn.style.display = "inline-block";
  } else {
    nextBtn.style.display = "inline-block";
    endBtn.style.display = "none";
  }
}

// Handle canvas click to calculate score
function handleCanvasScoreClick(e) {
  if (!currentSession.arrowsPerEnd) return;
  if (arrowScores.length >= currentSession.arrowsPerEnd) {
    alert("All arrows for this end have been scored.");
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const center = canvas.width / 2;
  const dist = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
  const maxRadius = canvas.width / 2;
  let score = "M"; // Miss by default

  // Assign score based on approximate ring radii
  if (dist <= maxRadius * 0.2) score = 10;         // Yellow inner
  else if (dist <= maxRadius * 0.4) score = 8;     // Red
  else if (dist <= maxRadius * 0.6) score = 6;     // Blue
  else if (dist <= maxRadius * 0.8) score = 4;     // Black
  else if (dist <= maxRadius) score = 2;           // White

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
    // last end reached
    return;
  }
  currentEndNumber++;
  document.getElementById("currentEnd").innerText = currentEndNumber;
}

// Save session to Firestore
async function saveSession(){
  if(!currentUser) return;
  const userRef = doc(db, "users", currentUser.uid);
  const sessionKey = Date.now().toString();
  try {
    await updateDoc(userRef, {
      [`sessions.${sessionKey}`]: {
        ...currentSession,
        date: Timestamp.now(),
      }
    });
  } catch(e) {
    console.error("Error saving session:", e);
  }
}

// End session
async function endSession(){
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
  const sessionsObject = userDoc.data().sessions || {};
  const sessionsArr = Object.values(sessionsObject);
  const container = document.getElementById("historyTable");
  container.innerHTML = "";
  let table = document.createElement("table");
  table.innerHTML = "<tr><th>Date</th><th>Total Score</th><th>Ends</th></tr>";
  sessionsArr.forEach(s => {
    const date = s.date ? new Date(s.date.seconds * 1000).toLocaleDateString() : "N/A";
    table.innerHTML += `<tr><td>${date}</td><td>${s.totalScore}</td><td>${s.ends.length}</td></tr>`;
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
  document.getElementById("menuToggleBtn")?.addEventListener("click", () => alert("Theme toggle not implemented"));
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
  archerList.innerHTML = "";

  const usersQuery = query(collection(db, "users"), where("role", "==", "archer"));
  const snapshot = await getDocs(usersQuery);
  if(snapshot.empty){
    archerList.innerHTML = "<li>No archers found</li>";
    return;
  }
  snapshot.forEach(docSnap => {
    const archer = docSnap.data();
    const li = document.createElement("li");
    li.textContent = archer.name;
    li.style.cursor = "pointer";
    li.style.padding = "5px";
    li.style.borderBottom = "1px solid #555";
    li.addEventListener("click", () => {
      selectedArcherUID = docSnap.id;
      selectedArcherName = archer.name;
      document.getElementById("selectedArcherName").innerText = selectedArcherName;
      loadArcherSessionHistory(selectedArcherUID);
    });
    archerList.appendChild(li);
  });
}

async function loadArcherSessionHistory(archerUID) {
  const sessionDiv = document.getElementById("archerSessionHistoryTable");
  sessionDiv.innerHTML = "Loading...";
  try {
    const userDoc = await getDoc(doc(db, "users", archerUID));
    if(!userDoc.exists()){
      sessionDiv.innerHTML = "Archer not found";
      return;
    }
    const sessionsObj = userDoc.data().sessions || {};
    const sessionsArr = Object.values(sessionsObj);
    if(sessionsArr.length === 0){
      sessionDiv.innerHTML = "No sessions found";
      return;
    }
    
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.innerHTML = "<tr><th>Date</th><th>Total Score</th><th>Ends</th></tr>";
    sessionsArr.forEach(s => {
      const date = s.date ? new Date(s.date.seconds * 1000).toLocaleDateString() : "N/A";
      table.innerHTML += `<tr><td>${date}</td><td>${s.totalScore}</td><td>${s.ends.length}</td></tr>`;
    });
    sessionDiv.innerHTML = "";
    sessionDiv.appendChild(table);
  } catch(e) {
    sessionDiv.innerHTML = "Error loading sessions";
    console.error(e);
  }
}

function showCoachDashboard(){
  if(currentUserRole !== "coach"){
    alert("Access denied. Coach area only.");
    return;
  }
  showScreen("coachDashboard");
  loadArchersList();
}

document.getElementById("coachBackBtn")?.addEventListener("click", () => showScreen("menuScreen"));

// Initialization
window.addEventListener("DOMContentLoaded", () => {
  attachButtonHandlers();
  updateSessionSetupOptions();
  drawTarget();
  updateEndScores();
  updateEndSessionButtons();
});
