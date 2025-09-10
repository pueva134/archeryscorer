import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, Timestamp,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import Chart from "https://cdn.jsdelivr.net/npm/chart.js@4.3.0/dist/chart.umd.min.js";

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

// Enable offline persistence (optional)
enableIndexedDbPersistence(db).catch(err => {
  console.error("Persistence error:", err);
});

let currentUser = null;
let currentSession = {};
let arrowScores = [];
let currentEndNumber = 1;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

const canvas = document.getElementById("target");
const ctx = canvas?.getContext("2d");

function drawTarget() {
  if(!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const colors = ['rgba(255, 255, 255, 1)','rgba(0, 0, 0, 1)','rgba(0, 140, 255, 1)','rgba(255, 0, 0, 1)','rgba(255, 255, 43, 1)'];
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

onAuthStateChanged(auth, user => {
  if(user) currentUser = user;
  else currentUser = null;
});

// ------------------------------
// Safe Firestore Getter
// ------------------------------
async function safeGetDoc(docRef) {
  try {
    const docSnap = await getDoc(docRef);
    return docSnap;
  } catch (e) {
    if (e.message && e.message.includes('offline')) {
      alert("You appear to be offline. Please check your connection and try again.");
    } else {
      console.error(e);
      alert("An unexpected error occurred.");
    }
    return null;
  }
}

async function signup(){
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
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
      role: role,
      sessions: []
    });
    currentUser = userCredential.user;
    document.querySelector(".container").querySelector("h1").innerHTML = `🏹 My Scorer 🏹<br><span style="font-size:1rem;">Hello, ${username}!</span>`;
    msgDiv.innerText = "Signup successful!";
    showScreen("setup");
  } catch(e) {
    msgDiv.innerText = e.message;
    console.error("Signup error:", e);
  }
}

async function login(){
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const msgDiv = document.getElementById("loginMessage");
  msgDiv.innerText = "";

  if(!email || !password){
    msgDiv.innerText = "Please enter email and password!";
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    currentUser = userCredential.user;
    const userDoc = await safeGetDoc(doc(db, "users", currentUser.uid));
    const username = userDoc && userDoc.exists() ? userDoc.data().name : "";
    document.querySelector(".container").querySelector("h1").innerHTML = `🏹 My Scorer 🏹<br><span style="font-size:1rem;">Hello, ${username}!</span>`;
    msgDiv.innerText = "Login successful!";
    showScreen("setup");
  } catch(e) {
    msgDiv.innerText = e.message;
    console.error("Login error:", e);
  }
}

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
}

function undoLastArrow(){
  arrowScores.pop();
  updateEndScores();
}

async function nextEnd() {
  if (arrowScores.length !== currentSession.arrowsPerEnd) {
    alert("Shoot all arrows first!");
    return;
  }

  currentSession.ends.push([...arrowScores]);
  currentSession.totalScore += arrowScores.reduce((a, b) => a + b, 0);

  arrowScores = [];

  if (currentEndNumber === currentSession.endsCount) {
    await saveSession();
    showResults();
    currentEndNumber = 1;
    currentSession = {};
    arrowScores = [];
    return;
  }
  if (currentEndNumber < currentSession.endsCount) {
    currentEndNumber++;
    document.getElementById("currentEnd").innerText = currentEndNumber;
    updateEndScores();
  }
}

async function saveSession(){
  if(!currentUser) return;
  const uid = currentUser.uid;
  const userRef = doc(db,"users",uid);
  await updateDoc(userRef,{
    sessions: arrayUnion({...currentSession, date: Timestamp.now()})
  });
}

function showResults(){
  showScreen("results");
  const summaryDiv = document.getElementById("sessionSummary");
  summaryDiv.innerHTML = `
    <p>Bow: ${currentSession.bowStyle}</p>
    <p>Distance: ${currentSession.distance}m</p>
    <p>Total Score: ${currentSession.totalScore}</p>
    <p>Ends Count: ${currentSession.endsCount}</p>
  `;

  const scoreTableDiv = document.getElementById("scoreTable");
  const table = document.createElement("table");
  const header = document.createElement("tr");
  header.innerHTML = "<th>End</th>" + [...Array(currentSession.arrowsPerEnd)].map((_,i)=>`<th>Arrow ${i+1}</th>`).join('') + "<th>End Total</th>";
  table.appendChild(header);

  currentSession.ends.forEach((end,i)=>{
    const row = document.createElement("tr");
    const endTotal = end.reduce((a,b)=>a+b,0);
    row.innerHTML = `<td>${i+1}</td>` + end.map(a=>`<td>${a}</td>`).join('') + `<td>${endTotal}</td>`;
    table.appendChild(row);
  });

  scoreTableDiv.innerHTML = "";
  scoreTableDiv.appendChild(table);

  const ctxChart = document.getElementById("scoreChart").getContext("2d");
  new Chart(ctxChart, {
    type: 'bar',
    data: {
      labels: currentSession.ends.map((_,i)=>`End ${i+1}`),
      datasets: [{label: 'End Total', data: currentSession.ends.map(e=>e.reduce((a,b)=>a+b,0)), backgroundColor: 'rgba(59,130,246,0.7)'}]
    },
    options: {responsive:true, maintainAspectRatio:false}
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

async function viewHistory(){
  if(!currentUser) return;
  const uid = currentUser.uid;
  const userDoc = await safeGetDoc(doc(db,"users",uid));
  if(userDoc && userDoc.exists()){
    const sessions = userDoc.data().sessions || [];
    const table = document.createElement("table");
    table.innerHTML = `<tr><th>Date</th><th>Total Score</th><th>Ends</th></tr>`;
    sessions.forEach(s=>{
      const dateObj = typeof s.date === "object" && s.date.seconds ? new Date(s.date.seconds * 1000) : new Date();
      const date = dateObj.toLocaleDateString();
      const ends = Array.isArray(s.ends) ? s.ends.length : 0;
      table.innerHTML += `<tr><td>${date}</td><td>${s.totalScore}</td><td>${ends}</td></tr>`;
    });
    const historyDiv = document.getElementById("historyTable");
    historyDiv.innerHTML = "";
    historyDiv.appendChild(table);
    showScreen("historyScreen");
  } else {
    alert('History could not be loaded.');
  }
}

function updateSessionSetupOptions() {
  const bowDistances = {
    Recurve: [10,12,15,18,20,30,40,50,60,70],
    Compound: [10,12,15,18,30,50],
    Barebow: [10,12,15,18,30],
    Longbow: [10,12,15,18,30]
  };

  const bowTargetFaces = {
    Compound: [
    {value:"60", label:"60cm (Compound Only)"}, 
    {value:"40", label:"40cm (Indoor)"},
    {value:"3spot", label:"40cm 3-Spot (Indoor)"},
    {value:"9spot", label:"40cm 9-Spot (Indoor)"}
    ],
    default: [
      {value:"122", label:"122cm (Outdoor)"},
      {value:"80", label:"80cm (Outdoor)"},
      {value:"40", label:"40cm (Indoor)"},
      {value:"3spot", label:"40cm 3-Spot (Indoor)"},
      {value:"9spot", label:"40cm 9-Spot (Indoor)"}
    ]
  };

  const bowSelect = document.getElementById("bowStyle");
  const distSelect = document.getElementById("distance");
  const faceSelect = document.getElementById("targetFace");

  function refreshOptions() {
    const bow = bowSelect.value;

    distSelect.innerHTML = "";
    bowDistances[bow].forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d + "m";
      distSelect.appendChild(opt);
    });

    faceSelect.innerHTML = "";
    const faces = bow === "Compound" ? bowTargetFaces.Compound : bowTargetFaces.default;
    faces.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.value;
      opt.textContent = f.label;
      faceSelect.appendChild(opt);
    });
  }

  bowSelect.addEventListener("change", refreshOptions);
  refreshOptions();
}

function attachButtonHandlers() {
  document.getElementById("signupBtn")?.addEventListener("click", signup);
  document.getElementById("loginBtn")?.addEventListener("click", login);
  document.getElementById("startSessionBtn")?.addEventListener("click", startSession);
  document.getElementById("viewHistoryBtn")?.addEventListener("click", viewHistory);
  document.getElementById("undoBtn")?.addEventListener("click", undoLastArrow);
  document.getElementById("nextEndBtn")?.addEventListener("click", nextEnd);
  document.getElementById("backToSetupBtn")?.addEventListener("click", backToSetup);
  document.getElementById("backToMenuBtn")?.addEventListener("click", () => showScreen("setup"));

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
  });
}

function init() {
  attachButtonHandlers();
  drawTarget();
  updateEndScores();
  updateSessionSetupOptions();
}

window.addEventListener("DOMContentLoaded", init);
