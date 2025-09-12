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

const firebaseConfig = {
  // Your config here
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

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  if (id === "scoringArea") drawTarget();
  if (id === "setup") updateSessionSetupOptions();
}

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

function updateEndScores() {
  const scoreDiv = document.getElementById("endScores");
  if (scoreDiv) scoreDiv.innerText = arrowScores.join(" | ");
  const totalDiv = document.getElementById("endTotal");
  if (totalDiv) {
    const total = arrowScores.filter(s => typeof s === "number").reduce((a, b) => a + b, 0);
    totalDiv.innerText = "Total: " + total;
  }
}

function updateButtons() {
  const nextBtn = document.getElementById("nextEndBtn");
  const endBtn = document.getElementById("endSessionBtn");
  const last = currentEndNumber === currentSession.endsCount;
  const complete = arrowScores.length === currentSession.arrowsPerEnd;

  nextBtn.style.display = (!last && complete) ? "inline-block" : "none";
  endBtn.style.display = (last && complete) ? "inline-block" : "none";
}

function handleCanvasClick(e) {
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
  const ringWidth = (canvas.width / 2) / 10;
  let score = "M";

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
  updateButtons();
}

async function signup() {
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;
  const msg = document.getElementById("loginMessage");
  msg.textContent = "";

  if (!username || !email || !password) return msg.textContent = "Please fill all fields!";

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    await setDoc(doc(db, "users", uid), { name: username, role, sessions: {} });
    msg.textContent = "Signup successful! Please login.";
    showScreen("loginPage");
  } catch (e) {
    msg.textContent = e.message;
  }
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("loginMessage");
  msg.textContent = "";

  if (!email || !password) return msg.textContent = "Please enter email and password!";

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    msg.textContent = e.message;
  }
}

function updateSessionSetupOptions() {
  const bowDistances = {
    Recurve: [10,12,15,18,20,30,40,50,60,70,80],
    Compound: [10,12,15,18,20,30,40,50],
    Barebow: [10,12,15,18,20,30],
    Longbow: [10,12,15,18,20,30]
  };
  const bowFaces = {
    Compound: [
      { value:"60", label:"60cm (Compound Only)" },
      { value:"40", label:"40cm (Indoor)" },
      { value:"3spot", label:"40cm 3-Spot" },
      { value:"9spot", label:"40cm 9-Spot" }
    ],
    indoorOnly: [
      { value:"40", label:"40cm (Indoor)" },
      { value:"3spot", label:"40cm 3-Spot" },
      { value:"9spot", label:"40cm 9-Spot" }
    ],
    outdoorOnly: [
      { value:"122", label:"122cm (Outdoor)" },
      { value:"80", label:"80cm (Outdoor)" }
    ]
  };
  const bowSelect = document.getElementById("bowStyle");
  const distSelect = document.getElementById("distance");
  const faceSelect = document.getElementById("targetFace");
  if(bowSelect.options.length === 0){
    Object.keys(bowDistances).forEach(bow => {
      bowSelect.appendChild(new Option(bow, bow));
    });
  }
  function updateDistances(){
    distSelect.innerHTML = '';
    const selBow = bowSelect.value;
    bowDistances[selBow].forEach(d => distSelect.appendChild(new Option(d + "m", d)));
    updateFaces();
  }
  function updateFaces(){
    faceSelect.innerHTML = '';
    const selBow = bowSelect.value;
    const dist = parseInt(distSelect.value);
    let facesList;
    if (dist <= 18){
      facesList = selBow === 'Compound' ? bowFaces.Compound : bowFaces.indoorOnly;
    } else {
      facesList = selBow === 'Compound' ? bowFaces.Compound : bowFaces.outdoorOnly.concat(bowFaces.indoorOnly);
    }
    facesList.forEach(fa => faceSelect.appendChild(new Option(fa.label, fa.value)));
  }
  bowSelect.onchange = updateDistances;
  distSelect.onchange = updateFaces;
  updateDistances();
}

function startSession() {
  if(currentUserRole !== 'archer'){
    alert('Only archers can start a session.');
    return;
  }
  currentSession = {
    bowStyle: document.getElementById('bowStyle').value,
    distance: parseInt(document.getElementById('distance').value),
    targetFace: document.getElementById('targetFace').value,
    arrowsPerEnd: parseInt(document.getElementById('arrowsPerEnd').value),
    endsCount: parseInt(document.getElementById('endsCount').value),
    ends: [],
    totalScore: 0
  };
  arrowScores = [];
  currentEndNumber = 1;
  document.getElementById('currentEnd').innerText = currentEndNumber;
  showScreen('scoringArea');
  drawTarget();
  updateEndScores();
  updateButtons();
}

function undoArrow() {
  if(arrowScores.length > 0){
    arrowScores.pop();
    updateEndScores();
    updateButtons();
  }
}

async function nextEnd() {
  if(arrowScores.length !== currentSession.arrowsPerEnd){
    alert('Complete scoring this end.');
    return;
  }
  currentSession.ends.push([...arrowScores]);
  currentSession.totalScore += arrowScores.filter(a => typeof a === 'number').reduce((a,b) => a + b,0);
  arrowScores = [];
  updateEndScores();
  updateButtons();
  if(currentEndNumber === currentSession.endsCount){
    alert('All ends complete. Please finish the session.');
    return;
  }
  currentEndNumber++;
  document.getElementById('currentEnd').innerText = currentEndNumber;
}

async function saveSession(){
  if(!currentUser) return;
  const dataToSave = {
    bowStyle: currentSession.bowStyle,
    distance: currentSession.distance,
    targetFace: currentSession.targetFace,
    arrowsPerEnd: currentSession.arrowsPerEnd,
    endsCount: currentSession.endsCount,
    ends: currentSession.ends.map(e => ({ arrows: e })),
    totalScore: currentSession.totalScore,
    date: Timestamp.now()
  };
  const key = Date.now().toString();
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), { [`sessions.${key}`]: dataToSave });
    sessionDataForResults = dataToSave;
  } catch(e) {
    console.error('Session save failed', e);
  }
}

async function endSession(){
  if(arrowScores.length !== 0 && arrowScores.length !== currentSession.arrowsPerEnd){
    alert(`Complete scoring this end.`);
    return;
  }
  if(arrowScores.length === currentSession.arrowsPerEnd){
    currentSession.ends.push([...arrowScores]);
    currentSession.totalScore += arrowScores.filter(a => typeof a === 'number').reduce((a,b) => a + b,0);
    arrowScores = [];
  }
  await saveSession();
  showSessionResults(sessionDataForResults);
}

function showSessionResults(session){
  showScreen('results');
  const summary = document.getElementById('sessionSummary');
  const tableContainer = document.getElementById('scoreTable');
  const canvasElem = document.getElementById('scoreChart');

  summary.innerHTML = `
    <p><b>Bow Style:</b> ${session.bowStyle}</p>
    <p><b>Distance:</b> ${session.distance}</p>
    <p><b>Target Face:</b> ${session.targetFace}</p>
    <p><b>Total Score:</b> ${session.totalScore}</p>
    <p><b>Ends:</b> ${session.ends.length}</p>`;

  let tableHtml = '<table style="width:100%; border-collapse: collapse;"><tr><th>End</th>';
  for(let i=1; i <= session.arrowsPerEnd; i++){
    tableHtml += `<th>Arrow ${i}</th>`;
  }
  tableHtml += '<th>End Total</th></tr>';

  session.ends.forEach((end, idx) => {
    const arrows = end.arrows || [];
    const total = arrows.filter(a => typeof a === 'number').reduce((a,b) => a + b, 0);
    tableHtml += `<tr><td>${idx+1}</td>`;
    for(let i=0; i < session.arrowsPerEnd; i++){
      tableHtml += `<td>${arrows[i] ?? ''}</td>`;
    }
    tableHtml += `<td>${total}</td></tr>`;
  });

  tableHtml += '</table>';
  tableContainer.innerHTML = tableHtml;

  if(window.sessionChartInstance){
    window.sessionChartInstance.destroy();
  }

  const totals = session.ends.map(e => e.arrows.filter(a => typeof a === 'number').reduce((a,b)=> a + b, 0));
  const maxVal = Math.max(...totals, 60); // ensures minimum max of 60

  window.sessionChartInstance = new Chart(canvasElem.getContext('2d'), {
    type: 'bar',
    data: {
      labels: session.ends.map((_,i) => `End ${i+1}`),
      datasets: [{
        label: 'End Total',
        data: totals,
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
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
          max: maxVal + 5
        }
      }
    }
  });
}

function exportCsv(){
  if(!sessionDataForResults){
    alert('No session to export');
    return;
  }
  let csv = 'End,';
  for(let i=1; i <= sessionDataForResults.arrowsPerEnd; i++){
    csv += `Arrow ${i},`;
  }
  csv += 'Total\n';

  sessionDataForResults.ends.forEach((end, idx) => {
    let row = `${idx+1},`;
    let total = 0;
    end.arrows.forEach(score => {
      row += score + ',';
      total += typeof score === 'number' ? score : 0;
    });
    row += total;
    csv += row + '\n';
  });

  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `archery-session-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function viewHistory(){
  if(!currentUser) return;
  const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
  if(!userDoc.exists()) return;

  const sessions = userDoc.data().sessions || {};
  const container = document.getElementById('historyTable');
  container.innerHTML = '';

  let table = document.createElement('table');
  table.innerHTML = '<tr><th>Date</th><th>Score</th><th>Ends</th></tr>';

  Object.values(sessions).forEach(session => {
    const date = session.date ? new Date(session.date.seconds * 1000).toLocaleDateString() : 'N/A';
    const score = session.totalScore ?? 0;
    const ends = (session.ends?.length) ?? 0;
    table.innerHTML += `<tr><td>${date}</td><td>${score}</td><td>${ends}</td></tr>`;
  });

  container.appendChild(table);
  showScreen('historyScreen');
}

function attachButtonHandlers() {
  document.getElementById('signupBtn').addEventListener('click', signup);
  document.getElementById('loginBtn').addEventListener('click', login);
  document.getElementById('menuToggle').addEventListener('click', () => alert('Not implemented'));
  document.getElementById('menuLogoutBtn').addEventListener('click', () => signOut(auth).then(() => showScreen('loginPage')));
  document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth).then(() => showScreen('loginPage')));
  document.getElementById('menuHistoryBtn').addEventListener('click', viewHistory);
  document.getElementById('viewHistoryBtn').addEventListener('click', viewHistory);
  document.getElementById('menuStartBtn').addEventListener('click', () => showScreen('setup'));
  document.getElementById('startSessionBtn').addEventListener('click', startSession);
  document.getElementById('undoBtn').addEventListener('click', undoArrow);
  document.getElementById('nextEndBtn').addEventListener('click', nextEnd);
  document.getElementById('endSessionBtn').addEventListener('click', endSession);
  document.getElementById('backToMenuBtn').addEventListener('click', () => showScreen('menu'));
  document.getElementById('backToSetupBtn').addEventListener('click', () => {
    arrowScores = [];
    currentSession = {};
    currentEndNumber = 1;
    showScreen('setup');
    drawTarget();
    updateEndScores();
    updateButtons();
  });
  document.getElementById('newSessionBtn').addEventListener('click', () => {
    arrowScores = [];
    currentSession = {};
    currentEndNumber = 1;
    showScreen('setup');
  });
  document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);

  if(canvas) canvas.addEventListener('click', handleCanvasClick);
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if(user){
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if(!userDoc.exists()){
      showScreen('loginPage');
      return;
    }
    const userData = userDoc.data();
    currentUserRole = userData.role ?? 'archer';
    document.getElementById('greeting').innerText = `Hello, ${userData.name} (${currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1)})!`;

    if(currentUserRole === 'coach'){
      document.getElementById('startSessionBtn').style.display = 'none';
      if(!document.getElementById('menuCoachBtn')){
        const btn = document.createElement('button');
        btn.id = 'menuCoachBtn';
        btn.textContent = 'Coach Dashboard';
        btn.style.marginTop = '10px';
        btn.addEventListener('click', () => {
          showScreen('coachDashboard');
          loadArcherList();
        });
        document.getElementById('menu').appendChild(btn);
      }
    } else {
      document.getElementById('startSessionBtn').style.display = 'block';
      const cbtn = document.getElementById('menuCoachBtn');
      if(cbtn) cbtn.style.display = 'none';
    }

    showScreen('menu');
  } else {
    currentUserRole = null;
    showScreen('loginPage');
  }
});

window.addEventListener('DOMContentLoaded', () => {
  attachButtonHandlers();
  updateSessionSetupOptions();
  drawTarget();
  updateEndScores();
  updateButtons();
});
