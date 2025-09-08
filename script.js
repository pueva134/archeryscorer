// ------------------------------
// Firebase Initialization
// ------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, Timestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = { /* your config */ };
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
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';
}

function drawTarget(faceType) {
    const canvas = document.getElementById("target");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let colors;
    switch(faceType){
        case "Indoor":
            colors = ['#f00','#f90','#ff0','#0f0','#00f']; break;
        case "Outdoor":
            colors = ['#f00','#ff0','#0f0','#00f','#0ff']; break;
        case "Compound":
            colors = ['#ff0','#0f0','#00f','#0ff','#f0f']; break;
        default:
            colors = ['#f00','#f90','#ff0','#0f0','#00f'];
    }

    const radius = canvas.width / 2;
    for (let i=0; i<colors.length; i++){
        ctx.beginPath();
        ctx.arc(radius, radius, radius - i*30, 0, 2*Math.PI);
        ctx.fillStyle = colors[i];
        ctx.fill();
    }
}

// ------------------------------
// Scoring Functions
// ------------------------------
function addArrowScore(score, note="") {
    const allowedScores = getAllowedScores(currentSession.bowStyle, currentSession.targetFace);
    if(!allowedScores.includes(score)){
        alert("Invalid score for this target type!");
        return;
    }
    arrowScores.push(score);
    arrowNotes.push(note);
    updateEndScores();
    updateStreak(score);
    if(arrowScores.length === currentSession.arrowsPerEnd){
        alert("End complete! Proceed to next end.");
    }
}

function updateEndScores(){
    document.getElementById("endScores").innerText = arrowScores.map((s,i)=>`${s}${arrowNotes[i]?'*':''}`).join(" | ");
    document.getElementById("endTotal").innerText = "End Total: " + arrowScores.reduce((a,b)=>a+b,0);
}

function undoLastArrow(){
    arrowScores.pop();
    arrowNotes.pop();
    updateEndScores();
}

function nextEnd(){
    if(arrowScores.length !== currentSession.arrowsPerEnd){
        alert("Shoot all arrows first!");
        return;
    }
    currentSession.ends.push({scores:[...arrowScores], notes:[...arrowNotes]});
    currentSession.totalScore += arrowScores.reduce((a,b)=>a+b,0);
    arrowScores = [];
    arrowNotes = [];
    currentEndNumber++;
    if(currentEndNumber > currentSession.endsCount){
        saveSession();
        showResults();
    } else {
        document.getElementById("currentEnd").innerText = currentEndNumber;
        updateEndScores();
    }
}

// ------------------------------
// Bow/Target Rules
// ------------------------------
function getAllowedScores(bowStyle, targetFace){
    if(targetFace.includes("Indoor")) return [0,1,2,3,4,5]; // Indoor max 5
    if(bowStyle==="Compound") return [6,7,8,9,10]; // Compound min 6
    return [1,2,3,4,5,6,7,8,9,10];
}

// ------------------------------
// Streaks & Achievements
// ------------------------------
function updateStreak(score){
    if(score >= 8){
        streak++;
        if(streak === 3 && !achievements.includes("3-arrow streak")) achievements.push("3-arrow streak");
    } else streak=0;
}

// ------------------------------
// Session Management
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
    document.getElementById("currentEnd").innerText = currentEndNumber;
    drawTarget(currentSession.targetFace);
    updateEndScores();
    showScreen("scoringArea");
}

async function saveSession(){
    if(!currentUser) return;
    const uid = currentUser.uid;
    const userRef = doc(db,"users",uid);
    await updateDoc(userRef,{
        sessions: arrayUnion({...currentSession, date: Timestamp.now(), achievements})
    });
}

// ------------------------------
// Results
// ------------------------------
function showResults(){
    showScreen("results");
    const tableDiv = document.getElementById("scoreTable");
    tableDiv.innerHTML = "";
    const table = document.createElement("table");
    const header = document.createElement("tr");
    header.innerHTML = "<th>End</th>" + [...Array(currentSession.arrowsPerEnd)].map((_,i)=>`<th>Arrow ${i+1}</th>`).join("") + "<th>End Total</th>";
    table.appendChild(header);
    currentSession.ends.forEach((end,i)=>{
        const row = document.createElement("tr");
        const total = end.scores.reduce((a,b)=>a+b,0);
        row.innerHTML = `<td>${i+1}</td>` + end.scores.map(s=>`<td>${s}</td>`).join("") + `<td>${total}</td>`;
        table.appendChild(row);
    });
    tableDiv.appendChild(table);

    // Chart
    const ctxChart = document.getElementById("scoreChart").getContext("2d");
    new Chart(ctxChart, {
        type:'bar',
        data:{
            labels: currentSession.ends.map((_,i)=>`End ${i+1}`),
            datasets:[{label:'End Total', data: currentSession.ends.map(e=>e.scores.reduce((a,b)=>a+b,0)), backgroundColor:'rgba(59,130,246,0.7)'}]
        },
        options:{responsive:true, maintainAspectRatio:false}
    });
}

// ------------------------------
// Initialize
// ------------------------------
onAuthStateChanged(auth, user => { if(user) currentUser = user; });
window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("startSessionBtn")?.addEventListener("click", startSession);
});
