// --- 3D Water Sphere AR Experience ---
// Interactive water sphere with heightfield simulation (replicating WebGL Water demo)

let sphereRadius = 200;
let rotationX = 0;
let rotationY = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let isDrawing = false;
let lastDrawTheta = 0;
let lastDrawPhi = 0;
let time = 0;
let audioContext;
let showInstructions = true; // Show instructions on first load

// Heightfield water simulation (exact replication of Evan Wallace's WebGL Water)
let heightfieldCols = 256;
let heightfieldRows = 128;
let heightfieldCurrent = [];
let heightfieldPrevious = [];
let damping = 0.985; // Slightly less damping for more visible ripples

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);

  // Initialize audio context
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.log("Audio context not available:", e);
  }

  // Adjust sphere size based on screen
  sphereRadius = min(windowWidth, windowHeight) * 0.3;

  // Initialize heightfield for water simulation
  for (let i = 0; i < heightfieldCols; i++) {
    heightfieldCurrent[i] = [];
    heightfieldPrevious[i] = [];
    for (let j = 0; j < heightfieldRows; j++) {
      heightfieldCurrent[i][j] = 0;
      heightfieldPrevious[i][j] = 0;
    }
  }

  // Create water-like material
  noStroke();
}

function draw() {
  time += 0.016; // ~60fps

  // Show instructions screen on first load
  if (showInstructions) {
    drawInstructions();
    return; // Don't draw the sphere until instructions are dismissed
  }

  // Update heightfield water simulation (exact wave equation from WebGL Water)
  updateHeightfield();

  // Pool water blue gradient background (from index.html)
  // Use middle gradient color for 3D background
  background(0, 100, 165);

  // Enhanced lighting for realistic pool water with caustics
  ambientLight(60, 100, 150);
  directionalLight(255, 255, 255, 0.3, -0.8, 0.5); // Main light for caustics
  pointLight(255, 255, 255, 0, -500, 600);
  pointLight(200, 230, 255, -400, 300, 400); // Additional light for depth

  // Center the sphere
  push();

  // Apply rotation
  rotateX(rotationX);
  rotateY(rotationY);

  // Draw the water sphere with heightfield-based surface
  drawWaterSphere();

  // Draw caustic patterns on sphere
  drawCausticsOnSphere();

  pop();
}

function drawInstructions() {
  // Blue background matching water color
  background(0, 120, 190);

  // Render text in WebGL mode
  push();
  resetMatrix();

  // White text with high contrast
  fill(255, 255, 255);
  noStroke();
  textAlign(CENTER, CENTER);

  // Larger, responsive text size
  let fontSize = min(width, height) * 0.08;
  textSize(fontSize);
  textStyle(BOLD);

  // Main instruction text - split into two lines
  text("Turn up your volume", 0, -fontSize * 0.6);
  text("and tap the screen!", 0, fontSize * 0.6);

  pop();
}

function drawWaterSphere() {
  push();

  // Pool water blue color (from index.html) - deep blue with transparency
  fill(0, 120, 190, 140);

  // Very high shininess for water reflection
  shininess(400);

  // Draw sphere with heightfield distortion
  drawHeightfieldSphere(sphereRadius, 80, 80);

  pop();
}

function drawHeightfieldSphere(radius, detailX, detailY) {
  let vertices = [];
  let normals = [];
  let colors = [];

  // Generate vertices with heightfield distortion
  for (let i = 0; i <= detailY; i++) {
    let v = i / detailY;
    let phi = v * PI;

    for (let j = 0; j <= detailX; j++) {
      let u = j / detailX;
      let theta = u * TWO_PI;

      // Base sphere position
      let x = radius * sin(phi) * cos(theta);
      let y = radius * cos(phi);
      let z = radius * sin(phi) * sin(theta);

      // Get heightfield value for this position
      let thetaIndex = floor((theta / TWO_PI) * heightfieldCols);
      let phiIndex = floor((phi / PI) * heightfieldRows);

      // Handle wrap-around for theta
      if (thetaIndex < 0) thetaIndex += heightfieldCols;
      if (thetaIndex >= heightfieldCols) thetaIndex -= heightfieldCols;
      phiIndex = constrain(phiIndex, 0, heightfieldRows - 1);

      // Get height from heightfield (normalized, but allow values > 255)
      // Clamp to reasonable range for visualization
      let rawHeight = heightfieldCurrent[thetaIndex][phiIndex];
      let height = constrain(rawHeight, -400, 400) / 400.0;

      // Calculate normal for distortion
      let normal = createVector(x, y, z).normalize();

      // Apply heightfield distortion - make ripples much more visible
      let distortion = height * 50; // Strong distortion for visible ripples
      x += normal.x * distortion;
      y += normal.y * distortion;
      z += normal.z * distortion;

      vertices.push(createVector(x, y, z));

      // Calculate normal with heightfield influence for lighting
      let neighborTheta = (thetaIndex + 1) % heightfieldCols;
      let neighborPhi = min(phiIndex + 1, heightfieldRows - 1);
      let neighborHeight = constrain(heightfieldCurrent[neighborTheta][phiIndex], -400, 400) / 400.0;
      let neighborHeightY = constrain(heightfieldCurrent[thetaIndex][neighborPhi], -400, 400) / 400.0;
      let heightX = (neighborHeight - height) * 0.5;
      let heightY = (neighborHeightY - height) * 0.5;

      let normalX = normal.x + heightX;
      let normalY = normal.y + heightY;
      let normalZ = normal.z;
      let adjustedNormal = createVector(normalX, normalY, normalZ).normalize();
      normals.push(adjustedNormal);

      // Calculate color based on height and depth (pool water colors from index.html)
      let depth = (y + radius) / (radius * 2);
      let waveHeight = abs(height);

      // Base pool water color gradient (0, 120, 190 to 0, 80, 140)
      let baseR = lerp(0, 0, depth);
      let baseG = lerp(120, 80, depth);
      let baseB = lerp(190, 140, depth);

      // Add caustic-like light patterns (bright highlights on waves)
      let causticIntensity = sin(theta * 3 + time * 1.5) * 0.5 + 0.5;
      causticIntensity *= cos(phi * 4 + time * 1.0) * 0.3 + 0.7;

      // Wave height affects color (lighter on peaks, darker in valleys)
      let waveColor = waveHeight * 40;

      // Caustic highlights (bright white on wave peaks)
      let causticHighlight = waveHeight * causticIntensity * 60;

      let r = baseR + waveColor * 0.2 + causticHighlight;
      let g = baseG + waveColor * 0.3 + causticHighlight * 0.8;
      let b = baseB + waveColor * 0.4 + causticHighlight * 0.9;

      // Ensure colors stay in valid range
      r = constrain(r, 0, 255);
      g = constrain(g, 0, 255);
      b = constrain(b, 0, 255);

      colors.push([r, g, b, 140]);
    }
  }

  // Draw triangles with proper normals and colors
  beginShape(TRIANGLES);
  for (let i = 0; i < detailY; i++) {
    for (let j = 0; j < detailX; j++) {
      let a = i * (detailX + 1) + j;
      let b = a + detailX + 1;
      let c = a + 1;
      let d = b + 1;

      // First triangle
      let v1 = vertices[a];
      let v2 = vertices[b];
      let v3 = vertices[c];
      let c1 = colors[a];
      let c2 = colors[b];
      let c3 = colors[c];

      fill(c1[0], c1[1], c1[2], c1[3]);
      vertex(v1.x, v1.y, v1.z);
      fill(c2[0], c2[1], c2[2], c2[3]);
      vertex(v2.x, v2.y, v2.z);
      fill(c3[0], c3[1], c3[2], c3[3]);
      vertex(v3.x, v3.y, v3.z);

      // Second triangle
      let v4 = vertices[d];
      let c4 = colors[d];

      fill(c2[0], c2[1], c2[2], c2[3]);
      vertex(v2.x, v2.y, v2.z);
      fill(c3[0], c3[1], c3[2], c3[3]);
      vertex(v3.x, v3.y, v3.z);
      fill(c4[0], c4[1], c4[2], c4[3]);
      vertex(v4.x, v4.y, v4.z);
    }
  }
  endShape();
}

function drawCausticsOnSphere() {
  // Draw caustic light patterns on the sphere surface (like pool bottom)
  push();
  noFill();
  stroke(255, 255, 255, 80);
  strokeWeight(1);

  // Draw caustic mesh pattern on visible parts of sphere
  let detail = 20;
  for (let i = 0; i <= detail; i++) {
    let phi = (i / detail) * PI;
    beginShape();
    for (let j = 0; j <= detail * 2; j++) {
      let theta = (j / (detail * 2)) * TWO_PI;

      // Calculate position on sphere
      let x = sphereRadius * sin(phi) * cos(theta);
      let y = sphereRadius * cos(phi);
      let z = sphereRadius * sin(phi) * sin(theta);

      // Add wave distortion for caustic pattern
      let wave1 = sin(theta * 3 + time * 1.5) * 2;
      let wave2 = cos(phi * 4 + time * 1.0) * 1.5;

      // Get heightfield influence
      let thetaIndex = floor((theta / TWO_PI) * heightfieldCols);
      let phiIndex = floor((phi / PI) * heightfieldRows);
      if (thetaIndex < 0) thetaIndex += heightfieldCols;
      if (thetaIndex >= heightfieldCols) thetaIndex -= heightfieldCols;
      phiIndex = constrain(phiIndex, 0, heightfieldRows - 1);

      let height = constrain(heightfieldCurrent[thetaIndex][phiIndex], -400, 400) / 400.0;

      let normal = createVector(x, y, z).normalize();
      x += normal.x * (wave1 + wave2 + height * 3);
      y += normal.y * (wave1 + wave2 + height * 3);
      z += normal.z * (wave1 + wave2 + height * 3);

      vertex(x, y, z);
    }
    endShape();
  }

  // Draw perpendicular caustic lines
  for (let j = 0; j <= detail * 2; j++) {
    let theta = (j / (detail * 2)) * TWO_PI;
    beginShape();
    for (let i = 0; i <= detail; i++) {
      let phi = (i / detail) * PI;

      let x = sphereRadius * sin(phi) * cos(theta);
      let y = sphereRadius * cos(phi);
      let z = sphereRadius * sin(phi) * sin(theta);

      let wave1 = sin(theta * 3 + time * 1.5) * 2;
      let wave2 = cos(phi * 4 + time * 1.0) * 1.5;

      let thetaIndex = floor((theta / TWO_PI) * heightfieldCols);
      let phiIndex = floor((phi / PI) * heightfieldRows);
      if (thetaIndex < 0) thetaIndex += heightfieldCols;
      if (thetaIndex >= heightfieldCols) thetaIndex -= heightfieldCols;
      phiIndex = constrain(phiIndex, 0, heightfieldRows - 1);

      let height = constrain(heightfieldCurrent[thetaIndex][phiIndex], -400, 400) / 400.0;

      let normal = createVector(x, y, z).normalize();
      x += normal.x * (wave1 + wave2 + height * 3);
      y += normal.y * (wave1 + wave2 + height * 3);
      z += normal.z * (wave1 + wave2 + height * 3);

      vertex(x, y, z);
    }
    endShape();
  }

  pop();
}

function updateHeightfield() {
  // Exact wave equation from Evan Wallace's WebGL Water demo
  // Create new heightfield buffer
  let newHeightfield = [];
  for (let i = 0; i < heightfieldCols; i++) {
    newHeightfield[i] = [];
    for (let j = 0; j < heightfieldRows; j++) {
      newHeightfield[i][j] = 0;
    }
  }

  // Wave equation: average of 8 neighbors from previous frame minus current
  for (let i = 0; i < heightfieldCols; i++) {
    for (let j = 1; j < heightfieldRows - 1; j++) {
      // Get neighbors (handle wrap-around for theta)
      let iPrev = (i - 1 + heightfieldCols) % heightfieldCols;
      let iNext = (i + 1) % heightfieldCols;

      // Exact wave equation from WebGL Water
      newHeightfield[i][j] = (
        heightfieldPrevious[iPrev][j] +
        heightfieldPrevious[iNext][j] +
        heightfieldPrevious[i][j - 1] +
        heightfieldPrevious[i][j + 1] +
        heightfieldPrevious[iPrev][j - 1] +
        heightfieldPrevious[iPrev][j + 1] +
        heightfieldPrevious[iNext][j - 1] +
        heightfieldPrevious[iNext][j + 1]
      ) / 8 - heightfieldCurrent[i][j];

      // Apply damping (matching WebGL Water demo)
      newHeightfield[i][j] *= damping;
    }
  }

  // Update buffers
  heightfieldPrevious = heightfieldCurrent;
  heightfieldCurrent = newHeightfield;
}

// Touch and mouse interaction
function touchStarted() {
  // Dismiss instructions on first touch
  if (showInstructions) {
    showInstructions = false;
    return false;
  }

  if (touches.length > 0) {
    let touch = touches[0];
    isDrawing = true;
    handleInteraction(touch.x, touch.y, true);
  }
  return false;
}

function touchMoved() {
  if (isDrawing && touches.length > 0) {
    let touch = touches[0];
    handleInteraction(touch.x, touch.y, false);
  }
  return false;
}

function touchEnded() {
  isDrawing = false;
  return false;
}

function mousePressed() {
  // Dismiss instructions on first click
  if (showInstructions) {
    showInstructions = false;
    return;
  }

  isDragging = false;
  lastMouseX = mouseX;
  lastMouseY = mouseY;

  // Check if click is near sphere (for drawing)
  let distFromCenter = dist(mouseX - width / 2, mouseY - height / 2, 0, 0);
  if (distFromCenter < sphereRadius * 1.5) {
    isDrawing = true;
    handleInteraction(mouseX, mouseY, true);
  } else {
    isDragging = true;
  }
}

function mouseDragged() {
  if (isDragging) {
    // Rotate sphere based on mouse movement
    let deltaX = mouseX - lastMouseX;
    let deltaY = mouseY - lastMouseY;

    rotationY += deltaX * 0.01;
    rotationX += deltaY * 0.01;

    // Constrain rotation
    rotationX = constrain(rotationX, -PI / 2, PI / 2);

    lastMouseX = mouseX;
    lastMouseY = mouseY;
  } else if (isDrawing) {
    // Draw on water (like WebGL Water demo)
    handleInteraction(mouseX, mouseY, false);
  }
}

function mouseReleased() {
  isDragging = false;
  isDrawing = false;
}

function handleInteraction(x, y, isFirstTouch) {
  // Convert screen coordinates to normalized device coordinates
  let ndcX = (x / width) * 2 - 1;
  let ndcY = 1 - (y / height) * 2;

  // Map screen position to sphere surface
  let screenX = ndcX * sphereRadius;
  let screenY = ndcY * sphereRadius;

  // Calculate distance from center in screen space
  let distFromCenter = sqrt(screenX * screenX + screenY * screenY);

  // Only draw if within reasonable distance
  if (distFromCenter > sphereRadius * 1.5) return;

  // Project onto sphere surface
  let z = 0;
  if (distFromCenter < sphereRadius) {
    z = sqrt(sphereRadius * sphereRadius - distFromCenter * distFromCenter);
  }

  // Create 3D point on sphere surface
  let point3D = createVector(screenX, screenY, z);
  point3D.normalize();
  point3D.mult(sphereRadius);

  // Convert to spherical coordinates
  let r = sphereRadius;
  let phi = acos(constrain(point3D.y / r, -1, 1));
  let theta = atan2(point3D.z, point3D.x);

  // Add heightfield impulse (like drawing on water)
  addHeightfieldImpulse(theta, phi, isFirstTouch);

  // Play water sound and vibrate on first touch
  if (isFirstTouch) {
    playWaterSound();
    vibratePhone(); // Haptic feedback synchronized with ripple
  }
}

function addHeightfieldImpulse(theta, phi, isFirstTouch) {
  // Convert spherical coordinates to heightfield indices
  let thetaIndex = floor((theta / TWO_PI) * heightfieldCols);
  let phiIndex = floor((phi / PI) * heightfieldRows);

  // Handle wrap-around for theta
  if (thetaIndex < 0) thetaIndex += heightfieldCols;
  if (thetaIndex >= heightfieldCols) thetaIndex -= heightfieldCols;
  phiIndex = constrain(phiIndex, 1, heightfieldRows - 2);

  // Add strong impulse (like dropping stone or drawing)
  // Use higher value to ensure visible ripples
  let impulseStrength = 400;

  // If dragging, add continuous impulses along the path
  if (!isFirstTouch) {
    // Interpolate between last position and current to draw continuous line
    let lastThetaIndex = floor((lastDrawTheta / TWO_PI) * heightfieldCols);
    let lastPhiIndex = floor((lastDrawPhi / PI) * heightfieldRows);

    if (lastThetaIndex < 0) lastThetaIndex += heightfieldCols;
    if (lastThetaIndex >= heightfieldCols) lastThetaIndex -= heightfieldCols;
    lastPhiIndex = constrain(lastPhiIndex, 1, heightfieldRows - 2);

    // Draw line between last and current position
    let steps = max(abs(thetaIndex - lastThetaIndex), abs(phiIndex - lastPhiIndex));
    for (let s = 0; s <= steps; s++) {
      let t = s / max(steps, 1);
      let ti = floor(lerp(lastThetaIndex, thetaIndex, t));
      let pi = floor(lerp(lastPhiIndex, phiIndex, t));

      if (ti < 0) ti += heightfieldCols;
      if (ti >= heightfieldCols) ti -= heightfieldCols;
      pi = constrain(pi, 1, heightfieldRows - 2);

      heightfieldPrevious[ti][pi] = impulseStrength;

      // Add to neighbors for smoother drawing
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          let nti = (ti + di + heightfieldCols) % heightfieldCols;
          let npi = constrain(pi + dj, 1, heightfieldRows - 2);
          if (di === 0 && dj === 0) continue;
          heightfieldPrevious[nti][npi] = impulseStrength * 0.6;
        }
      }
    }
  } else {
    // Single point impulse
    heightfieldPrevious[thetaIndex][phiIndex] = impulseStrength;

    // Add to neighboring cells for smoother ripple start
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        let ti = (thetaIndex + di + heightfieldCols) % heightfieldCols;
        let pj = constrain(phiIndex + dj, 1, heightfieldRows - 2);
        if (di === 0 && dj === 0) continue;
        heightfieldPrevious[ti][pj] = impulseStrength * 0.7;
      }
    }
  }

  // Store current position for next draw
  lastDrawTheta = theta;
  lastDrawPhi = phi;
}

function vibratePhone() {
  // Trigger haptic vibration synchronized with ripple
  // Check if Vibration API is supported
  if ('vibrate' in navigator) {
    try {
      // Short vibration pattern: quick pulse for water tap
      // Pattern: [vibrate, pause, vibrate] in milliseconds
      navigator.vibrate([10, 5, 10]);
    } catch (e) {
      console.log("Vibration not available:", e);
    }
  }
}

function playWaterSound() {
  if (!audioContext) return;

  try {
    let duration = 0.3;
    let now = audioContext.currentTime;

    // Main splash - low frequency (louder)
    let osc1 = audioContext.createOscillator();
    let gain1 = audioContext.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(150, now);
    osc1.frequency.exponentialRampToValueAtTime(80, now + duration);
    gain1.gain.setValueAtTime(0.6, now); // Increased from 0.3 to 0.6
    gain1.gain.exponentialRampToValueAtTime(0.01, now + duration);
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.start(now);
    osc1.stop(now + duration);

    // High frequency splash (louder)
    let osc2 = audioContext.createOscillator();
    let gain2 = audioContext.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(400, now);
    osc2.frequency.exponentialRampToValueAtTime(200, now + duration * 0.5);
    gain2.gain.setValueAtTime(0.4, now); // Increased volume
    gain2.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.5);
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.start(now);
    osc2.stop(now + duration * 0.5);

    // Bubble/plop sound (louder)
    let osc3 = audioContext.createOscillator();
    let gain3 = audioContext.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(250, now);
    osc3.frequency.exponentialRampToValueAtTime(120, now + duration * 0.3);
    gain3.gain.setValueAtTime(0.3, now); // Increased volume
    gain3.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.3);
    osc3.connect(gain3);
    gain3.connect(audioContext.destination);
    osc3.start(now);
    osc3.stop(now + duration * 0.3);

    // Add noise for water texture (louder)
    let bufferSize = audioContext.sampleRate * duration;
    let buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    let data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15 * (1 - i / bufferSize); // Increased from 0.1 to 0.15
    }

    let noiseSource = audioContext.createBufferSource();
    let noiseGain = audioContext.createGain();
    noiseSource.buffer = buffer;
    noiseGain.gain.setValueAtTime(0.2, now); // Increased from 0.1 to 0.2
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    noiseSource.connect(noiseGain);
    noiseGain.connect(audioContext.destination);
    noiseSource.start(now);
    noiseSource.stop(now + duration);
  } catch (e) {
    console.log("Error playing sound:", e);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  sphereRadius = min(windowWidth, windowHeight) * 0.3;
}
