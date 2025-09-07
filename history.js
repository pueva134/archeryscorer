import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import Chart from "https://cdn.jsdelivr.net/npm/chart.js/auto/auto.js";

// Firebase config (same as script.js)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_APP.firebaseapp.com",
  databaseURL: "https://YOUR_APP.firebaseio.com",
  projectId: "YOUR_APP",
  storageBucket: "YOUR_APP.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// HISTORY
const historyList = document.getElementById("historyList");
const chartCanvas = document.getElementById("historyChart");

onValue(ref(db, "sessions"), (snapshot) => {
  historyList.innerHTML = "";
  let labels = [];
  let totals = [];

  snapshot.forEach((child) => {
    const data = child.val();
    let totalScore = data.scores.reduce((a, b) => a + b, 0);

    let li = document.createElement("li");
    li.textContent = `${data.name} - ${data.date} | Total: ${totalScore}`;
    historyList.appendChild(li);

    labels.push(data.date);
    totals.push(totalScore);
  });

  new Chart(chartCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Total Scores",
        data: totals,
        borderColor: "blue",
        fill: false
      }]
    }
  });
});

// BACK TO MAIN
window.backToMain = function () {
  document.getElementById("historyScreen").style.display = "none";
  document.getElementById("mainScreen").style.display = "block";
};
