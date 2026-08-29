// Ported from team's interview-face-analysis project (drawLandmarks.js)
// Re-themed to use the app's cyan/violet accent colors instead of plain lime.
export function drawLandmarks(canvas, results) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.faceLandmarks.length) return;

  const landmarks = results.faceLandmarks[0];

  ctx.fillStyle = 'rgba(0, 212, 255, 0.85)';

  landmarks.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x * canvas.width, point.y * canvas.height, 1.4, 0, 2 * Math.PI);
    ctx.fill();
  });
}
