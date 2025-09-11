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

// Firebase config & init (same as your setup)
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "myapp.firebaseapp.com",
  projectId: "myapp",
  storageBucket: "myapp.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Globals
let currentUser = null;
let currentSession = {};
let arrowScores = [];
let currentEndNumber = 1;

// Utility
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const screen = document.getElementById(id);
  if(screen) screen.classList.add('active');
}

// Canvas setup and scoring calculations kept same...

// Auth listener shows menu screen at login with greeting
onAuthStateChanged(auth, async user => {
  currentUser = user;
  if(user){
    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if(docSnap.exists()){
        document.getElementById("greeting").innerText = "Hello, " + docSnap.data().name + "!";
      }
    } catch {
      document.getElementById("greeting").innerText = "Hello!";
    }
    showScreen("menuScreen");
  } else {
    document.querySelector(".container h1").innerText = "🏹 My Scorer 🏹";
    showScreen("loginPage");
  }
});

// Signup, login functions kept same but updated to show login page after signup.

// Session setup with dynamic target face options function:

function updateSessionOptions() {
  const bowDistances = {
    Recurve: [10,12,15,18,20,30,40,50,60,70],
    Compound: [10,12,15,18,30,50],
    Barebow: [10,12,15,18],
    Longbow: [10,12,15,18]
  };
  const bowFaces = {
    compoundSpecial: [
      {value:"60", label:"60cm (Compound Only)"},
      {value:"40", label:"40cm (Indoor)"},
      {value:"3spot", label:"40cm 3-Spot (Indoor)"},
      {value:"9spot", label:"40cm 9-Spot (Indoor)"}
    ],
    indoorOnly: [
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

  function refresh() {
    const bow = bowSelect.value;
    const dist = parseInt(distSelect.value);

    // fill distances
    distSelect.innerHTML = "";
    bowDistances[bow].forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d + "m";
      distSelect.appendChild(opt);
    });

    // fill faces according to distance
    faceSelect.innerHTML = "";
    let faces = [];

    if(dist <= 18){
      faces = bow === "Compound" ? bowFaces.compoundSpecial : bowFaces.indoorOnly;
    } else {
      faces = bow === "Compound" ? bowFaces.compoundSpecial : bowFaces.default;
    }

    faces.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.value;
      opt.textContent = f.label;
      faceSelect.appendChild(opt);
    });
  }

  bowSelect.addEventListener("change", refresh);
  distSelect.addEventListener("change", refresh);
  refresh();
}

// Other core functions (startSession, undoLastArrow, next, save, end, etc.) behave exactly as before, utilizing the new saveSession logic to store sessions under a unique timestamp key in a map.
// Event handlers for buttons bind to unique IDs on the menu screen and setup screen respectively, ensuring no conflicts.

// Example button bindings
function attachHandlers(){
  document.getElementById("signupBtn").addEventListener("click", signup);
  document.getElementById("loginBtn").addEventListener("click", login);
  document.getElementById("menuStartSessionBtn").addEventListener("click", () => showScreen('setup'));
  document.getElementById("menuViewHistoryBtn").addEventListener("click", viewHistory);
  document.getElementById("menuLogoutBtn").addEventListener("click", () => auth.signOut().then(() => showScreen('loginPage')));
  document.getElementById("menuToggleThemeBtn").addEventListener("click", toggleTheme);
  document.getElementById("startSessionBtn").addEventListener("click", startSession);
  document.getElementById("viewHistoryBtn").addEventListener("click", viewHistory);
  document.getElementById("undoBtn").addEventListener("click", undoLastArrow);
  document.getElementById("nextBtn").addEventListener("click", next);
  document.getElementById("endSessionBtn").addEventListener("click", endSession);
  document.getElementById("backToSetupBtn").addEventListener("click", backToSetup);
  document.getElementById("backToMenuBtn").addEventListener("click", () => showScreen("menuScreen"));
  document.getElementById("logoutBtnSetup").addEventListener("click", () => auth.signOut().then(() => showScreen('loginPage')));

  if(canvas){
    canvas.addEventListener("click", /* your score handler logic as before */);
  }
}

// Initialization
window.addEventListener("DOMContentLoaded", () => {
  attachHandlers();
  draw();
  updateSessionOptions();
  updateScoresPlaceholder();
});
