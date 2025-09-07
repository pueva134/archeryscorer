import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, set, push } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_APP.firebaseapp.com",
  databaseURL: "https://YOUR_APP.firebaseio.com",
  projectId: "YOUR_APP",
  storageBucket: "YOUR_APP.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let arrowsPerEnd, endsCount, currentEnd, currentArrow;
let allScores = [];
let ctx, canvas, radius;
let bowStyle, targetFace;
let username;

// LOGIN
window.login = function () {
  username = document.getElementById("username").value.trim();
  if (!username) {
    alert("Please enter your name");
    return;
  }
  localStorage.setItem("archerName", username);
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("mainScreen").style.display = "block";
  document.getElementById("welcomeText").textContent = `Welcome, ${username}!`;
};

// START SESSION
window.startSession = function () {
  arrowsPerEnd = parseInt(document.getElementById("arrowsPerEnd").value);
  endsCount = parseInt(document.getElementById("endsCount").value);
  bowStyle = document.getElementById("bowStyle").value;
  targetFace = document.getElementById("targetFace").value;

  allScores = [];
  currentEnd = 1;
  currentArrow = 1;

  document.getElementById("mainScreen").style.display = "none";
  document.getElementById("scoringScreen").style.display = "block";
  document.getElementById("sessionTitle").textContent = `Session for ${username}`;

  canvas = document.getElementById("targetCanvas");
  ctx = canvas.getContext("2d");
  radius = canvas.width / 2;
  drawTarget();
  updateScoreInfo();
};

// DRAW TARGET
function drawTarget() {
  let colors = ["white", "black", "blue", "red", "gold"];
  let rings = targetFace === "indoor" ? 5 : 10;

  for (let i = rings; i >= 1; i--) {
    ctx.beginPath();
    ctx.arc(radius, radius, (radius / rings) * i, 0, Math.PI * 2);
    ctx.fillStyle = colors[Math.floor((i - 1) / 2)];
    ctx.fill();
    ctx.stroke();
  }
}

// UPDATE SCORE INFO
function updateScoreInfo() {
  document.getElementById("scoreInfo").textContent =
    `End ${currentEnd}/${endsCount}, Arrow ${currentArrow}/${arrowsPerEnd}`;
}

// END SESSION
window.endSession = function () {
  let sessionData = {
    name: username,
    date: new Date().toLocaleString(),
    bowStyle,
    targetFace,
    arrowsPerEnd,
    endsCount,
    scores: allScores
  };

  const sessionRef = push(ref(db, "sessions"));
  set(sessionRef, sessionData);

  alert("Session saved!");
  document.getElementById("scoringScreen").style.display = "none";
  document.getElementById("historyScreen").style.display = "block";
};
