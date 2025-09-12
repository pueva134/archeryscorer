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

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD...yourKeyHere",
  authDomain: "my-scorer.firebaseapp.com",
  projectId: "my-scorer",
  storageBucket: "my-scorer.appspot.com",
  messagingSenderId: "243500946215",
  appId: "1:243500946215:web:yourid"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Globals
let currentUser = null;
let currentUserRole = null;
let currentSession = {};
let arrowScores = [];
let currentEndNumber = 1;
let sessionDataForResults = null;

const canvas = document.getElementById("target");
const ctx = canvas?.getContext("2d");

// ---------- UI Helpers ----------
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  if (id === "scoringArea") drawTarget();
  if (id === "setup") updateSessionSetup();
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
  rings.forEach(r => {
    ctx.beginPath();
    ctx.arc(radius, radius, r.radius, 0, 2 * Math.PI);
    ctx.fillStyle = r.color;
    ctx.fill();
  });
}

function updateScoresDisplay() {
  const scoresDiv = document.getElementById("endScores");
  const totalDiv = document.getElementById("endTotal");
  if(scoresDiv) scoresDiv.innerText = arrowScores.join(" | ");
  if(totalDiv){
    const total = arrowScores.filter(s => typeof s === 'number').reduce((a,b) => a+b,0);
    totalDiv.innerText = `Total: ${total}`;
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

function setupSessionOptions(){
  const bowDistances = {
    Recurve: [10,12,15,18,20,30,40,50,60,70,80],
    Compound: [10,12,15,18,20,30,40,50],
    Barebow: [10,12,15,18,20,30],
    Longbow: [10,12,15,18,20,30]
  };
  const bowFaces = {
    Compound: [
      { value:"60", label:"60cm (Compound)"},
      { value:"40", label:"40cm (Indoor)"},
      { value:"3spot", label:"3-Spot (Indoor)"},
      { value:"9spot", label:"9-Spot (Indoor)"}
    ],
    indoor: [
      { value:"40", label:"40cm (Indoor)"},
      { value:"3spot", label:"3-Spot (Indoor)"},
      { value:"9spot", label:"9-Spot (Indoor)"}
    ],
    outdoor: [
      { value:"122", label:"122cm (Outdoor)"},
      { value:"80", label:"80cm (Outdoor)"}
    ]
  };
  const bowSelect = document.getElementById("bowStyle");
  const distSelect = document.getElementById("distance");
  const faceSelect = document.getElementById("targetFace");
  if(bowSelect.options.length === 0){
    Object.keys(bowDistances).forEach(b => bowSelect.appendChild(new Option(b,b)));
  }
  function updateDistances(){
    distSelect.innerHTML ="";
    const style = bowSelect.value;
    bowDistances[style].forEach(d => distSelect.appendChild(new Option(d + "m", d)));
    updateFaces();
  }
  function updateFaces(){
    faceSelect.innerHTML = "";
    const style = bowSelect.value;
    let dist = parseInt(distSelect.value);
    let faces = [];
    if(dist <= 18) {
      faces = style === "Compound" ? bowFaces.Compound : bowFaces.indoor;
    } else {
      faces = style === "Compound" ? bowFaces.Compound : [...bowFaces.outdoor, ...bowFaces.indoor];
    }
    faces.forEach(f => faceSelect.appendChild(new Option(f.label,f.value)));
  }
  bowSelect.onchange = updateDistances;
  distSelect.onchange = updateFaces;
  updateDistances();
}

// ---------- Event Handlers ----------
function handleCanvasClick(e){
  if(!currentSession.arrowsPerEnd) return;
  if(arrowScores.length >= currentSession.arrowsPerEnd){
    alert("All arrows scored");
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const dist = Math.sqrt((x-centerX)**2 + (y-centerY)**2);
  const ringSize = canvas.width/20;
  let score = "M";
  if(dist <= ringSize) score = 10;
  else if(dist <= ringSize*2) score = 9;
  else if(dist <= ringSize*3) score = 8;
  else if(dist <= ringSize*4) score = 7;
  else if(dist <= ringSize*5) score = 6;
  else if(dist <= ringSize*6) score = 5;
  else if(dist <= ringSize*7) score = 4;
  else if(dist <= ringSize*8) score = 3;
  else if(dist <= ringSize*9) score = 2;
  else if(dist <= ringSize*10) score = 1;
  arrowScores.push(score);
  updateScoresDisplay();
  updateButtons();
}

function signup(){
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;
  const msgDiv = document.getElementById("loginMessage");
  msgDiv.textContent = "";
  if(!username || !email || !password){
    msgDiv.textContent = "Please fill all fields!";
    return;
  }
  createUserWithEmailAndPassword(auth,email,password).then(cred =>{
    setDoc(doc(db,"users",cred.user.uid), {
      name: username,
      role,
      sessions: {}
    }).then(() =>{
      msgDiv.textContent = "Signup successful! Please log in";
      showScreen("loginPage");
    });
  }).catch(err => {
    msgDiv.textContent = err.message;
  });
}

function login(){
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msgDiv = document.getElementById("loginMessage");
  msgDiv.textContent = "";
  if(!email || !password){
    msgDiv.textContent = "Please enter email and password";
    return;
  }
  signInWithEmailAndPassword(auth,email,password).catch(err=>{
    msgDiv.textContent = err.message;
  });
}

function startSession(){
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
    total: 0
  };
  arrowScores = [];
  currentEndNumber = 1;
  document.getElementById("currentEnd").textContent = currentEndNumber;
  showScreen("scoringArea");
  drawTarget();
  updateScoresDisplay();
  updateButtons();
}

function undoArrow(){
  arrowScores.pop();
  updateScoresDisplay();
  updateButtons();
}

function nextEnd(){
  if(arrowScores.length !== currentSession.arrowsPerEnd){
    alert("Finish scoring current end first!");
    return;
  }
  currentSession.ends.push([...arrowScores]);
  currentSession.total += arrowScores.filter(n => typeof n === "number").reduce((a,b) => a + b, 0);
  arrowScores = [];
  updateScoresDisplay();
  updateButtons();
  if(currentEndNumber === currentSession.endsCount){
    alert("All ends complete. Click Finish.");
    return;
  }
  currentEndNumber++;
  document.getElementById("currentEnd").textContent = currentEndNumber;
}

async function saveSession(){
  if(!currentUser) return;
  const data = {
    bowStyle: currentSession.bowStyle,
    distance: currentSession.distance,
    targetFace: currentSession.targetFace,
    arrowsPerEnd: currentSession.arrowsPerEnd,
    endsCount: currentSession.endsCount,
    ends: currentSession.ends.map(e =>{
      return {arrows: e};
    }),
    total: currentSession.total,
    date: Timestamp.now()
  };
  const key = Date.now().toString();
  try{
    await updateDoc(doc(db,"users",currentUser.uid), {
      [`sessions.${key}`]: data
    });
    sessionDataForResults = data;
  }catch(e){
    console.error("Error saving session", e);
  }
}

async function endSession(){
  if(arrowScores.length > 0 && arrowScores.length !== currentSession.arrowsPerEnd){
    alert("Score all arrows to finish end");
    return;
  }
  if(arrowScores.length === currentSession.arrowsPerEnd){
    currentSession.ends.push([...arrowScores]);
    currentSession.total += arrowScores.filter(n => typeof n === "number").reduce((a,b) => a+b,0);
    arrowScores = [];
  }
  await saveSession();
  showSessionResults(sessionDataForResults);
  currentSession = {};
  arrowScores = [];
  currentEndNumber = 1;
}

async function viewHistory(){
  if(!currentUser) return;
  const docSnap = await getDoc(doc(db,"users",currentUser.uid));
  if(!docSnap.exists()) {
    alert("User data not found");
    return;
  }
  const sessions = docSnap.data().sessions || {};
  const container = document.getElementById("historyTable");
  container.innerHTML = "";
  if(Object.keys(sessions).length === 0){
    container.textContent = "No sessions found";
    return;
  }
  let table = document.createElement("table");
  let head = "<tr><th>Date</th><th>Score</th><th>Ends</th></tr>";
  table.innerHTML = head;
  Object.values(sessions).forEach(session=>{
    let date = session.date ? new Date(session.date.seconds*1000).toLocaleDateString() : "N/A";
    let total = session.total || 0;
    let ends = session.ends ? session.ends.length : 0;
    let row = `<tr><td>${date}</td><td>${total}</td><td>${ends}</td></tr>`;
    table.innerHTML += row;
  });
  container.appendChild(table);
  showScreen("history");
}

function attachEventListeners(){
  document.getElementById("signupBtn")?.addEventListener("click",signup);
  document.getElementById("loginBtn")?.addEventListener("click",login);
  document.getElementById("menuToggle")?.addEventListener("click",()=>alert("Theme toggle not implemented"));
  document.getElementById("menuLogout")?.addEventListener("click",()=>signOut(auth).then(()=>showScreen("login")));
  document.getElementById("logoutBtn")?.addEventListener("click",()=>signOut(auth).then(()=>showScreen("login")));
  document.getElementById("menuHistory")?.addEventListener("click",viewHistory);
  document.getElementById("viewHistory")?.addEventListener("click",viewHistory);
  document.getElementById("menuStart")?.addEventListener("click",()=>showScreen("setup"));
  document.getElementById("startSession")?.addEventListener("click",startSession);
  document.getElementById("undoArrow")?.addEventListener("click",undoArrow);
  document.getElementById("nextEnd")?.addEventListener("click",nextEnd);
  document.getElementById("endSession")?.addEventListener("click",endSession);
  document.getElementById("backToMenu")?.addEventListener("click",()=>showScreen("menu"));
  document.getElementById("backToSetup")?.addEventListener("click",()=>{
    arrowScores = [];
    currentSession = {};
    currentEndNumber = 1;
    showScreen("setup");
    drawTarget();
    updateScoresDisplay();
    updateButtons();
  });
  document.getElementById("newSession")?.addEventListener("click",()=>{
    arrowScores = [];
    currentSession = {};
    currentEndNumber = 1;
    showScreen("setup");
  });
  document.getElementById("exportCsv")?.addEventListener("click",exportSheet);
  if(canvas) canvas.addEventListener("click",handleCanvasClick);
}

function exportSheet(){
  if(!sessionDataForResults){
    alert("No session data to export");
    return;
  }
  let csv = "End,";
  for(let i=1; i <= sessionDataForResults.arrowsPerEnd; i++){
    csv += `Arrow${i},`
  }
  csv += "Total\n";
  sessionDataForResults.ends.forEach((end, idx)=>{
    let row = `${idx+1},`;
    let total = 0;
    end.arrows.forEach(a=>{
      row += a + ",";
      total += (typeof a === "number") ? a : 0;
    })
    row += total + "\n";
    csv += row;
  })
  let blob = new Blob([csv], {type:"text/csv"});
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url;
  a.download = `archerysession_${Date.now()}.csv`;
  a.click();
  a.remove();
}

// HANDLER for rendering score details + chart
let scoreChart = null;
async function showSessionResults(session) {
  showScreen("results");
  let html = `
  <p><b>Bow Style:</b> ${session.bowStyle}</p>
  <p><b>Distance:</b> ${session.distance}</p>
  <p><b>Target Face:</b> ${session.targetFace}</p>
  <p><b>Total Score:</b> ${session.total}</p>
  <p><b>Ends:</b> ${session.ends?.length || 0}</p>
  `
  document.getElementById("sessionSummary").innerHTML = html;
  // Score table build
  let table = document.createElement("table");
  let head = `
    <tr>
    <th>End</th>`
  for(let i=1; i <= session.arrowsPerEnd; i++){
    head += `<th>Arrow ${i}</th>`
  }
  head += `<th>Total</th></tr>`
  table.innerHTML = head;
  session.ends.forEach((end, idx)=>{
    let row = `<tr><td>${idx+1}</td>`;
    end.arrows.forEach(a=>{
      row += `<td>${a}</td>`;
    })
    let total = end.arrows.filter(n=>typeof n === "number")
                         .reduce((s,a)=>s+a,0);
    row += `<td>${total}</td></tr>`;
    table.innerHTML += row;
  });
  let container = document.getElementById("scoreTable");
  container.innerHTML = "";
  container.appendChild(table);
  
  // Chart rendering
  let ctx = document.getElementById("scoreChart").getContext("2d");
  if(scoreChart) scoreChart.destroy();
  let totals = session.ends.map(e=>
    e.arrows.filter(n=>typeof n==="number")
           .reduce((s,a)=>s+a,0));
  let maxVal = Math.max(...totals, 60);
  scoreChart = new Chart(ctx, {
    type:"bar",
    data:{
      labels: session.ends.map((v,i)=>`End ${i+1}`),
      datasets:[{
        label: "End Total",
        data: totals,
        backgroundColor: "rgba(59, 130, 246, 0.7)"
      }]
    },
    options:{
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1500
      },
      scales: {
        y: {
          beginAtZero:true,
          max: maxVal + 5
        }
      }
    }
  })
}

// Attach event listeners after DOM ready
window.addEventListener("DOMContentLoaded", () => {
  attachEventListeners();
  updateSessionSetup();
  drawTarget();
  updateScoresDisplay();
  updateButtons();
});

// Auth changes listener
onAuthStateChanged(auth, async (user)=>{
  currentUser = user;
  if(user){
    let docSnap = await getDoc(doc(db,"users", user.uid));
    if(!docSnap.exists()){
      showScreen("login");
      return;
    }
    let data = docSnap.data();
    currentUserRole = data.role ?? "archer";
    document.getElementById("greeting").innerText = `Hello ${data.name} (${currentUserRole})`;
    if(currentUserRole === "coach"){
      showScreen("coachDashboard");
      loadArcherList();
    }else{
      showScreen("menu");
    }
  }else{
    currentUserRole=null;
    showScreen("login");
  }
});

// Coach dashboard helpers
let currentArcherUid = null;
let currentArcherName = null;

async function loadArcherList(){
  const listElem = document.getElementById("archerList");
  listElem.innerHTML = "";
  const q = query(collection(db,"users"), where("role","==","archer"));
  const snapshot = await getDocs(q);
  if(snapshot.empty){
    listElem.textContent = "No archers found";
    return;
  }
  snapshot.forEach(docSnap=>{
    let user = docSnap.data();
    let li = document.createElement("li");
    li.textContent = user.name;
    li.style.cursor = "pointer";
    li.onclick = ()=>loadArcherSessions(docSnap.id, user.name);
    listElem.appendChild(li);
  })
}

async function loadArcherSessions(archerUid, archerName){
  currentArcherUid = archerUid;
  currentArcherName = archerName;
  document.getElementById("selectedArcherName").innerText = archerName;
  const container = document.getElementById("archerSessionList");
  container.textContent = "Loading...";
  const docSnap = await getDoc(doc(db,"users", archerUid));
  if(!docSnap.exists()){
    container.textContent = "Archers data not found";
    return;
  }
  let sessions = docSnap.data().sessions || {};
  if(Object.keys(sessions).length === 0){
    container.textContent = "No sessions found";
    return;
  }
  container.innerHTML = "";
  let ul = document.createElement("ul");
  ul.style.listStyle = "none";
  ul.style.paddingLeft = 0;
  Object.entries(sessions).forEach(([k,s])=>{
    let li = document.createElement("li");
    let dateStr = s.date ? new Date(s.date.seconds*1000).toLocaleString() : "Unknown date";
    li.textContent = `Date: ${dateStr} - Score: ${s.total || 0}`;
    li.style.cursor = "pointer";
    li.onclick = ()=>displaySessionResults(s);
    ul.appendChild(li);
  })
  container.appendChild(ul);
}

async function displaySessionResults(session){
  showScreen("sessionDetail");
  const summary = document.getElementById("sessionSummary");
  summary.innerHTML = `
    <p><b>Bow Style:</b> ${session.bowStyle}</p>
    <p><b>Distance:</b> ${session.distance}</p>
    <p><b>Target Face:</b> ${session.targetFace}</p>
    <p><b>Total Score:</b> ${session.total}</p>
    <p><b>Ends:</b> ${(session.ends?.length) || 0}</p>
  `;

  const container = document.getElementById("scoreTable");
  container.innerHTML = "";
  let table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  let head = "<tr><th>End</th>";
  let arrowsCount = session.arrowsPerEnd;
  for(let i=1; i<=arrowsCount; i++) head += `<th>Arrow ${i}</th>`;
  head += "<th>Total</th></tr>";
  table.innerHTML = head;

  session.ends.forEach((end,idx)=>{
    let row = `<tr><td>${idx+1}</td>`;
    let arrows = end.arrows || [];
    arrows.forEach(a=>row += `<td>${a}</td>`);
    let total = arrows.filter(n => typeof n === "number").reduce((s,a)=>s+a,0);
    row += `<td>${total}</td></tr>`;
    table.innerHTML += row;
  });

  container.appendChild(table);

  const chart = document.getElementById("scoreChart").getContext("2d");
  if(window.scoreChart) window.scoreChart.destroy();
  let totals = session.ends.map(e => e.arrows.filter(n=>typeof n==="number").reduce((a,b)=>a+b,0));
  let maxVal = Math.max(...totals, 60);
  window.scoreChart = new Chart(chart, {
    type:"bar",
    data:{
      labels: session.ends.map((v,i) => `End ${i+1}`),
      datasets:[{label:"End Total", data: totals, backgroundColor:"rgba(59,130,246,0.7)"}]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{y:{beginAtZero:true, max: maxVal+5}},
      animation:{duration:1500, loop:false}
    }
  });
}

// Navigate back from session detail to coach dashboard
document.getElementById("sessionBackBtn").addEventListener("click", () => {
  document.getElementById("sessionDetail").style.display = "none";
  showScreen("coachDashboard");
});

window.addEventListener("DOMContentLoaded", ()=>{
  attachEventListeners();
  updateSessionSetup();
  drawTarget();
  updateScoresDisplay();
  updateButtons();
});
