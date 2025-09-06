let history = JSON.parse(localStorage.getItem("archeryHistory")) || [];
let list = document.getElementById('historyList');

history.forEach(s => {
  let li = document.createElement('li');
  li.innerText = `${s.date} - Total: ${s.total}, Avg: ${s.avg}`;
  list.appendChild(li);
});

// Chart
let ctx = document.getElementById('statsChart').getContext('2d');
new Chart(ctx, {
  type: 'line',
  data: {
    labels: history.map(s => s.date),
    datasets: [{
      label: 'Total Score',
      data: history.map(s => s.total),
      borderColor: 'blue',
      fill: false
    }]
  }
});
