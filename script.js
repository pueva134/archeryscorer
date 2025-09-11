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
// ------------------------------
let currentUser = null;
let currentSession = {};
let arrowScores = [];
let currentEndNumber = 1;

// ------------------------------
// Utility Functions
// ------------------------------
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if(target) target.classList.add('active');
}

// ------------------------------
// Canvas Target Drawing
// ------------------------------
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
// Auth State Listener
// ------------------------------
onAuthStateChanged(auth, async user => {
  currentUser = user;
  if(user){
    try {
      const userDoc = await getDoc(doc(db,"users",user.uid));
      if(userDoc.exists()){
        const username = userDoc.data().name;
        document.querySelector(".container").querySelector("h1").innerHTML = `🏹 My Scorer 🏹<br><span style="font-size:1rem;">Hello, ${username}!</span>`;
      }
    } catch{}
    showScreen("setup");
  } else {
    document.querySelector(".container").querySelector("h1").innerHTML = "🏹 My Scorer 🏹";
    showScreen("loginPage");
  }
});

// ------------------------------
// Signup Function
// ------------------------------
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
    await setDoc(doc(db,"users",uid), {
      name: username,
      role,
      sessions: {}
    });
    currentUser = userCredential.user;
    msgDiv.innerText = "Signup successful! Please login.";
    showScreen("loginPage");
  } catch(e) {
    msgDiv.innerText = e.message;
  }
}

// ------------------------------
// Login Function
// ------------------------------
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
    await signInWithEmailAndPassword(auth,email,password);
  } catch(e) {
    msgDiv.innerText = e.message;
  }
}

// ------------------------------
// Session Control Functions
// ------------------------------
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
  if(arrowScores.length !== currentSession.arrowsPerEnd) {
    alert("Shoot all arrows first!");
    return;
  }
  currentSession.ends.push([...arrowScores]);
  currentSession.totalScore += arrowScores.reduce((a,b)=>a+b,0);
  arrowScores = [];
  updateEndScores();
  if(currentEndNumber === currentSession.endsCount) {
    updateEndSessionButtons();
    return;
  }
  currentEndNumber++;
  document.getElementById("currentEnd").innerText = currentEndNumber;
  updateEndScores();
  updateEndSessionButtons();
}

// ------------------------------
// Session Save and End Functions
// ------------------------------
async function saveSession() {
  if(!currentUser) return;
  const uid = currentUser.uid;
  const userRef = doc(db,"users",uid);
  const sessionKey = Date.now().toString();
  const safeSession = {
    bowStyle: currentSession.bowStyle,
    distance: currentSession.distance,
    targetFace: currentSession.targetFace,
    arrowsPerEnd: currentSession.arrowsPerEnd,
    endsCount: currentSession.endsCount,
    ends: currentSession.ends.map(arr => Array.isArray(arr) ? [...arr] : arr),
    totalScore: currentSession.totalScore,
    date: Timestamp.now()
  };
  console.log("Saving session for user", uid);
  console.log("Session key:", sessionKey);
  console.log("Session data:", safeSession);
  try {
    await updateDoc(userRef, {
      [`sessions.${sessionKey}`]: safeSession
    });
    console.log("Session saved!");
  } catch(e) {
    console.error("Error saving session:", e);
  }
}

async function endSession() {
  try {
    if(currentUser && currentSession && currentSession.ends.length > 0) {
      await saveSession();
    }
  } catch (e) {
    // Silent catch, no alert, just log
    console.error("Failed to save session on end:", e);
  }
  currentEndNumber = 1;
  currentSession = {};
  arrowScores = [];
  showScreen("setup");
}

// ------------------------------
// View History Function
// ------------------------------
async function viewHistory() {
  if(!currentUser) return;
  const uid = currentUser.uid;
  const userDoc = await getDoc(doc(db,"users",uid));
  if(userDoc.exists()){
    const sessionsMap = userDoc.data().sessions || {};
    const sessions = Object.values(sessionsMap);
    const table = document.createElement("table");
    table.innerHTML = `<tr><th>Date</th><th>Total Score</th><th>Ends</th></tr>`;
    sessions.forEach(s=>{
      const date = s.date ? new Date(s.date.seconds*1000).toLocaleDateString() : "N/A";
      table.innerHTML += `<tr><td>${date}</td><td>${s.totalScore}</td><td>${s.ends.length}</td></tr>`;
    });
    const historyDiv = document.getElementById("historyTable");
    historyDiv.innerHTML = "";
    historyDiv.appendChild(table);
    showScreen("historyScreen");
  }
}

// ------------------------------
// Other utility and event handlers remain unchanged...
// Attach handlers and initialize canvas
function attachButtonHandlers(){
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
    const center = canvas.width/2;
    const dist = Math.sqrt(Math.pow(x-center,2)+Math.pow(y-center,2));
    let score=0;
    if(dist<30) score=10;
    else if(dist<60) score=8;
    else if(dist<90) score=6;
    else if(dist<120) score=4;
    else score=1;
    arrowScores.push(score);
    updateEndScores();
    updateEndSessionButtons();
  });
}

function backToSetup(){
  currentEndNumber = 1;
  arrowScores = [];
  currentSession = {};
  showScreen("setup");
  drawTarget();
  updateEndScores();
}

function init(){
  attachButtonHandlers();
  drawTarget();
  updateEndScores();
  updateSessionSetupOptions();
}

window.addEventListener("DOMContentLoaded", init);
