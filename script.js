// -------------------
// Firebase Setup
// -------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, Timestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAAc3sRW7WuQXbvlVKKdb8pFa3UOpidalM",
  authDomain: "my-scorer.firebaseapp.com",
  projectId: "my-scorer",
  storageBucket: "my-scorer.firebasestorage.app",
  messagingSenderId: "243500946215",
  appId: "1:243500946215:web:bd976f1bd437edce684f02"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore(app);

// -------------------
// Globals
// -------------------
let currentUser = null;
let currentSession = {};
let arrowScores = [];
let currentEndNumber = 1;

// -------------------
// Utility: Show Screen
// -------------------
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// -------------------
// Auth State Listener
// -------------------
onAuthStateChanged(auth, user => {
  if(user) currentUser = user;
});

// -------------------
// DOMContentLoaded
// -------------------
window.addEventListener("DOMContentLoaded", () => {

  // -------------------
  // Elements
  // -------------------
  const signupBtn = document.getElementById("signupBtn");
  const loginBtn = document.getElementById("loginBtn");
  const startSessionBtn = document.getElementById("startSessionBtn");
  const undoBtn = document.getElementById("undoBtn");
  const nextEndBtn = document.getElementById("nextEndBtn");
  const backToSetupBtn = document.getElementById("backToSetupBtn");
  const msgDiv = document.getElementById("loginMessage");

  const canvas = document.getElementById("target");
  const ctx = canvas.getContext("2d");

  // -------------------
  // Event Listeners
  // -------------------
  signupBtn.addEventListener("click", signup);
  loginBtn.addEventListener("click", login);
  startSessionBtn.addEventListener("click", startSession);
  undoBtn.addEventListener("click", undoLastArrow);
  nextEndBtn.addEventListener("click", nextEnd);
  backToSetupBtn.addEventListener("click", backToSetup);

  canvas.addEventListener("click", e => {
    if(!currentSession.arrowsPerEnd) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const center = canvas.width / 2;
    const dist = Math.sqrt(Math.pow(x-center,2)+Math.pow(y-center,2));
    let score = 0;
    if(dist < 30) score = 10;
    else if(dist < 60) score = 8;
    else if(dist < 90) score = 6;
    else if(dist < 120) score = 4;
    else score = 1;
    arrowScores.push(score);
    updateEndScores();
  });

  // -------------------
  // Target Draw
  // -------------------
  function drawTarget(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const colors=['#f00','#f90','#ff0','#0f0','#00f'];
    let radius=canvas.width/2;
    for(let i=0;i<colors.length;i++){
      ctx.beginPath();
      ctx.arc(radius,radius,radius-i*30,0,2*Math.PI);
      ctx.fillStyle = colors[i];
      ctx.fill();
    }
  }
  drawTarget();

  // -------------------
  // Update End Scores
  // -------------------
  function updateEndScores(){
    document.getElementById("endScores").innerText = arrowScores.join(" | ");
    const total = arrowScores.reduce((a,b)=>a+b,0);
    document.getElementById("endTotal").innerText = "End Total: " + total;
  }

  // -------------------
  // Signup
  // -------------------
  async function signup(){
    const username = document.getElementById("username").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if(!username || !email || !password){ msgDiv.innerText="Fill all fields!"; return; }

    try{
      const userCredential = await createUserWithEmailAndPassword(auth,email,password);
      const uid = userCredential.user.uid;
      await setDoc(doc(db,"users",uid),{name:username,sessions:[]});
      currentUser = userCredential.user;
      msgDiv.innerText="";
      showScreen("setup");
    } catch(e){
      msgDiv.innerText = e.message;
    }
  }

  // -------------------
  // Login
  // -------------------
  async function login(){
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if(!email || !password){ msgDiv.innerText="Enter email & password!"; return; }

    try{
      const userCredential = await signInWithEmailAndPassword(auth,email,password);
      currentUser = userCredential.user;
      msgDiv.innerText="";
      showScreen("setup");
    } catch(e){
      msgDiv.innerText = e.message;
    }
  }

  // -------------------
  // Start Session
  // -------------------
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

  // -------------------
  // Undo Arrow
  // -------------------
  function undoLastArrow(){
    arrowScores.pop();
    updateEndScores();
  }

  // -------------------
  // Next End
  // -------------------
  async function nextEnd(){
    if(arrowScores.length !== currentSession.arrowsPerEnd){
      alert("Shoot all arrows first!");
      return;
    }

    currentSession.ends.push([...arrowScores]);
    currentSession.totalScore += arrowScores.reduce((a,b)=>a+b,0);
    arrowScores = [];
    currentEndNumber++;

    if(currentEndNumber > currentSession.endsCount){
      await saveSession();
      showResults();
    } else{
      document.getElementById("currentEnd").innerText = currentEndNumber;
      updateEndScores();
    }
  }

  // -------------------
  // Save Session to Firebase
  // -------------------
  async function saveSession(){
    if(!currentUser) return;
    const uid = currentUser.uid;
    const userRef = doc(db,"users",uid);
    const userSnap = await getDoc(userRef);
    if(!userSnap.exists()) return;
    await updateDoc(userRef,{
      sessions: arrayUnion({...currentSession,date:Timestamp.now()})
    });
  }

  // -------------------
  // Show Results
  // -------------------
  function showResults(){
    showScreen("results");
    document.getElementById("sessionSummary").innerHTML=`
      <p>Bow: ${currentSession.bowStyle}</p>
      <p>Distance: ${currentSession.distance}m</p>
      <p>Total Score: ${currentSession.totalScore}</p>
      <p>Ends Count: ${currentSession.endsCount}</p>
    `;

    const table=document.createElement("table");
    const header=document.createElement("tr");
    header.innerHTML="<th>End</th>"+[...Array(currentSession.arrowsPerEnd)].map((_,i)=>`<th>Arrow ${i+1}</th>`).join('')+"<th>End Total</th>";
    table.appendChild(header);

    currentSession.ends.forEach((end,i)=>{
      const row=document.createElement("tr");
      const endTotal=end.reduce((a,b)=>a+b,0);
      row.innerHTML=`<td>${i+1}</td>`+end.map(a=>`<td>${a}</td>`).join('')+`<td>${endTotal}</td>`;
      table.appendChild(row);
    });

    const scoreTableDiv=document.getElementById("scoreTable");
    scoreTableDiv.innerHTML="";
    scoreTableDiv.appendChild(table);

    const ctxChart = document.getElementById("scoreChart").getContext("2d");
    new Chart(ctxChart,{
      type:'bar',
      data:{
        labels: currentSession.ends.map((_,i)=>`End ${i+1}`),
        datasets:[{label:'End Total',data:currentSession.ends.map(e=>e.reduce((a,b)=>a+b,0)),backgroundColor:'rgba(59,130,246,0.7)'}]
      },
      options:{responsive:true, maintainAspectRatio:false}
    });
  }

  // -------------------
  // Back to Setup
  // -------------------
  function backToSetup(){
    currentEndNumber = 1;
    arrowScores = [];
    currentSession = {};
    showScreen("setup");
    drawTarget();
    updateEndScores();
  }

});
