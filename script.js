// ------------------------------
// Firebase Initialization
// ------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, arrayUnion, getDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Firebase config
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

// ------------------------------
// Utility Functions
// ------------------------------
function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ------------------------------
// Dropdown Population
// ------------------------------
function populateDropdowns(){
    const bows = ['Recurve', 'Compound', 'Barebow'];
    const distances = [10, 18, 30, 50, 70];
    const targets = ['Indoor', 'Outdoor', 'Compound'];

    const bowSelect = document.getElementById("bowStyle");
    const distanceSelect = document.getElementById("distance");
    const targetSelect = document.getElementById("targetFace");

    bows.forEach(b=>{ let o=document.createElement('option'); o.value=b; o.text=b; bowSelect.appendChild(o); });
    distances.forEach(d=>{ let o=document.createElement('option'); o.value=d; o.text=d; distanceSelect.appendChild(o); });
    targets.forEach(t=>{ let o=document.createElement('option'); o.value=t; o.text=t; targetSelect.appendChild(o); });
}

// ------------------------------
// Canvas Target Drawing & Click Scoring
// ------------------------------
const canvas = document.getElementById("target");
const ctx = canvas.getContext("2d");

function drawTarget(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const colors = ['#f00','#f90','#ff0','#0f0','#00f'];
    const radius = canvas.width/2;
    for(let i=0;i<colors.length;i++){
        ctx.beginPath();
        ctx.arc(radius,radius,radius - i*30,0,2*Math.PI);
        ctx.fillStyle = colors[i];
        ctx.fill();
    }
}

canvas.addEventListener("click", e=>{
    if(!currentSession.arrowsPerEnd) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const center = canvas.width/2;
    const dist = Math.sqrt(Math.pow(x-center,2)+Math.pow(y-center,2));
    let score = 0;
    if(dist<30) score=10;
    else if(dist<60) score=8;
    else if(dist<90) score=6;
    else if(dist<120) score=4;
    else score=1;
    arrowScores.push(score);
    updateEndScores();
});

// ------------------------------
// End Scores Update
// ------------------------------
function updateEndScores(){
    document.getElementById("endScores").innerText = arrowScores.map((s,i)=>`${s}${arrowNotes[i]?'*':''}`).join(" | ");
    const total = arrowScores.reduce((a,b)=>a+b,0);
    document.getElementById("endTotal").innerText = "End Total: "+total;
}

// ------------------------------
// Undo Last Arrow
// ------------------------------
function undoLastArrow(){
    arrowScores.pop();
    arrowNotes.pop();
    updateEndScores();
}

// ------------------------------
// Next End
// ------------------------------
async function nextEnd(){
    if(arrowScores.length!==currentSession.arrowsPerEnd){
        alert("Shoot all arrows first!");
        return;
    }
    currentSession.ends.push({scores:[...arrowScores], notes:[...arrowNotes]});
    currentSession.totalScore += arrowScores.reduce((a,b)=>a+b,0);
    arrowScores=[]; arrowNotes=[];
    currentEndNumber++;
    if(currentEndNumber>currentSession.endsCount){
        await saveSession();
        showResults();
    } else {
        document.getElementById("currentEnd").innerText=currentEndNumber;
        updateEndScores();
    }
}

// ------------------------------
// Start Session
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
    arrowScores=[]; arrowNotes=[]; currentEndNumber=1;
    document.getElementById("currentEnd").innerText=currentEndNumber;
    showScreen("scoringScreen");
    drawTarget();
    updateEndScores();
}

// ------------------------------
// Show Results
// ------------------------------
function showResults(){
    showScreen("resultsScreen");
    const summaryDiv = document.getElementById("sessionSummary");
    summaryDiv.innerHTML = `<p>Bow: ${currentSession.bowStyle}</p><p>Distance: ${currentSession.distance}m</p><p>Total Score: ${currentSession.totalScore}</p><p>Ends: ${currentSession.endsCount}</p>`;
    
    const table = document.createElement("table");
    let header = "<tr><th>End</th>";
    for(let i=1;i<=currentSession.arrowsPerEnd;i++) header+=`<th>Arrow ${i}</th>`;
    header+="<th>End Total</th></tr>";
    table.innerHTML=header;
    
    currentSession.ends.forEach((end,i)=>{
        const total = end.scores.reduce((a,b)=>a+b,0);
        let row=`<tr><td>${i+1}</td>`;
        end.scores.forEach(s=>row+=`<td>${s}</td>`);
        row+=`<td>${total}</td></tr>`;
        table.innerHTML+=row;
    });
    document.getElementById("scoreTable").innerHTML="";
    document.getElementById("scoreTable").appendChild(table);

    const ctxChart=document.getElementById("scoreChart").getContext("2d");
    new Chart(ctxChart,{
        type:'bar',
        data:{labels:currentSession.ends.map((_,i)=>`End ${i+1}`),
              datasets:[{label:'End Total',data:currentSession.ends.map(e=>e.scores.reduce((a,b)=>a+b,0)),backgroundColor:'rgba(59,130,246,0.7)'}]},
        options:{responsive:true,maintainAspectRatio:false}
    });
}

// ------------------------------
// Firebase Auth Handlers
// ------------------------------
async function signup(){
    const username=document.getElementById("username").value;
    const email=document.getElementById("email").value;
    const password=document.getElementById("password").value;
    const role=document.getElementById("role").value;
    const msg=document.getElementById("loginMessage");
    if(!username||!email||!password){ msg.innerText="Fill all fields!"; return; }
    try{
        const userCredential = await createUserWithEmailAndPassword(auth,email,password);
        const uid = userCredential.user.uid;
        await setDoc(doc(db,"users",uid),{name:username,role:sessions:[], sessions:[]});
        currentUser=userCredential.user;
        msg.innerText="";
        populateDropdowns();
        showScreen("setupScreen");
    }catch(e){ msg.innerText=e.message; }
}

async function login(){
    const email=document.getElementById("email").value;
    const password=document.getElementById("password").value;
    const msg=document.getElementById("loginMessage");
    if(!email||!password){ msg.innerText="Enter email & password!"; return; }
    try{
        const userCredential = await signInWithEmailAndPassword(auth,email,password);
        currentUser=userCredential.user;
        msg.innerText="";
        populateDropdowns();
        showScreen("setupScreen");
    }catch(e){ msg.innerText=e.message; }
}

// ------------------------------
// Save Session to Firestore
// ------------------------------
async function saveSession(){
    if(!currentUser) return;
    const uid=currentUser.uid;
    const userRef=doc(db,"users",uid);
    await updateDoc(userRef,{sessions:arrayUnion({...currentSession,date:Timestamp.now()})});
}

// ------------------------------
// View History
// ------------------------------
async function viewHistory(){
    if(!currentUser) return;
    const uid=currentUser.uid;
    const userDoc = await getDoc(doc(db,"users",uid));
    if(userDoc.exists()){
        const sessions = userDoc.data().sessions || [];
        const table = document.createElement("table");
        table.innerHTML="<tr><th>Date</th><th>Total Score</th><th>Ends</th></tr>";
        sessions.forEach(s=>{
            const date = new Date(s.date.seconds*1000).toLocaleDateString();
            table.innerHTML+=`<tr><td>${date}</td><td>${s.totalScore}</td><td>${s.ends.length}</td></tr>`;
        });
        document.getElementById("historyTable").innerHTML="";
        document.getElementById("historyTable").appendChild(table);
        showScreen("historyScreen");
    }
}

// ------------------------------
// Attach Button Handlers
// ------------------------------
function attachButtons(){
    document.getElementById("signupBtn").addEventListener("click", signup);
    document.getElementById("loginBtn").addEventListener("click", login);
}
