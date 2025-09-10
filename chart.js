// chart.js

export function drawPerformanceChart(ctx, scoreArray) {
  // Using Chart.js; ctx is the canvas context
  new Chart(ctx, {
    type: "line",
    data: {
      labels: scoreArray.map((_, i) => `End ${i+1}`),
      datasets: [{
        label: "Total Score per End",
        data: scoreArray.map(end => end.reduce((s, v) => s+v, 0)),
        borderColor: "blue",
        fill: false,
      }]
    }
  });
}
