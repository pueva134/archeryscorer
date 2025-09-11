// ------------------------------
// script.js (Module)
// ------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
// ------------------------------
// Firebase Config and Initialization
// ------------------------------
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
// ------------------------------
// Global Variables
let currentUser = null;
let currentSession = {};
let arrowScores = [];
let currentEndNumber = 1;
// ------------------------------
// Utility Functions
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if(target) target.classList.add('active');
}
// ------------------------------
// Canvas and scoring utilities
const canvas = document.getElementById("target");
const ctx = canvas?.getContext("2d");
function drawTarget() {
  if(!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const colors = ['rgba(255,255,255,1)','rgba(0,0,0,1)','rgba(0,140,255,1)','rgba(255,0,0,1)','rgba(255,255,43,1)'];
  let radius = canvas.width / 2;
  for (let i=0;i<colors.length;i++){
    ctx.beginPath();
    ctx.arc(radius, radius, radius - i*30, 0, 2*Math.PI);
    ctx.fillStyle = colors[i];
    ctx.fill();
  }
}
function updateEndScores(){
  const endScoresDiv = document.getElementById("endScores");
  const endTotalDiv = document.getElementById("endTotal");
  if(endScoresDiv) endScoresDiv.innerText = arrowScores.join(" | ");
  if(endTotalDiv) endTotalDiv.innerText = "End Total: " + arrowScores.reduce((a,b)=>a+b,0);
}
// ------------------------------
// Auth Listener with UI updates
onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const username = userDoc.data().name;
        document.querySelector(".container").querySelector("h1").innerHTML = `🏹 My Scorer 🏹<br><span style="font-size:1rem;">Hello, ${username}!</span>`;
      }
    } catch(e) {}
    showScreen("setup");
  } else {
    document.querySelector(".container").querySelector("h1").innerHTML = "🏹 My Scorer 🏹";
    showScreen("loginPage");
  }
});
// ------------------------------
// Signup Function
async function signup(){
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;
  const msgDiv = document.getElementById("loginMessage");
  msgDiv.innerText = "";
  if(!username || !email || !password){
    msgDiv.innerText = "Please fill all fields!";
    return;
  }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    await setDoc(doc(db, "users", uid), {
      name: username,
      role,
      sessions: {}
    });
    currentUser = userCredential.user;
    msgDiv.innerText = "Signup successful! Please login.";
    showScreen("loginPage");
  } catch(e) {
    msgDiv.innerText = e.message;
    console.error("Signup error:", e);
  }
}
// ------------------------------
// Login Function
async function login(){
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msgDiv = document.getElementById("loginMessage");
  msgDiv.innerText = "";
  if(!email || !password){
    msgDiv.innerText = "Please enter email and password!";
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch(e) {
    msgDiv.innerText = e.message;
    console.error("Login error:", e);
  }
}
// ------------------------------
// Session control functions
function startSession(){
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
  document.getElementById("nextEndBtn").style.display = "inline-block";
  if(document.getElementById("endSessionBtn")) {
    document.getElementById("endSessionBtn").style.display = "none";
  }
}
function undoLastArrow(){
  arrowScores.pop();
  updateEndScores();
  updateEndSessionButtons();
}
function updateEndSessionButtons() {
  const nextEndBtn = document.getElementById("nextEndBtn");
  const endSessionBtn = document.getElementById("endSessionBtn");
  const lastEnd = currentEndNumber === currentSession.endsCount;
  const arrowsComplete = arrowScores.length === currentSession.arrowsPerEnd;
  if(lastEnd && arrowsComplete) {
    if(nextEndBtn) nextEndBtn.style.display = "none";
    if(endSessionBtn) endSessionBtn.style.display = "inline-block";
  } else {
    if(nextEndBtn) nextEndBtn.style.display = "inline-block";
    if(endSessionBtn) endSessionBtn.style.display = "none";
  }
}
async function nextEnd() {
  if (arrowScores.length !== currentSession.arrowsPerEnd) {
    alert("Shoot all arrows first!");
    return;
  }
  currentSession.ends.push([...arrowScores]);
  currentSession.totalScore += arrowScores.reduce((a, b) => a + b, 0);
  arrowScores = [];
  updateEndScores();
  if (currentEndNumber === currentSession.endsCount) {
    updateEndSessionButtons();
    return;
  }
  currentEndNumber++;
  document.getElementById("currentEnd").innerText = currentEndNumber;
  updateEndScores();
  updateEndSessionButtons();
}
// ------------------------------
// Updated saveSession to save sessions as a map using a unique timestamp key
async function saveSession() {
  if (!currentUser) return;
  const uid = currentUser.uid;
  const userRef = doc(db, "users", uid);
  const safeSession = {
    bowStyle: currentSession.bowStyle,
    distance: currentSession.distance,
    targetFace: currentSession.targetFace,
    arrowsPerEnd: currentSession.arrowsPerEnd,
    endsCount: currentSession.endsCount,
    // Ensure ends is an array of arrays of numbers (map safe)
    ends: currentSession.ends.map(end => Array.isArray(end) ? [...end] : end),
    totalScore: currentSession.totalScore,
    date: Timestamp.now()
  };
  const sessionKey = Date.now().toString();
  console.log("Saving session for user", uid);
  console.log("Session key:", sessionKey);
  console.log("Session data:", safeSession);
  try {
    await updateDoc(userRef, {
      [`sessions.${sessionKey}`]: safeSession
    });
    console.log("Session saved!");
  } catch (e) {
    console.error("Error saving session:", e);
  }
}
// ------------------------------
// End session with silent catch and reset UI
async function endSession() {
  try {
    if (currentUser && currentSession && currentSession.ends.length > 0) {
      await saveSession();
    }
  } catch (e) {
    console.error("Failed to save session:", e);
  }
  currentEndNumber = 1;
  currentSession = {};
  arrowScores = [];
  showScreen("setup");
}
// ------------------------------
// Show results function remains unchanged
function showResults(){
  // ... your existing showResults code ...
}
// ------------------------------
// Back to setup function remains unchanged
function backToSetup(){
  currentEndNumber = 1;
  arrowScores = [];
  currentSession = {};
  showScreen("setup");
  drawTarget();
  updateEndScores();
}
// ------------------------------
// View History updated for sessions as map data
async function viewHistory(){
  if(!currentUser) return;
  const uid = currentUser.uid;
  const userDoc = await getDoc(doc(db,"users",uid));
  if(userDoc.exists()){
    const sessionsObj = userDoc.data().sessions || {};
    const sessionsArr = Object.values(sessionsObj);
    const table = document.createElement("table");
    table.innerHTML = `<tr><th>Date</th><th>Total Score</th><th>Ends</th></tr>`;
    sessionsArr.forEach(s => {
      const date = s.date ? new Date(s.date.seconds * 1000).toLocaleDateString() : "N/A";
      table.innerHTML += `<tr><td>${date}</td><td>${s.totalScore}</td><td>${s.ends?.length ?? 0}</td></tr>`;
    });
    const historyDiv = document.getElementById("historyTable");
    historyDiv.innerHTML = "";
    historyDiv.appendChild(table);
    showScreen("historyScreen");
  }
}
// ------------------------------
// Update options for session setup dropdowns with requested adjustments
function updateSessionSetupOptions() {
  const bowDistances = {
    Recurve: [10,12,15,18,20,30,40,50,60,70,80],
    Compound: [10,12,15,18,20,30,40,50],
    Barebow: [10,12,15,18,20,30],
    Longbow: [10,12,15,18,20,30]
  };
  const bowTargetFaces = {
    Compound: [
      {value:"60", label:"60cm (Compound Only)"},
      {value:"40", label:"40cm (Indoor)"},
      {value:"3spot", label:"40cm 3-Spot (Indoor)"},
      {value:"9spot", label:"40cm 9-Spot (Indoor)"}
    ],
    indoorOnly: [
      {value:"40", label:"40cm (Indoor)"},
      {value:"3spot", label:"40cm 3-Spot (Indoor)"},
      {value:"9spot", label:"40cm 9-Spot (Indoor)"}
    ],
    outdoorOnly: [
      {value:"122", label:"122cm (Outdoor)"},
      {value:"80", label:"80cm (Outdoor)"}
    ]
  };
  const bowSelect = document.getElementById("bowStyle");
  const distSelect = document.getElementById("distance");
  const faceSelect = document.getElementById("targetFace");
  function refreshOptions() {
    const bow = bowSelect.value;
    const distance = parseInt(distSelect.value);
    distSelect.innerHTML = "";
    bowDistances[bow].forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d + "m";
      distSelect.appendChild(opt);
    });
    faceSelect.innerHTML = "";
    let faces = null;
    if(distance <= 18) {
      // Indoor faces only for ≤18m
      faces = bow === "Compound" ? bowTargetFaces.Compound : bowTargetFaces.indoorOnly;
    } else {
      // Outdoor+Indoor for 20m and above
      faces = bow === "Compound" ? bowTargetFaces.Compound : bowTargetFaces.outdoorOnly.concat(bowTargetFaces.indoorOnly);
    }
    faces.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.value;
      opt.textContent = f.label;
      faceSelect.appendChild(opt);
    });
  }
  bowSelect.addEventListener("change", refreshOptions);
  distSelect.addEventListener("change", refreshOptions);
  refreshOptions();
}
// ------------------------------
// Attach event handlers and initialize everything
function attachButtonHandlers() {
  document.getElementById("signupBtn")?.addEventListener("click", signup);
  document.getElementById("loginBtn")?.addEventListener("click", login);
  document.getElementById("startSessionBtn")?.addEventListener("click", startSession);
  document.getElementById("viewHistoryBtn")?.addEventListener("click", viewHistory);
  document.getElementById("undoBtn")?.addEventListener("click", undoLastArrow);
  document.getElementById("nextEndBtn")?.addEventListener("click", nextEnd);
  document.getElementById("backToSetupBtn")?.addEventListener("click", backToSetup);
  document.getElementById("backToMenuBtn")?.addEventListener("click", () => showScreen("setup"));
  if(document.getElementById("endSessionBtn")){
    document.getElementById("endSessionBtn").addEventListener("click", endSession);
  }
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    auth.signOut().then(() => {
      showScreen("loginPage");
    });
  });
  canvas?.addEventListener("click", e => {
    if(!currentSession.arrowsPerEnd) return;
    if(arrowScores.length >= currentSession.arrowsPerEnd){
      alert("All arrows for this end have been scored.");
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const center = canvas.width / 2;
    const dist = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
    let score = 0;
    if(dist < 30) score = 10;
    else if(dist < 60) score = 8;
    else if(dist < 90) score = 6;
    else if(dist < 120) score = 4;
    else score = 1;
    arrowScores.push(score);
    updateEndScores();
    updateEndSessionButtons();
  });
}
function init() {
  attachButtonHandlers();
  drawTarget();
  updateEndScores();
  updateSessionSetupOptions();
}
window.addEventListener("DOMContentLoaded", init);
