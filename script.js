// ------------------------------
// script.js (Module) - Extended Features
// ------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { 
  getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, Timestamp 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// ------------------------------
// Firebase Config (unchanged)
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
const auth = getAuth();
const db = getFirestore(app);

// ------------------------------
// Global Variables
// ------------------------------
let currentUser = null;
let currentSession = {};
let arrowScores = [];
let arrowNotes = [];
let currentEndNumber = 1;
let streak = 0;
let achievements = [];

// ------------------------------
// Utility Functions
// ------------------------------
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ------------------------------
// Canvas Target
// ------------------------------
const canvas = document.getElementById("target");
const ctx = canvas?.getContext("2d");

function drawTarget() {
  if(!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const colors = ['#f00','#f90','#ff0','#0f0','#00f'];
  const radius = canvas.width / 2;
  for (let i=0;i<colors.length;i++){
    ctx.beginPath();
    ctx.arc(radius, radius, radius - i*30, 0, 2*Math.PI);
    ctx.fillStyle = colors[i];
    ctx.fill();
  }
}

// ------------------------------
// Update Scores Display
// ------------------------------
function updateEndScores(){
  const endScoresDiv = document.getElementById("endScores");
  const endTotalDiv = document.getElementById("endTotal");
  if(endScoresDiv) endScoresDiv.innerText = arrowScores.map((s,i)=>`${s}${arrowNotes[i]?'*':''}`).join(" | ");
  if(endTotalDiv) endTotalDiv.innerText = "End Total: " + arrowScores.reduce((a,b)=>a+b,0);
}

// ------------------------------
// Auth State Listener
// ------------------------------
onAuthStateChanged(auth, user => {
  if(user) currentUser = user;
});

// ------------------------------
// Button Event Handlers
// ------------------------------
function attachButtonHandlers() {
  const signupBtn = document.getElementById("signupBtn");
  const loginBtn = document.getElementById("loginBtn");
  const startSessionBtn = document.getElementById("startSessionBtn");
  const viewHistoryBtn = document.getElementById("viewHistoryBtn");
  const undoBtn = document.getElementById("undoBtn");
  const nextEndBtn = document.getElementById("nextEndBtn");
  const backToSetupBtn = document.getElementById("backToSetupBtn");
  const backToMenuBtn = document.getElementById("backToMenuBtn");
  const msgDiv = document.getElementById("loginMessage");

  signupBtn?.addEventListener("click", signup);
  loginBtn?.addEventListener("click", login);
  startSessionBtn?.addEventListener("click", startSession);
  viewHistoryBtn?.addEventListener("click", viewHistory);
  undoBtn?.addEventListener("click", undoLastArrow);
  nextEndBtn?.addEventListener("click", nextEnd);
  backToSetupBtn?.addEventListener("click", backToSetup);
  backToMenuBtn?.addEventListener("click", () => showScreen("setupScreen"));

  canvas?.addEventListener("click", e => {
    if(!currentSession.arrowsPerEnd) return;
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
    const note = document.getElementById("arrowNote")?.value || "";
    arrowScores.push(score);
    arrowNotes.push(note);
    updateStreak(score);
    updateAchievements();
    updateEndScores();
  });
}

// ------------------------------
// Auth Functions
// ------------------------------
async function signup(){
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;
  const msgDiv = document.getElementById("loginMessage");
  if(!username||!email||!password){ msgDiv.innerText = "Fill all fields!"; return; }
  try{
    const userCredential = await createUserWithEmailAndPassword(auth,email,password);
    const uid = userCredential.user.uid;
    await setDoc(doc(db,"users",uid), { name: username, role: role, sessions: [] });
    currentUser = userCredential.user;
    msgDiv.innerText = "";
    showScreen("setupScreen");
  }catch(e){
    msgDiv.innerText = e.message;
  }
}

async function login(){
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const msgDiv = document.getElementById("loginMessage");
  if(!email||!password){ msgDiv.innerText = "Enter email & password!"; return; }
  try{
    const userCredential = await signInWithEmailAndPassword(auth,email,password);
    currentUser = userCredential.user;
    msgDiv.innerText = "";
    showScreen("setupScreen");
  }catch(e){
    msgDiv.innerText = e.message;
  }
}

// ------------------------------
// Session Functions
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
  arrowNotes = [];
  currentEndNumber = 1;
  streak = 0;
  achievements = [];
  document.getElementById("currentEnd").innerText = currentEndNumber;
  showScreen("scoringScreen");
  drawTarget();
  updateEndScores();
}

// Undo last arrow
function undoLastArrow(){
  arrowScores.pop();
  arrowNotes.pop();
  updateEndScores();
}

// ------------------------------
// Streaks & Achievements
// ------------------------------
function updateStreak(score){
  if(score >= 8){ streak++; }
  else { streak = 0; }
}

function updateAchievements(){
  if(streak >= 3 && !achievements.includes("3-arrow streak")){
    achievements.push("3-arrow streak");
    alert("🏆 3-arrow streak!");
  }
}

// ------------------------------
// End Management
// ------------------------------
async function nextEnd(){
  if(arrowScores.length !== currentSession.arrowsPerEnd){
    alert("Shoot all arrows first!");
    return;
  }
  currentSession.ends.push({ scores:[...arrowScores], notes:[...arrowNotes] });
  currentSession.totalScore += arrowScores.reduce((a,b)=>a+b,0);
  arrowScores = [];
  arrowNotes = [];
  currentEndNumber++;
  if(currentEndNumber > currentSession.endsCount){
    await saveSession();
    showResults();
  } else {
    document.getElementById("currentEnd").innerText = currentEndNumber;
    updateEndScores();
  }
}

// ------------------------------
// Save Session
// ------------------------------
async function saveSession(){
  if(!currentUser) return;
  const uid = currentUser.uid;
  const userRef = doc(db,"users",uid);
  await updateDoc(userRef,{
    sessions: arrayUnion({...currentSession, date: Timestamp.now(), achievements})
  });
}

// ------------------------------
// Results & Chart
// ------------------------------
function showResults(){
  showScreen("resultsScreen");
  const summaryDiv = document.getElementById("sessionSummary");
  summaryDiv.innerHTML = `
    <p>Bow: ${currentSession.bowStyle}</p>
    <p>Distance: ${currentSession.distance}m</p>
    <p>Total Score: ${currentSession.totalScore}</p>
    <p>Achievements: ${achievements.join(", ") || "None"}</p>
  `;

  // Table
  const table = document.createElement("table");
  const header = document.createElement("tr");
  header.innerHTML = "<th>End</th>" + [...Array(currentSession.arrowsPerEnd)].map((_,i)=>`<th>Arrow ${i+1}</th>`).join('') + "<th>End Total</th>";
  table.appendChild(header);
  currentSession.ends.forEach((end,i)=>{
    const row = document.createElement("tr");
    const endTotal = end.scores.reduce((a,b)=>a+b,0);
    row.innerHTML = `<td>${i+1}</td>` + end.scores.map(a=>`<td>${a}</td>`).join('') + `<td>${endTotal}</td>`;
    table.appendChild(row);
  });
  const scoreTableDiv = document.getElementById("scoreTable");
  scoreTableDiv.innerHTML = "";
  scoreTableDiv.appendChild(table);

  // Chart
  const ctxChart = document.getElementById("scoreChart").getContext("2d");
  new Chart(ctxChart, {
    type: 'bar',
    data: {
      labels: currentSession.ends.map((_,i)=>`End ${i+1}`),
      datasets: [{label: 'End Total', data: currentSession.ends.map(e=>e.scores.reduce((a,b)=>a+b,0)), backgroundColor: 'rgba(59,130,246,0.7)'}]
    },
    options: {responsive:true, maintainAspectRatio:false}
  });
}

// ------------------------------
// Navigation
// ------------------------------
function backToSetup(){
  currentEndNumber = 1;
  arrowScores = [];
  arrowNotes = [];
  currentSession = {};
  streak = 0;
  achievements = [];
  showScreen("setupScreen");
  drawTarget();
  updateEndScores();
}

// ------------------------------
// History
// ------------------------------
async function viewHistory(){
  if(!currentUser) return;
  const uid = currentUser.uid;
  const userDoc = await getDoc(doc(db,"users",uid));
  if(userDoc.exists()){
    const sessions = userDoc.data().sessions || [];
    const table = document.createElement("table");
    table.innerHTML = `<tr><th>Date</th><th>Bow</th><th>Distance</th><th>Total Score</th><th>Ends</th></tr>`;
    sessions.forEach(s=>{
      const date = new Date(s.date.seconds*1000).toLocaleDateString();
      table.innerHTML += `<tr><td>${date}</td><td>${s.bowStyle}</td><td>${s.distance}</td><td>${s.totalScore}</td><td>${s.ends.length}</td></tr>`;
    });
    const historyDiv = document.getElementById("historyTable");
    historyDiv.innerHTML = "";
    historyDiv.appendChild(table);
    showScreen("historyScreen");
  }
}

// ------------------------------
// Initialize App
// ------------------------------
function init() {
  attachButtonHandlers();

  // Populate dropdowns
  const bowSelect = document.getElementById("bowStyle");
  const distanceSelect = document.getElementById("distance");
  const targetSelect = document.getElementById("targetFace");
  ["Recurve","Compound"].forEach(b => bowSelect?.appendChild(new Option(b,b)));
  [10,15,18,20,30,50,70].forEach(d => distanceSelect?.appendChild(new Option(d,d)));
  ["Indoor","Outdoor","FITA","3D"].forEach(t => targetSelect?.appendChild(new Option(t,t)));

  drawTarget();
  updateEndScores();
}

window.addEventListener("DOMContentLoaded", init);