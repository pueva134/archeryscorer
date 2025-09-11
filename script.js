import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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
const db = getFirestore();

let currentUser = null, currentSession = {}, arrowScores = [], currentEndNumber = 1;
const canvas = document.getElementById("target");
const ctx = canvas?.getContext("2d");

// UI helpers
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if(el) el.classList.add("active");
}

function drawTarget(){
  if(!ctx) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const colors = ["#fff","#000","#008cff","#f00","#ffeb43"];
  let r = canvas.width/2;
  for(let i=0; i<colors.length; i++){
    ctx.beginPath();
    ctx.arc(r,r,r-30*i,0,2*Math.PI);
    ctx.fillStyle=colors[i];
    ctx.fill();
  }
}

function updateEndScores(){
  const div = document.getElementById("endScores");
  if(div) div.textContent = arrowScores.join(" | ");
  const totalDiv = document.getElementById("endTotal");
  if(totalDiv) totalDiv.textContent = "Total: " + arrowScores.reduce((a,b)=>a+b,0);
}

// Firebase auth state
onAuthStateChanged(auth,user=>{
  currentUser = user;
  if(user){
    getDoc(doc(db,"users",user.uid)).then(docSnap=>{
      if(docSnap.exists())
        document.getElementById("greeting").textContent = "Hello, " + docSnap.data().name + "!";
      else
        document.getElementById("greeting").textContent = "Hello!";
    });
    showScreen("menuScreen");
  } else {
    document.getElementById("greeting").textContent = "";
    showScreen("loginPage");
  }
});

// Signup/login
async function signup(){
  const username=document.getElementById("username").value.trim(),
        email=document.getElementById("email").value.trim(),
        password=document.getElementById("password").value,
        role=document.getElementById("role").value,
        msg=document.getElementById("loginMessage");
  msg.textContent="";
  if(!username || !email || !password){ msg.textContent="Please fill all fields!"; return; }
  try{
    const userCred = await createUserWithEmailAndPassword(auth,email,password);
    await setDoc(doc(db,"users",userCred.user.uid),{name:username,role,sessions:{}});
    msg.textContent="Signup successful! Please login.";
  }catch(e){ msg.textContent=e.message; }
}

async function login(){
  const email=document.getElementById("email").value.trim(),
        password=document.getElementById("password").value,
        msg=document.getElementById("loginMessage");
  msg.textContent="";
  if(!email || !password){ msg.textContent="Please fill fields!"; return; }
  try{
    await signInWithEmailAndPassword(auth,email,password);
  }catch(e){ msg.textContent=e.message; }
}

// Setup UI with dynamic distance and target adjustment
const bowDistances = {
  Recurve: [10,12,15,18,20,30,40,50,60,70],
  Compound: [10,12,15,18,30,50],
  Barebow: [10,12,15,18],
  Longbow: [10,12,15,18]
};
  
const bowTargetFaces = {
  compoundSpecial: [
    {value:"60",label:"60cm (Compound Only)"},
    {value:"40",label:"40cm (Indoor)"},
    {value:"3spot",label:"40cm 3-Spot (Indoor)"},
    {value:"9spot",label:"40cm 9-Spot (Indoor)"}
  ],
  indoorOnly: [
    {value:"40",label:"40cm (Indoor)"},
    {value:"3spot",label:"40cm 3-Spot (Indoor)"},
    {value:"9spot",label:"40cm 9-Spot (Indoor)"}
  ],
  default: [
    {value:"122",label:"122cm (Outdoor)"},
    {value:"80",label:"80cm (Outdoor)"},
    {value:"40",label:"40cm (Indoor)"},
    {value:"3spot",label:"40cm 3-Spot (Indoor)"},
    {value:"9spot",label:"40cm 9-Spot (Indoor)"}
  ]
};

function updateSetupOptions(){
  const bowSel=document.getElementById("bowStyle");
  const distSel=document.getElementById("distance");
  const faceSel=document.getElementById("targetFace");
  bowSel.innerHTML="";
  for(let b in bowDistances){
    const opt=document.createElement("option");
    opt.value=b; opt.textContent=b;
    bowSel.appendChild(opt);
  }
  function refresh(){
    const bow=bowSel.value;
    distSel.innerHTML="";
    bowDistances[bow].forEach(d=>{
      const opt=document.createElement("option");
      opt.value=d; opt.textContent=d+"m";
      distSel.appendChild(opt);
    });
    faceSel.innerHTML="";
    const dist=parseInt(distSel.value);
    let faces = (dist<=18)
      ? (bow==="Compound"?bowTargetFaces.compoundSpecial:bowTargetFaces.indoorOnly)
      : (bow==="Compound"?bowTargetFaces.compoundSpecial:bowTargetFaces.default);
    faces.forEach(f=>{
      const opt=document.createElement("option");
      opt.value=f.value; opt.textContent=f.label;
      faceSel.appendChild(opt);
    });
  }
  bowSel.addEventListener("change",refresh);
  distSel.addEventListener("change",refresh);
  bowSel.value="Recurve"; // default
  refresh();
}

function attachHandlers(){
  // Auth
  document.getElementById("signupBtn").addEventListener("click",signup);
  document.getElementById("loginBtn").addEventListener("click",login);

  // Menu buttons
  document.getElementById("menuStartBtn").addEventListener("click",()=>showScreen("setup"));
  document.getElementById("menuHistoryBtn").addEventListener("click",viewHistory);
  document.getElementById("menuLogoutBtn").addEventListener("click",()=>auth.signOut().then(()=>showScreen("loginPage")));
  document.getElementById("menuToggleBtn").addEventListener("click",toggleTheme);

  // Setup buttons
  document.getElementById("startBtn").addEventListener("click",startSession);
  document.getElementById("historyBtn").addEventListener("click",viewHistory);
  document.getElementById("logoutBtn").addEventListener("click",()=>auth.signOut().then(()=>showScreen("loginPage")));

  // Scoring buttons
  document.getElementById("undoBtn").addEventListener("click",undoArrow);
  document.getElementById("nextBtn").addEventListener("click",nextEnd);
  document.getElementById("endBtn").addEventListener("click",endSession);

  // Results button
  document.getElementById("newSessionBtn").addEventListener("click",backToSetup);

  // History button
  document.getElementById("backMenuBtn").addEventListener("click",()=>showScreen("menuScreen"));

  // Canvas
  if(canvas){
    canvas.addEventListener("click",scoreClick);
  }
}

// Your existing session, scoring, saving, load history, etc. logic goes here unchanged but linked to these new IDs

// Initialization
window.addEventListener("DOMContentLoaded",()=>{
  attachHandlers();
  updateSetupOptions();
  drawTarget();
  updateEndScores();
});
