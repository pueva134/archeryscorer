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
let sessionDataForResults = null; // holds last session for results display

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
    { color: "#FFFFFF", radius: radius },
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
  console.log("Ends accumulated so far:", currentSession.ends.length);
  if(currentEndNumber === currentSession.endsCount){
    console.log("All ends completed. Ready to save full session.");
    return;
  }
  currentEndNumber++;
  document.getElementById("currentEnd").innerText = currentEndNumber;
}

// Save session to Firestore (called only after entire session completes)
async function saveSession() {
  if(!currentUser) return;
  console.log("Saving full session with ends count:", currentSession.ends.length);
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
    sessionDataForResults = newSession;
  } catch (e) {
    console.error("Failed to save session:", e);
  }
}

// End session and save all data once complete, then show results page
async function endSession() {
  if (arrowScores.length > 0 && arrowScores.length !== currentSession.arrowsPerEnd) {
    alert(`Please score all arrows in End ${currentEndNumber} before ending session.`);
    return;
  }
  if (arrowScores.length === currentSession.arrowsPerEnd) {
    currentSession.ends.push([...arrowScores]);
    currentSession.totalScore += arrowScores.filter(s => typeof s === "number").reduce((a,b)=>a+b,0);
    arrowScores = [];
    console.log("Final end pushed in endSession");
  }
  if (currentSession.ends.length > 0) {
    await saveSession();
    showSessionResults(sessionDataForResults);
    return;
  }
  currentSession = {};
  arrowScores = [];
  currentEndNumber = 1;
  showScreen("menuScreen");
}

// Show session results screen with table and chart
function showSessionResults(sessionData) {
  showScreen("results");
  const summaryDiv = document.getElementById("sessionSummary");
  const tableDiv = document.getElementById("scoreTable");
  const chartCanvas = document.getElementById("scoreChart");

  summaryDiv.innerHTML = `
    <p><strong>Bow Style:</strong> ${sessionData.bowStyle}</p>
    <p><strong>Distance:</strong> ${sessionData.distance}m</p>
    <p><strong>Target Face:</strong> ${sessionData.targetFace}</p>
    <p><strong>Total Score:</strong> ${sessionData.totalScore}</p>
    <p><strong>Ends:</strong> ${sessionData.ends.length}</p>
  `;

  let tableHtml = "<table style='width: 100%; border-collapse: collapse;'><tr><th>End</th>";
  const arrowsCount = sessionData.arrowsPerEnd || (sessionData.ends[0]?.arrows.length || 0);
  for(let i=1;i<=arrowsCount;i++) tableHtml += `<th>Arrow ${i}</th>`;
  tableHtml += "<th>End Total</th></tr>";

  sessionData.ends.forEach((endObj, idx) => {
    const arr = endObj.arrows || [];
    const endTotal = arr.filter(s => typeof s === "number").reduce((a,b)=>a+b,0);
    let row = `<tr><td>${idx+1}</td>`;
    for(let i=0; i<arrowsCount; i++) row += `<td>${arr[i]??""}</td>`;
    row += `<td>${endTotal}</td></tr>`;
    tableHtml += row;
  });
  tableHtml += "</table>";
  tableDiv.innerHTML = tableHtml;

  if(window.sessionChartInstance) window.sessionChartInstance.destroy();

  const endTotals = sessionData.ends.map(end =>
    (end.arrows || []).filter(s => typeof s === 'number').reduce((a,b) => a+b, 0)
  );

  window.sessionChartInstance = new Chart(chartCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: sessionData.ends.map((_,i)=>`End ${i+1}`),
      datasets: [{
        label: 'End Total',
        data: endTotals,
        backgroundColor: 'rgba(59,130,246,0.7)'
      }]
    },
    options: { responsive:true, maintainAspectRatio:false }
  });
}

// Export session results as CSV
function exportCsv() {
  if(!sessionDataForResults) {
    alert("No session data available to export.");
    return;
  }
  const arrowsCount = sessionDataForResults.arrowsPerEnd || (sessionDataForResults.ends[0]?.arrows.length || 0);
  let csv = "End," + Array.from({length: arrowsCount}, (_,i)=>`Arrow ${i+1}`).join(",") + "\n";
  sessionDataForResults.ends.forEach((end, idx) => {
    const row = [idx+1, ...end.arrows.map(s => (typeof s==="number"?s:"M"))];
    csv += row.join(",") + "\n";
  });
  const blob = new Blob([csv], {type: "text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `archery-session-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function attachButtonHandlers() {
  document.getElementById("signupBtn")?.addEventListener("click", signup);
  document.getElementById("loginBtn")?.addEventListener("click", login);
  document.getElementById("menuStartBtn")?.addEventListener("click", ()=>showScreen("setup"));
  document.getElementById("menuHistoryBtn")?.addEventListener("click", viewHistory);
  document.getElementById("menuLogoutBtn")?.addEventListener("click", ()=>signOut(auth).then(()=>showScreen("loginPage")));
  document.getElementById("startSessionBtn")?.addEventListener("click", startSession);
  document.getElementById("viewHistoryBtn")?.addEventListener("click", viewHistory);
  document.getElementById("logoutBtn")?.addEventListener("click", ()=>signOut(auth).then(()=>showScreen("loginPage")));
  document.getElementById("undoBtn")?.addEventListener("click", undoLastArrow);
  document.getElementById("nextEndBtn")?.addEventListener("click", nextEnd);
  document.getElementById("endSessionBtn")?.addEventListener("click", endSession);
  document.getElementById("backToSetupBtn")?.addEventListener("click", ()=>{
    arrowScores = [];
    currentSession = {};
    currentEndNumber = 1;
    showScreen("setup");
    drawTarget();
    updateEndScores();
    updateEndSessionButtons();
  });
  document.getElementById("backToMenuBtn")?.addEventListener("click", ()=>showScreen("menuScreen"));
  document.getElementById("newSessionBtn")?.addEventListener("click", ()=>{
    currentSession = {};
    arrowScores = [];
    currentEndNumber = 1;
    showScreen("setup");
  });
  document.getElementById("exportCsvBtn")?.addEventListener("click", exportCsv);
  if(canvas) canvas.addEventListener("click", handleCanvasScoreClick);
}

// View history, coach dashboard, load archers, load archer sessions, display session results etc. remain unchanged.

// Auth state listener remains unchanged

window.addEventListener("DOMContentLoaded", () => {
  attachButtonHandlers();
  updateSessionSetupOptions();
  drawTarget();
  updateEndScores();
  updateEndSessionButtons();
});
