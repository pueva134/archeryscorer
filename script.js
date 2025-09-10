import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentSession = {};
let arrowScores = [];
let currentEndNumber = 1;

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function updateEndScores() {
  document.getElementById("endScores").innerText = arrowScores.join(" | ");
  document.getElementById("endTotal").innerText = "End Total: " + arrowScores.reduce((a,b)=>a+b,0);
}

function updateEndSessionButton() {
  const endSessionBtn = document.getElementById("endSessionBtn");
  if (currentEndNumber === currentSession.endsCount) {
    endSessionBtn.style.display = "inline-block";
  } else {
    endSessionBtn.style.display = "none";
  }
}

function updateEndUI() {
  document.getElementById("currentEnd").innerText = currentEndNumber;
  updateEndScores();
  updateEndSessionButton();
}

async function signup() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const msgDiv = document.getElementById("loginMessage");
  msgDiv.innerText = "";

  if (!email || !password) {
    msgDiv.innerText = "Please fill all fields!";
    return;
  }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth,email,password);
    currentUser = userCredential.user;
    msgDiv.innerText = "Signup successful!";
    showScreen("setup");
  } catch(e) {
    msgDiv.innerText = e.message;
  }
}

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const msgDiv = document.getElementById("loginMessage");
  msgDiv.innerText = "";

  if (!email || !password) {
    msgDiv.innerText = "Please fill all fields!";
    return;
  }
  try {
    const userCredential = await signInWithEmailAndPassword(auth,email,password);
    currentUser = userCredential.user;
    msgDiv.innerText = "Login successful!";
    showScreen("setup");
  } catch(e) {
    msgDiv.innerText = e.message;
  }
}

onAuthStateChanged(auth,user=>{
  if(user){
    currentUser=user;
    showScreen("setup");
  } else {
    showScreen("loginScreen");
  }
});

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
  updateEndUI();
  showScreen("scoringArea");
}

function undoLastArrow() {
  if(arrowScores.length > 0){
    arrowScores.pop();
  }
  updateEndScores();
}

async function nextEnd() {
  if(arrowScores.length !== currentSession.arrowsPerEnd){
    alert("Shoot all arrows first!");
    return;
  }
  currentSession.ends.push([...arrowScores]);
  currentSession.totalScore += arrowScores.reduce((a,b)=>a+b,0);
  arrowScores = [];
  if(currentEndNumber === currentSession.endsCount){
    await saveSession();
    showResults();
    currentEndNumber = 1;
    currentSession = {};
    arrowScores = [];
  } else {
    currentEndNumber++;
    updateEndUI();
  }
}

async function endSession() {
  if(arrowScores.length > 0){
    currentSession.ends.push([...arrowScores]);
    currentSession.totalScore += arrowScores.reduce((a,b)=>a+b,0);
    arrowScores = [];
  }
  await saveSession();
  showResults();
  currentEndNumber = 1;
  currentSession = {};
  arrowScores = [];
}

async function saveSession() {
  if(!currentUser) return;
  const uid = currentUser.uid;
  const userRef = doc(db,"users",uid);
  await updateDoc(userRef,{
    sessions: arrayUnion({...currentSession, date: Timestamp.now()})
  });
}

function showResults() {
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
}

// Event handlers
document.getElementById("signupBtn").addEventListener("click",signup);
document.getElementById("loginBtn").addEventListener("click",login);
document.getElementById("startSessionBtn").addEventListener("click",startSession);
document.getElementById("undoBtn").addEventListener("click",undoLastArrow);
document.getElementById("nextEndBtn").addEventListener("click",nextEnd);
document.getElementById("endSessionBtn").addEventListener("click",endSession);
document.getElementById("backToSetupBtn").addEventListener("click",()=>showScreen("setup"));

