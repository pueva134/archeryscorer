let arrowsPerEnd, endsCount, currentEnd, currentArrow;
let allScores = [];
let ctx, canvas, radius;
let bowStyle, targetFace;
let currentEndScores = [];   // stores scores for the current end


// LOGIN & MAIN SCREEN FUNCTIONS
function login() {
  const name = document.getElementById('username').value.trim();
  if(name === "") {
    alert("Please enter your name");
    return;
  }
  localStorage.setItem("archerName", name);
  document.getElementById('displayName').innerText = name;
  document.getElementById('loginPage').style.display = "none";
  document.getElementById('mainScreen').style.display = "block";
}

function goToSelection() {
  document.getElementById('mainScreen').style.display = "none";
  document.getElementById('setup').style.display = "block";
}
// SELECTION AREA DYNAMIC UPDATES
const bowStyleSelect = document.getElementById('bowStyle');
const distanceSelect = document.getElementById('distance');
const targetFaceSelect = document.getElementById('targetFace');

// Bow → Distance mapping
const bowDistances = {
  "Recurve": [15, 18, 30, 40, 70],
  "Compound": [15, 18, 50],
  "Barebow": [15, 18, 30, 40],
  "Longbow": [15, 18, 30, 40]
};

// Distance → Target face mapping
function getTargetFaces(bow, distance) {
  // Special case: Compound 50m → only 40cm indoor
  if (bow === "Compound" && distance === 50) {
    return [
      { value: "40", text: "40cm (Indoor)" }
    ];
  }

  if (distance === 15 || distance === 18) {
    return [
      { value: "40", text: "40cm (Indoor)" },
      { value: "3spot", text: "40cm 3-Spot (Indoor)" },
      { value: "9spot", text: "40cm 9-Spot (Indoor)" }
    ];
  } else {
    return [
      { value: "122", text: "122cm (Outdoor)" },
      { value: "80", text: "80cm (Outdoor)" }
    ];
  }
}

// Update distance options when bow style changes
bowStyleSelect.addEventListener('change', () => {
  const bow = bowStyleSelect.value;
  const distances = bowDistances[bow] || [];
  
  distanceSelect.innerHTML = "";
  distances.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.text = `${d}m`;
    distanceSelect.appendChild(opt);
  });

  updateTargetFaces();
});

// Update target faces when distance changes
distanceSelect.addEventListener('change', updateTargetFaces);

function updateTargetFaces() {
  const bow = bowStyleSelect.value;
  const dist = parseInt(distanceSelect.value);
  const faces = getTargetFaces(bow, dist);

  targetFaceSelect.innerHTML = "";
  faces.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.value;
    opt.text = f.text;
    targetFaceSelect.appendChild(opt);
  });
}

// Initialize selection area on page load
bowStyleSelect.dispatchEvent(new Event('change'));


// START SESSION
function startSession() {
  bowStyle = document.getElementById('bowStyle').value;
  targetFace = document.getElementById('targetFace').value;
  const distance = parseInt(document.getElementById('distance').value);
  arrowsPerEnd = parseInt(document.getElementById('arrowsPerEnd').value);
  endsCount = parseInt(document.getElementById('endsCount').value);
  currentEnd = 1;
  currentArrow = 0;
  allScores = [];

  document.getElementById('setup').style.display = 'none';
  document.getElementById('scoringArea').style.display = 'block';

  canvas = document.getElementById('target');
  ctx = canvas.getContext('2d');
  radius = canvas.width / 2;
  drawTarget();

  canvas.addEventListener('click', scoreArrow);
  updateEndDisplay();
}

// DRAW TARGET
function drawTarget() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let minRing = 1; // default outdoor (1–10)

  if (targetFace === "40" || targetFace === "3spot") {
    minRing = 6; // indoor & 3-spot start from 6
  }
if (targetFace === "9spot") {
    drawNineSpot();
    return;
}
  // Draw single face
  if (targetFace !== "3spot") {
    let ringCount = 10 - minRing + 1;
    for (let i = 10; i >= minRing; i--) {
      ctx.beginPath();
      ctx.arc(radius, radius, (i - minRing + 1) * (radius / ringCount), 0, Math.PI * 2);
      ctx.fillStyle = getColorForRing(i);
      ctx.fill();
      ctx.strokeStyle = "#080808ff";
      ctx.stroke();
    }
  } else {
    // Draw 3 vertical indoor spots
    const spotRadius = radius / 3;
    const centers = [
      { x: radius, y: radius / 2 },
      { x: radius, y: radius },
      { x: radius, y: radius * 1.5 }
    ];
    centers.forEach(c => {
      for (let i = 10; i >= 6; i--) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, (10 - i + 1) * (spotRadius / 5), 0, Math.PI * 2);
        ctx.fillStyle = getColorForRing(i);
        ctx.fill();
        ctx.strokeStyle = "#0c0c0cff";
        ctx.stroke();
      }
    });
  }
}
function drawNineSpot() {
  const spotRadius = radius / 5; // size of each mini target
  const gap = spotRadius * 2.5;  // spacing between centers

  const centers = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      centers.push({
        x: radius - gap + col * gap,
        y: radius - gap + row * gap
      });
    }
  }

  // Draw each mini target (only rings 4 & 5)
  centers.forEach(c => {
    for (let i = 5; i >= 4; i--) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, (i - 3) * (spotRadius / 2), 0, Math.PI * 2);
      ctx.fillStyle = getColorForRing(i);
      ctx.fill();
      ctx.strokeStyle = "#0e0c0cff";
      ctx.stroke();
    }
  });

  // Save centers globally so scoring works
  window.nineSpotCenters = centers;
  window.nineSpotRadius = spotRadius;
}


// RING COLORS
function getColorForRing(score) {
  if (score >= 9) return "#d7f52bff"; // Gold
  if (score >= 7) return "#FF0000"; // Red
  if (score >= 5) return "#02cbfdff"; // Blue
  if (score >= 3) return "#000000"; // Black
  return "#FFFFFF"; // White
}

// GET TARGET FACE SCORES
function getTargetFaceScores(faceType) {
  switch(faceType) {
      case '40': // indoor
      case '3spot': // compound/3-spot
          return [1,2,3,4,5];
      case '9spot': // 9-spot
          return [4,5]
      default: // outdoor/standard
          return [1,2,3,4,5,6,7,8,9,10];
  }
}

// CALCULATE SCORE
function calculateScore(distance, maxRadius, faceType) {
  const scores = getTargetFaceScores(faceType);
  const step = maxRadius / scores.length;
  for (let i = 0; i < scores.length; i++) {
      if (distance <= step * (i + 1)) {
          return scores[scores.length - 1 - i];
      }
  }
  return 0;
}

// HANDLE ARROW SCORING
function scoreArrow(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  let score = 0;

  if (targetFace === "9spot") {
    nineSpotCenters.forEach(c => {
      const d = Math.sqrt((x - c.x) ** 2 + (y - c.y) ** 2);
      if (d <= nineSpotRadius) {
        score = d <= nineSpotRadius / 2 ? 5 : 4;
      }
    });
  } else {
    // existing outdoor/indoor logic
    const dx = x - radius;
    const dy = y - radius;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= radius) {
      score = calculateScore(dist, radius, targetFace);
    }
  }

// Update scoreArrow function
if (!allScores[currentEnd - 1]) allScores[currentEnd - 1] = [];
if (allScores[currentEnd - 1].length < arrowsPerEnd) {
    allScores[currentEnd - 1].push(score);
    currentArrow++;

    // Calculate total for this end
    const currentEndTotal = allScores[currentEnd - 1].reduce((a, b) => a + b, 0);
    document.getElementById('endTotal').innerText = `End Total: ${currentEndTotal}`;
}


  updateEndDisplay();

  if (currentArrow >= arrowsPerEnd) {
    setTimeout(nextEnd, 500);
  }
}
function undoLastArrow() {
    if (currentArrow === 0 && currentEnd === 1) {
        alert("No arrows to undo.");
        return;
    }

    if (currentArrow === 0) {
        // Move back to previous end
        currentEnd--;
        currentArrow = allScores[currentEnd - 1].length;
    }

    if (currentArrow > 0) {
        allScores[currentEnd - 1].pop();
        currentArrow--;
        updateEndDisplay();
    }
}


// UPDATE DISPLAY
function updateEndDisplay() {
  document.getElementById('currentEnd').innerText = currentEnd;

  const scores = allScores[currentEnd - 1] || [];
  document.getElementById('endScores').innerText = `Arrows: ${scores.join(", ")}`;

  const total = scores.reduce((a, b) => a + b, 0);
  document.getElementById('endTotal').innerText = `End Total: ${total}`;
}



// NEXT END
function nextEnd() {
  if (currentEnd < endsCount) {
    currentEnd++;
    currentArrow = 0;
    updateEndDisplay();
  } else {
    finishSession();
  }
}

// FINISH SESSION
function finishSession() {
  document.getElementById('scoringArea').style.display = 'none';
  document.getElementById('results').style.display = 'block';

  const total = allScores.flat().reduce((a, b) => a + b, 0);
  const arrowsShot = arrowsPerEnd * endsCount;
  const avg = (total / arrowsShot).toFixed(2);
  const distance = parseInt(document.getElementById('distance').value); // new

  document.getElementById('resultBow').innerText = bowStyle;
  document.getElementById('resultTarget').innerText = targetFace;
  document.getElementById('resultDistance').innerText = distance; // new
  document.getElementById('totalScore').innerText = total;
  document.getElementById('avgScore').innerText = avg;

  // UPDATE CHART
  updateScoreChart();
  function updateScoreChart() {
    const ctx = document.getElementById('scoreChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: allScores.map((_, i) => `End ${i + 1}`),
        datasets: [{
          label: 'Scores',
          data: allScores.map(end => end.reduce((a, b) => a + b, 0)),
          borderColor: '#ff5e62',
          backgroundColor: 'rgba(255, 94, 98, 0.2)',
          fill: true
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }


  // CREATE TABLE OF SCORES
const tableContainer = document.getElementById('scoreTable');
tableContainer.innerHTML = "";

const table = document.createElement('table');
table.style.borderCollapse = "collapse";
table.style.width = "100%";

// HEADER
const header = document.createElement('tr');

// "End" header
const endHeader = document.createElement('th');
endHeader.innerText = "End";
endHeader.style.border = "1px solid #000";
header.appendChild(endHeader);

// Arrow headers
for (let i = 1; i <= arrowsPerEnd; i++) {
  const th = document.createElement('th');
  th.innerText = `Arrow ${i}`;
  th.style.border = "1px solid #000";
  header.appendChild(th);
}

// Add "End Total" header
const totalHeader = document.createElement('th');
totalHeader.innerText = "End Total";
totalHeader.style.border = "1px solid #000";
header.appendChild(totalHeader);

table.appendChild(header);

// ROWS
allScores.forEach((endScores, index) => {
  const row = document.createElement('tr');

  // End number
  const endCell = document.createElement('td');
  endCell.innerText = index + 1;
  endCell.style.border = "1px solid #000";
  row.appendChild(endCell);

  // Individual arrow scores
  for (let i = 0; i < arrowsPerEnd; i++) {
    const cell = document.createElement('td');
    cell.innerText = endScores[i] !== undefined ? endScores[i] : "-";
    cell.style.border = "1px solid #000";
    row.appendChild(cell);
  }

  // End total
  const endTotalCell = document.createElement('td');
  const endTotal = endScores.reduce((a, b) => a + b, 0);
  endTotalCell.innerText = endTotal;
  endTotalCell.style.border = "1px solid #000";
  row.appendChild(endTotalCell);

  table.appendChild(row);
});

tableContainer.appendChild(table);


  // SAVE SESSION HISTORY
const history = JSON.parse(localStorage.getItem("archeryHistory")) || [];
  history.push({
    name: localStorage.getItem("archerName"),
    date: new Date().toLocaleString(),
    bow: bowStyle,
    target: targetFace,
    distance: distance, // added
    total,
    avg,
    ends: allScores
  });
  localStorage.setItem("archeryHistory", JSON.stringify(history));
}
function viewUserHistory() {
  const name = localStorage.getItem("archerName");
  if (!name) return alert("Please login first.");

  const history = JSON.parse(localStorage.getItem("archeryHistory")) || [];
  const userHistory = history.filter(h => h.name === name);

  const container = document.getElementById("historyContainer");
  container.innerHTML = "";

  if (userHistory.length === 0) {
    container.innerHTML = "<p>No history yet.</p>";
    return;
  }

  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.style.width = "100%";

const header = document.createElement("tr");
["Date", "Bow", "Distance", "Target", "Total", "Average", "Details"].forEach(text => {
  const th = document.createElement("th");
  th.innerText = text;
  th.style.border = "1px solid #000";
  th.style.padding = "5px";
  header.appendChild(th);
});
table.appendChild(header);

userHistory.forEach(h => {
  const row = document.createElement("tr");
  [h.date, h.bow, h.distance + "m", h.target, h.total, h.avg].forEach(val => {
    const td = document.createElement("td");
    td.innerText = val;
    td.style.border = "1px solid #000";
    td.style.padding = "5px";
    row.appendChild(td);
  });

  const tdButton = document.createElement("td");
  const btn = document.createElement("button");
  btn.innerText = "View Details";
  btn.onclick = () => viewSessionDetails(h);
  tdButton.appendChild(btn);
  row.appendChild(tdButton);

  table.appendChild(row);
});



  container.appendChild(table);
}
function viewSessionDetails(session) {
  // Hide setup/history, show results card
  document.getElementById('setup').style.display = 'none';
  document.getElementById('results').style.display = 'block';

  // Fill basic info
  document.getElementById('resultBow').innerText = session.bow;
  document.getElementById('resultTarget').innerText = session.target;
  document.getElementById('totalScore').innerText = session.total;
  document.getElementById('avgScore').innerText = session.avg;

  // CREATE TABLE OF SCORES
  const tableContainer = document.getElementById('scoreTable');
  tableContainer.innerHTML = "";

  const table = document.createElement('table');
  table.style.borderCollapse = "collapse";
  table.style.width = "100%";

  const header = document.createElement('tr');
  const endHeader = document.createElement('th');
  endHeader.innerText = "End";
  endHeader.style.border = "1px solid #000";
  header.appendChild(endHeader);

  for (let i = 1; i <= session.ends[0].length; i++) {
    const th = document.createElement('th');
    th.innerText = `Arrow ${i}`;
    th.style.border = "1px solid #000";
    header.appendChild(th);
  }

  const totalTh = document.createElement('th');
  totalTh.innerText = "End Total";
  totalTh.style.border = "1px solid #000";
  header.appendChild(totalTh);

  table.appendChild(header);

  session.ends.forEach((endScores, index) => {
    const row = document.createElement('tr');
    const endCell = document.createElement('td');
    endCell.innerText = index + 1;
    endCell.style.border = "1px solid #000";
    row.appendChild(endCell);

    for (let i = 0; i < endScores.length; i++) {
      const cell = document.createElement('td');
      cell.innerText = endScores[i] !== undefined ? endScores[i] : "-";
      cell.style.border = "1px solid #000";
      row.appendChild(cell);
    }

    const endTotalCell = document.createElement('td');
    const endTotal = endScores.reduce((a, b) => a + b, 0);
    endTotalCell.innerText = endTotal;
    endTotalCell.style.border = "1px solid #000";
    row.appendChild(endTotalCell);

    table.appendChild(row);
  });

  tableContainer.appendChild(table);

  // DRAW CHART
  const ctx = document.getElementById('scoreChart').getContext('2d');
  if (window.scoreChartInstance) window.scoreChartInstance.destroy(); // destroy old chart if exists

  window.scoreChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: session.ends.map((_, i) => `End ${i + 1}`),
      datasets: [{
        label: 'Scores',
        data: session.ends.map(end => end.reduce((a, b) => a + b, 0)),
        borderColor: '#ff5e62',
        backgroundColor: 'rgba(255, 94, 98, 0.2)',
        fill: true
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function backToSetup() {
  document.getElementById('results').style.display = 'none';
  document.getElementById('setup').style.display = 'block';
}
function logout() {
  // Clear current user
  localStorage.removeItem("archerName");

  // Hide all other screens
  document.getElementById('mainScreen').style.display = 'none';
  document.getElementById('setup').style.display = 'none';
  document.getElementById('scoringArea').style.display = 'none';
  document.getElementById('results').style.display = 'none';
  
  // Show login page
  document.getElementById('loginPage').style.display = 'block';
}


