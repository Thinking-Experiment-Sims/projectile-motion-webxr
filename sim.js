import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { XRControllerModelFactory } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/webxr/XRControllerModelFactory.js';

/**
 * Spatial Projectiles Lab (WebXR VR/AR)
 * The Thinking Experiment - PhysicsKit
 * Brand Palette: Teal (#0f7e9b), Amber (#d67b19), White (#ffffff), Text (#123140)
 */

// --- Global Simulation State ---
export const state = {
  v0: 18.0,            // Initial speed (m/s)
  angleDeg: 45.0,      // Launch angle (degrees)
  y0: 1.2,             // Initial launch height (m)
  g: 9.8,              // Gravitational acceleration (m/s^2)
  obstacleX: 18.0,     // Obstacle wall distance (m)
  obstacleH: 6.0,      // Obstacle wall height (m)
  hasObstacle: true,   // Obstacle enabled

  // Playback state
  simTime: 0,
  maxTime: 0,
  isRunning: false,
  isPaused: false,
  timeScale: 1.0,      // 1.0 = real-time, 0.25 = slow-mo
  scrubbing: false,

  // Display toggles
  showSohCahToa: true,
  showVectors: true,
  showStrobes: true,
  showObstacle: true,
  camMode: 'orbit',    // 'orbit', 'side', 'follow', 'cannon', 'apex'

  // WebXR state
  isXR: false,
  xrMode: null,        // 'vr' or 'ar'
  scaleMode: 'table',  // 'table' (1:5 scale) or 'room' (1:1 full scale)
};

// Derived kinematic calculations cache
export const kinematics = {
  v0x: 0,
  v0y: 0,
  tUp: 0,
  hMax: 0,
  xApex: 0,
  tDown: 0,
  tTotal: 0,
  range: 0,
  tWall: 0,
  yWall: 0,
  wallClearance: 0,
  clearsWall: false,
};

// --- Three.js Globals ---
let scene, camera, renderer, controls;
let container;
let simGroup; // Root group for all simulation elements (allows easy tabletop/room scaling in XR)

// 3D Objects
let launcherGroup, barrelMesh, basePlatform;
let trajectoryLine, strobeGroup;
let sohCahToaGroup, v0Arrow, vxArrow, vyArrow, sohSprite;
let apexMarker, apexBillboard;
let obstacleGroup, obstacleWallMesh, clearanceMarker;
let targetGroup, targetRingMesh;
let projectileMesh, projVxArrow, projVyArrow, projVArrow, projAccArrow;
let gridHelper, groundPlane;
let vrSpatialPanel, vrLaserRay1, vrLaserRay2;

// Controllers
let controller1, controller2;
let controllerGrip1, controllerGrip2;
const raycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();
let intersectedObj = null;

// Clock & Animation
const clock = new THREE.Clock();

// --- Initialization ---
export function initSimulation() {
  container = document.getElementById('canvas-container');
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf6fafc);

  // Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
  camera.position.set(16, 12, 28);

  // Renderer
  const canvas = document.getElementById('three-canvas');
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // WebXR support
  renderer.xr.enabled = true;

  // Orbit Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below ground
  controls.target.set(15, 4, 0);
  controls.minDistance = 2;
  controls.maxDistance = 100;

  // Lighting
  setupLighting();

  // Root simulation group
  simGroup = new THREE.Group();
  scene.add(simGroup);

  // Build Scene Models
  createEnvironment();
  createLauncher();
  createSohCahToaTriangle();
  createTrajectoryVisuals();
  createApexMarker();
  createObstacle();
  createTarget();
  createProjectile();
  setupWebXR();

  // Calculate initial kinematics
  updateKinematics();

  // Event Listeners
  window.addEventListener('resize', onWindowResize);

  // Start Animation Loop (Essential for WebXR)
  renderer.setAnimationLoop(renderLoop);
}

// --- Lighting ---
function setupLighting() {
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xd0e2ea, 0.85);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(20, 35, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 100;
  dirLight.shadow.camera.left = -25;
  dirLight.shadow.camera.right = 45;
  dirLight.shadow.camera.top = 25;
  dirLight.shadow.camera.bottom = -10;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);
}

// --- Environment & Ground ---
function createEnvironment() {
  // Shadow-receiving ground plane
  const groundGeo = new THREE.PlaneGeometry(100, 40);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0.1
  });
  groundPlane = new THREE.Mesh(groundGeo, groundMat);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.set(25, 0, 0);
  groundPlane.receiveShadow = true;
  simGroup.add(groundPlane);

  // Coordinate grid with Teal accents
  gridHelper = new THREE.GridHelper(80, 80, 0x0f7e9b, 0xc8dbe3);
  gridHelper.position.set(25, 0.005, 0);
  simGroup.add(gridHelper);

  // Distance ruler ticks every 5m along X-axis
  createGroundDistanceRuler();
}

function createGroundDistanceRuler() {
  const rulerGroup = new THREE.Group();
  for (let x = 0; x <= 60; x += 5) {
    const isMajor = x % 10 === 0;
    const tickGeo = new THREE.BoxGeometry(0.1, 0.02, isMajor ? 1.2 : 0.6);
    const tickMat = new THREE.MeshBasicMaterial({ color: isMajor ? 0x0f7e9b : 0x7c9dab });
    const tick = new THREE.Mesh(tickGeo, tickMat);
    tick.position.set(x, 0.01, 0);
    rulerGroup.add(tick);

    if (isMajor) {
      const label = createTextSprite(`${x}m`, { fontsize: 24, textColor: '#095367' });
      label.position.set(x, 0.3, 1.2);
      label.scale.set(1.5, 0.75, 1);
      rulerGroup.add(label);
    }
  }
  simGroup.add(rulerGroup);
}

// --- Launcher ---
function createLauncher() {
  launcherGroup = new THREE.Group();

  // Base Pedestal (Elevates when y0 > 0)
  const baseGeo = new THREE.CylinderGeometry(0.5, 0.7, 1, 32);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x334e5a, roughness: 0.4 });
  basePlatform = new THREE.Mesh(baseGeo, baseMat);
  basePlatform.castShadow = true;
  basePlatform.receiveShadow = true;
  launcherGroup.add(basePlatform);

  // Cannon pivot & barrel
  const pivotGeo = new THREE.SphereGeometry(0.35, 24, 24);
  const pivotMat = new THREE.MeshStandardMaterial({ color: 0x0f7e9b, roughness: 0.3 });
  const pivot = new THREE.Mesh(pivotGeo, pivotMat);
  launcherGroup.add(pivot);

  const barrelGeo = new THREE.CylinderGeometry(0.2, 0.24, 1.4, 24);
  barrelGeo.translate(0, 0.7, 0); // Pivot at bottom
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x123140, metalness: 0.7, roughness: 0.3 });
  barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
  barrelMesh.castShadow = true;
  launcherGroup.add(barrelMesh);

  // Angle Protractor Arc
  const arcCurve = new THREE.EllipseCurve(0, 0, 1.2, 1.2, 0, Math.PI / 2, false, 0);
  const arcPoints = arcCurve.getPoints(32);
  const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
  const arcMat = new THREE.LineBasicMaterial({ color: 0xd67b19, linewidth: 2 });
  const arcLine = new THREE.Line(arcGeo, arcMat);
  arcLine.position.set(0, 0, 0.01);
  launcherGroup.add(arcLine);

  simGroup.add(launcherGroup);
}

// --- SOH CAH TOA Right Triangle ---
function createSohCahToaTriangle() {
  sohCahToaGroup = new THREE.Group();

  // Hypotenuse v0 Arrow (Charcoal #123140)
  v0Arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 1, 0).normalize(), new THREE.Vector3(0, 0, 0), 4, 0x123140, 0.6, 0.35);
  sohCahToaGroup.add(v0Arrow);

  // Horizontal Component v0x Arrow (Teal #0f7e9b)
  vxArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 3, 0x0f7e9b, 0.5, 0.3);
  sohCahToaGroup.add(vxArrow);

  // Vertical Component v0y Arrow (Amber #d67b19)
  vyArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(3, 0, 0), 2.5, 0xd67b19, 0.5, 0.3);
  sohCahToaGroup.add(vyArrow);

  // Dashed connector completing right-triangle
  const dashMat = new THREE.LineDashedMaterial({ color: 0x90a4ae, dashSize: 0.2, gapSize: 0.15 });
  const dashGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(1, 1, 0)
  ]);
  const dashLine = new THREE.Line(dashGeo, dashMat);
  dashLine.computeLineDistances();
  dashLine.name = 'dashConnector';
  sohCahToaGroup.add(dashLine);

  // Floating label sprite for SOHCAHTOA formula
  sohSprite = createTextSprite('v0x = v0 cos θ\nv0y = v0 sin θ', { fontsize: 22, textColor: '#0f7e9b', bg: 'rgba(255,255,255,0.95)' });
  sohSprite.position.set(2, 2.8, 0);
  sohSprite.scale.set(4, 2, 1);
  sohCahToaGroup.add(sohSprite);

  simGroup.add(sohCahToaGroup);
}

// --- Trajectory & Strobes ---
function createTrajectoryVisuals() {
  // Parabolic path line
  const maxPoints = 300;
  const trajGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(maxPoints * 3);
  trajGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const trajMat = new THREE.LineBasicMaterial({ color: 0x0f7e9b, linewidth: 3 });
  trajectoryLine = new THREE.Line(trajGeo, trajMat);
  simGroup.add(trajectoryLine);

  // Strobe spheres group
  strobeGroup = new THREE.Group();
  simGroup.add(strobeGroup);
}

// --- Apex Marker ---
function createApexMarker() {
  const apexGeo = new THREE.OctahedronGeometry(0.3, 0);
  const apexMat = new THREE.MeshStandardMaterial({
    color: 0xd67b19,
    emissive: 0xd67b19,
    emissiveIntensity: 0.4,
    roughness: 0.2
  });
  apexMarker = new THREE.Mesh(apexGeo, apexMat);

  // Drop line from apex to ground
  const apexLineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -10, 0)
  ]);
  const apexLineMat = new THREE.LineDashedMaterial({ color: 0xd67b19, dashSize: 0.3, gapSize: 0.2 });
  const apexDropLine = new THREE.Line(apexLineGeo, apexLineMat);
  apexDropLine.computeLineDistances();
  apexDropLine.name = 'apexDropLine';
  apexMarker.add(apexDropLine);

  // Floating Apex Billboard
  apexBillboard = createTextSprite('APEX: vy = 0 m/s', { fontsize: 20, textColor: '#d67b19', bg: 'rgba(255,255,255,0.92)' });
  apexBillboard.position.set(0, 1.0, 0);
  apexBillboard.scale.set(3.6, 1.4, 1);
  apexMarker.add(apexBillboard);

  simGroup.add(apexMarker);
}

// --- Obstacle Wall ---
function createObstacle() {
  obstacleGroup = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x334e5a,
    roughness: 0.5,
    metalness: 0.2,
    transparent: true,
    opacity: 0.88
  });
  const wallGeo = new THREE.BoxGeometry(0.3, 1, 4);
  obstacleWallMesh = new THREE.Mesh(wallGeo, wallMat);
  obstacleWallMesh.castShadow = true;
  obstacleWallMesh.receiveShadow = true;
  obstacleGroup.add(obstacleWallMesh);

  // Top ledge indicator (Amber)
  const topLedgeGeo = new THREE.BoxGeometry(0.4, 0.1, 4.1);
  const topLedgeMat = new THREE.MeshStandardMaterial({ color: 0xd67b19, roughness: 0.3 });
  const topLedge = new THREE.Mesh(topLedgeGeo, topLedgeMat);
  topLedge.name = 'topLedge';
  obstacleGroup.add(topLedge);

  // Clearance Indicator Tag
  clearanceMarker = createTextSprite('Clears +0.0m', { fontsize: 20, textColor: '#1b8a5a', bg: 'rgba(255,255,255,0.95)' });
  clearanceMarker.scale.set(3.2, 1.3, 1);
  obstacleGroup.add(clearanceMarker);

  simGroup.add(obstacleGroup);
}

// --- Target Ground Bullseye ---
function createTarget() {
  targetGroup = new THREE.Group();

  const outerRingGeo = new THREE.RingGeometry(0.8, 1.2, 32);
  const outerMat = new THREE.MeshBasicMaterial({ color: 0x0f7e9b, side: THREE.DoubleSide });
  targetRingMesh = new THREE.Mesh(outerRingGeo, outerMat);
  targetRingMesh.rotation.x = -Math.PI / 2;
  targetRingMesh.position.y = 0.02;
  targetGroup.add(targetRingMesh);

  const innerRingGeo = new THREE.RingGeometry(0.2, 0.5, 32);
  const innerMat = new THREE.MeshBasicMaterial({ color: 0xd67b19, side: THREE.DoubleSide });
  const innerRing = new THREE.Mesh(innerRingGeo, innerMat);
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.025;
  targetGroup.add(innerRing);

  simGroup.add(targetGroup);
}

// --- Projectile & Attached Vectors ---
function createProjectile() {
  const projGeo = new THREE.SphereGeometry(0.28, 32, 32);
  const projMat = new THREE.MeshStandardMaterial({
    color: 0x123140,
    metalness: 0.8,
    roughness: 0.2
  });
  projectileMesh = new THREE.Mesh(projGeo, projMat);
  projectileMesh.castShadow = true;

  // Attached Velocity Vectors
  projVxArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 2, 0x0f7e9b, 0.4, 0.25);
  projectileMesh.add(projVxArrow);

  projVyArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 2, 0xd67b19, 0.4, 0.25);
  projectileMesh.add(projVyArrow);

  projVArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 2.5, 0x123140, 0.4, 0.25);
  projectileMesh.add(projVArrow);

  projAccArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 0), 1.6, 0x90a4ae, 0.35, 0.2);
  projectileMesh.add(projAccArrow);

  simGroup.add(projectileMesh);
}

// --- Kinematics Math Engine ---
export function updateKinematics() {
  const rad = (state.angleDeg * Math.PI) / 180;
  kinematics.v0x = state.v0 * Math.cos(rad);
  kinematics.v0y = state.v0 * Math.sin(rad);

  // Time to apex: vy = 0 => tUp = v0y / g
  kinematics.tUp = kinematics.v0y / state.g;

  // Max height above ground: Hmax = y0 + v0y^2 / (2g)
  kinematics.hMax = state.y0 + (kinematics.v0y * kinematics.v0y) / (2 * state.g);
  kinematics.xApex = kinematics.v0x * kinematics.tUp;

  // Time falling from apex to ground (y = 0):
  // 0 = Hmax - 0.5 * g * tDown^2 => tDown = sqrt(2 * Hmax / g)
  kinematics.tDown = Math.sqrt((2 * kinematics.hMax) / state.g);
  kinematics.tTotal = kinematics.tUp + kinematics.tDown;

  // Total horizontal range: R = v0x * tTotal
  kinematics.range = kinematics.v0x * kinematics.tTotal;

  // Obstacle analysis:
  if (state.hasObstacle && state.obstacleX > 0) {
    kinematics.tWall = state.obstacleX / kinematics.v0x;
    if (kinematics.tWall <= kinematics.tTotal) {
      kinematics.yWall = state.y0 + kinematics.v0y * kinematics.tWall - 0.5 * state.g * kinematics.tWall * kinematics.tWall;
      kinematics.wallClearance = kinematics.yWall - state.obstacleH;
      kinematics.clearsWall = kinematics.wallClearance > 0;
    } else {
      kinematics.tWall = 0;
      kinematics.yWall = 0;
      kinematics.wallClearance = 0;
      kinematics.clearsWall = false;
    }
  }

  // Update max time for playback scrubber
  state.maxTime = kinematics.tTotal;

  // Update 3D Visuals
  sync3DVisuals();
}

// --- Sync 3D Scene to Parameters ---
function sync3DVisuals() {
  const rad = (state.angleDeg * Math.PI) / 180;

  // 1. Launcher Position & Rotation
  launcherGroup.position.set(0, 0, 0);
  basePlatform.scale.set(1, Math.max(state.y0, 0.05), 1);
  basePlatform.position.y = state.y0 / 2;
  barrelMesh.position.set(0, state.y0, 0);
  barrelMesh.rotation.z = -(Math.PI / 2 - rad); // Three.js rotation

  // 2. SOH CAH TOA Right Triangle at Muzzle
  sohCahToaGroup.position.set(0, state.y0, 0);
  const arrowScale = 0.22; // Visual scale for meters/sec to 3D world units
  const lenV0 = Math.max(state.v0 * arrowScale, 0.5);
  const lenVx = Math.max(kinematics.v0x * arrowScale, 0.5);
  const lenVy = Math.max(kinematics.v0y * arrowScale, 0.2);

  v0Arrow.setDirection(new THREE.Vector3(Math.cos(rad), Math.sin(rad), 0));
  v0Arrow.setLength(lenV0, 0.5, 0.28);

  vxArrow.setLength(lenVx, 0.45, 0.25);

  vyArrow.position.set(lenVx, 0, 0);
  vyArrow.setLength(lenVy, 0.45, 0.25);

  // Update dashed hypotenuse connector
  const dashLine = sohCahToaGroup.getObjectByName('dashConnector');
  if (dashLine) {
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(lenVx, 0, 0),
      new THREE.Vector3(lenVx, lenVy, 0)
    ];
    dashLine.geometry.setFromPoints(pts);
    dashLine.computeLineDistances();
  }

  sohCahToaGroup.visible = state.showSohCahToa;

  // 3. Trajectory Curve
  const positions = trajectoryLine.geometry.attributes.position.array;
  const numPts = 200;
  let idx = 0;
  for (let i = 0; i <= numPts; i++) {
    const t = (i / numPts) * kinematics.tTotal;
    const px = kinematics.v0x * t;
    const py = Math.max(state.y0 + kinematics.v0y * t - 0.5 * state.g * t * t, 0);
    positions[idx++] = px;
    positions[idx++] = py;
    positions[idx++] = 0;
  }
  trajectoryLine.geometry.setDrawRange(0, numPts + 1);
  trajectoryLine.geometry.attributes.position.needsUpdate = true;

  // 4. Strobe Markers (Equally spaced in time Δt = 0.25s)
  while (strobeGroup.children.length > 0) {
    const obj = strobeGroup.children.pop();
    obj.geometry?.dispose();
    obj.material?.dispose();
  }

  if (state.showStrobes) {
    const dtStrobe = Math.max(kinematics.tTotal / 12, 0.15);
    const strobeGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const strobeMat = new THREE.MeshBasicMaterial({ color: 0x0f7e9b, transparent: true, opacity: 0.65 });

    for (let t = dtStrobe; t < kinematics.tTotal; t += dtStrobe) {
      const sx = kinematics.v0x * t;
      const sy = state.y0 + kinematics.v0y * t - 0.5 * state.g * t * t;
      if (sy > 0.05) {
        const sMesh = new THREE.Mesh(strobeGeo, strobeMat);
        sMesh.position.set(sx, sy, 0);

        // Vertical drop line to floor (shows constant horizontal Δx vs varying vertical Δy)
        const dropGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(sx, sy, 0),
          new THREE.Vector3(sx, 0, 0)
        ]);
        const dropMat = new THREE.LineDashedMaterial({ color: 0xc8dbe3, dashSize: 0.15, gapSize: 0.1 });
        const dropLine = new THREE.Line(dropGeo, dropMat);
        dropLine.computeLineDistances();
        strobeGroup.add(dropLine);

        strobeGroup.add(sMesh);
      }
    }
  }

  // 5. Apex Marker
  apexMarker.position.set(kinematics.xApex, kinematics.hMax, 0);
  const apexDrop = apexMarker.getObjectByName('apexDropLine');
  if (apexDrop) {
    apexDrop.geometry.setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -kinematics.hMax, 0)
    ]);
    apexDrop.computeLineDistances();
  }

  // 6. Obstacle Wall
  obstacleGroup.visible = state.hasObstacle;
  if (state.hasObstacle) {
    obstacleWallMesh.scale.set(1, state.obstacleH, 1);
    obstacleWallMesh.position.set(state.obstacleX, state.obstacleH / 2, 0);

    const topLedge = obstacleGroup.getObjectByName('topLedge');
    if (topLedge) {
      topLedge.position.set(state.obstacleX, state.obstacleH, 0);
    }

    // Clearance Label
    clearanceMarker.position.set(state.obstacleX, Math.max(state.obstacleH + 0.9, kinematics.yWall + 0.4), 0);
    if (kinematics.tWall > 0 && kinematics.tWall <= kinematics.tTotal) {
      const sign = kinematics.wallClearance >= 0 ? '+' : '';
      const clrText = kinematics.clearsWall
        ? `CLEARS: ${sign}${kinematics.wallClearance.toFixed(2)}m`
        : `HIT WALL: ${kinematics.wallClearance.toFixed(2)}m`;
      updateTextSprite(clearanceMarker, clrText, {
        textColor: kinematics.clearsWall ? '#1b8a5a' : '#c0392b',
        bg: kinematics.clearsWall ? 'rgba(234,250,241,0.95)' : 'rgba(253,242,242,0.95)'
      });
    } else {
      updateTextSprite(clearanceMarker, 'Out of Range', { textColor: '#526f7d' });
    }
  }

  // 7. Landing Target
  targetGroup.position.set(kinematics.range, 0, 0);

  // Position Projectile at current simTime
  setProjectileToTime(state.simTime);
}

// --- Position Projectile at Arbitrary Time ---
export function setProjectileToTime(t) {
  const clampedT = Math.min(Math.max(t, 0), kinematics.tTotal);
  state.simTime = clampedT;

  const px = kinematics.v0x * clampedT;
  const currentVy = kinematics.v0y - state.g * clampedT;
  const py = Math.max(state.y0 + kinematics.v0y * clampedT - 0.5 * state.g * clampedT * clampedT, 0);

  projectileMesh.position.set(px, py, 0);

  // Update attached instantaneous vectors
  if (state.showVectors) {
    projVxArrow.visible = true;
    projVyArrow.visible = true;
    projVArrow.visible = true;
    projAccArrow.visible = true;

    const vScale = 0.18;
    const lenVx = Math.max(kinematics.v0x * vScale, 0.4);
    projVxArrow.setLength(lenVx, 0.35, 0.2);

    const lenVy = Math.abs(currentVy) * vScale;
    if (lenVy > 0.05) {
      projVyArrow.visible = true;
      projVyArrow.setDirection(new THREE.Vector3(0, currentVy >= 0 ? 1 : -1, 0));
      projVyArrow.setLength(lenVy, 0.35, 0.2);
    } else {
      projVyArrow.visible = false;
    }

    const currentV = Math.hypot(kinematics.v0x, currentVy);
    const lenV = currentV * vScale;
    projVArrow.setDirection(new THREE.Vector3(kinematics.v0x, currentVy, 0).normalize());
    projVArrow.setLength(lenV, 0.4, 0.22);
  } else {
    projVxArrow.visible = false;
    projVyArrow.visible = false;
    projVArrow.visible = false;
    projAccArrow.visible = false;
  }
}

// --- Simulation Controls ---
export function fireSimulation() {
  state.simTime = 0;
  state.isRunning = true;
  state.isPaused = false;
}

export function pauseSimulation() {
  state.isPaused = !state.isPaused;
}

export function resetSimulation() {
  state.simTime = 0;
  state.isRunning = false;
  state.isPaused = false;
  setProjectileToTime(0);
}

// --- Animation Loop ---
function renderLoop(timestamp, frame) {
  const delta = clock.getDelta();

  if (state.isRunning && !state.isPaused && !state.scrubbing) {
    state.simTime += delta * state.timeScale;

    // Check obstacle collision:
    if (state.hasObstacle && !kinematics.clearsWall && kinematics.tWall > 0) {
      if (state.simTime >= kinematics.tWall) {
        state.simTime = kinematics.tWall;
        state.isRunning = false; // Collided with wall
      }
    }

    // Check ground landing:
    if (state.simTime >= kinematics.tTotal) {
      state.simTime = kinematics.tTotal;
      state.isRunning = false;
    }

    setProjectileToTime(state.simTime);
    updateDOMScrubber();
  }

  // Handle XR Controller Interactions
  if (renderer.xr.isPresenting) {
    handleXRControllers();
  } else {
    // Desktop Camera Modes
    updateDesktopCamera();
    controls.update();
  }

  renderer.render(scene, camera);
}

function updateDesktopCamera() {
  if (state.camMode === 'follow' && state.isRunning) {
    controls.target.set(projectileMesh.position.x, projectileMesh.position.y, 0);
  } else if (state.camMode === 'side') {
    camera.position.set(kinematics.range / 2, kinematics.hMax / 2 + 1, 35);
    controls.target.set(kinematics.range / 2, kinematics.hMax / 2 + 1, 0);
  } else if (state.camMode === 'cannon') {
    camera.position.set(3.5, state.y0 + 2, 4.5);
    controls.target.set(1.5, state.y0 + 1, 0);
  } else if (state.camMode === 'apex') {
    camera.position.set(kinematics.xApex + 3, kinematics.hMax + 2, 5);
    controls.target.set(kinematics.xApex, kinematics.hMax, 0);
  }
}

// --- WebXR Implementation ---
function setupWebXR() {
  const vrBtn = document.getElementById('btn-enter-vr');
  const arBtn = document.getElementById('btn-enter-ar');

  if ('xr' in navigator) {
    // Check VR
    navigator.xr.isSessionSupported('immersive-vr').then(supported => {
      if (supported && vrBtn) {
        vrBtn.disabled = false;
        vrBtn.addEventListener('click', () => startXRSession('immersive-vr'));
      }
    });

    // Check AR (Meta Quest Passthrough)
    navigator.xr.isSessionSupported('immersive-ar').then(supported => {
      if (supported && arBtn) {
        arBtn.disabled = false;
        arBtn.addEventListener('click', () => startXRSession('immersive-ar'));
      }
    });
  }

  // Controller Setup
  const controllerModelFactory = new XRControllerModelFactory();

  controller1 = renderer.xr.getController(0);
  controller1.addEventListener('selectstart', onXRSelectStart);
  controller1.addEventListener('selectend', onXRSelectEnd);
  scene.add(controller1);

  controller2 = renderer.xr.getController(1);
  controller2.addEventListener('selectstart', onXRSelectStart);
  controller2.addEventListener('selectend', onXRSelectEnd);
  scene.add(controller2);

  controllerGrip1 = renderer.xr.getControllerGrip(0);
  controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
  scene.add(controllerGrip1);

  controllerGrip2 = renderer.xr.getControllerGrip(1);
  controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
  scene.add(controllerGrip2);

  // Laser beam pointers
  vrLaserRay1 = createLaserRay();
  controller1.add(vrLaserRay1);
  vrLaserRay2 = createLaserRay();
  controller2.add(vrLaserRay2);

  // Floating 3D VR Spatial Control HUD
  createVRSpatialHUD();
}

function createLaserRay() {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -5)
  ]);
  const mat = new THREE.LineBasicMaterial({ color: 0xd67b19 });
  return new THREE.Line(geo, mat);
}

function createVRSpatialHUD() {
  vrSpatialPanel = new THREE.Group();
  vrSpatialPanel.position.set(-1.8, 1.4, -0.5);
  vrSpatialPanel.rotation.y = Math.PI / 4;

  const panelBackGeo = new THREE.PlaneGeometry(1.6, 1.2);
  const panelBackMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.95
  });
  const backMesh = new THREE.Mesh(panelBackGeo, panelBackMat);
  vrSpatialPanel.add(backMesh);

  // In-VR HUD Interactive Buttons
  const btnFire = createVRButtonMesh('▶ FIRE', 0xd67b19, 0, 0.35);
  btnFire.userData = { action: 'fire' };
  vrSpatialPanel.add(btnFire);

  const btnReset = createVRButtonMesh('↺ RESET', 0x0f7e9b, 0, 0.1);
  btnReset.userData = { action: 'reset' };
  vrSpatialPanel.add(btnReset);

  const btnSlowMo = createVRButtonMesh('⏳ SLOW-MO', 0x334e5a, 0, -0.15);
  btnSlowMo.userData = { action: 'slowmo' };
  vrSpatialPanel.add(btnSlowMo);

  const btnScale = createVRButtonMesh('📏 SCALE: TABLE/ROOM', 0x526f7d, 0, -0.4);
  btnScale.userData = { action: 'toggleScale' };
  vrSpatialPanel.add(btnScale);

  simGroup.add(vrSpatialPanel);
}

function createVRButtonMesh(text, hexColor, x, y) {
  const group = new THREE.Group();
  group.position.set(x, y, 0.02);

  const bgGeo = new THREE.PlaneGeometry(1.3, 0.2);
  const bgMat = new THREE.MeshBasicMaterial({ color: hexColor });
  const bg = new THREE.Mesh(bgGeo, bgMat);
  group.add(bg);

  const sprite = createTextSprite(text, { fontsize: 22, textColor: '#ffffff' });
  sprite.scale.set(1.2, 0.2, 1);
  sprite.position.z = 0.01;
  group.add(sprite);

  // Hitbox for raycasting
  group.userData.isInteractable = true;
  return group;
}

function startXRSession(sessionMode) {
  state.xrMode = sessionMode === 'immersive-ar' ? 'ar' : 'vr';

  const sessionInit = {
    optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
  };

  navigator.xr.requestSession(sessionMode, sessionInit).then(session => {
    renderer.xr.setSession(session);
    state.isXR = true;

    if (sessionMode === 'immersive-ar') {
      // Mixed Reality Passthrough: Make scene background transparent
      scene.background = null;
      groundPlane.material.transparent = true;
      groundPlane.material.opacity = 0.2;
    } else {
      scene.background = new THREE.Color(0xf6fafc);
      groundPlane.material.transparent = false;
      groundPlane.material.opacity = 1.0;
    }

    // Default to Tabletop mode in AR for comfort
    applyXRScale(state.scaleMode);

    session.addEventListener('end', () => {
      state.isXR = false;
      state.xrMode = null;
      scene.background = new THREE.Color(0xf6fafc);
      groundPlane.material.transparent = false;
      groundPlane.material.opacity = 1.0;
      simGroup.scale.set(1, 1, 1);
      simGroup.position.set(0, 0, 0);
    });
  });
}

function applyXRScale(mode) {
  state.scaleMode = mode;
  if (mode === 'table') {
    // 1:5 scale: fits neatly on a classroom desk in front of user
    simGroup.scale.set(0.12, 0.12, 0.12);
    simGroup.position.set(0, 0.8, -1.5);
  } else {
    // 1:1 Room-Scale: full size on floor
    simGroup.scale.set(1, 1, 1);
    simGroup.position.set(0, 0, 0);
  }
}

// Controller Raycast Handling
function handleXRControllers() {
  [controller1, controller2].forEach(controller => {
    if (!controller) return;
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const intersects = raycaster.intersectObjects(vrSpatialPanel.children, true);
    if (intersects.length > 0) {
      let hit = intersects[0].object;
      while (hit && !hit.userData.action && hit !== vrSpatialPanel) {
        hit = hit.parent;
      }
      if (hit && hit.userData.action) {
        intersectedObj = hit;
      }
    }
  });
}

function onXRSelectStart(event) {
  const controller = event.target;
  triggerHaptic(controller, 0.6, 50);

  if (intersectedObj && intersectedObj.userData.action) {
    const act = intersectedObj.userData.action;
    if (act === 'fire') fireSimulation();
    if (act === 'reset') resetSimulation();
    if (act === 'slowmo') {
      state.timeScale = state.timeScale === 1.0 ? 0.25 : 1.0;
    }
    if (act === 'toggleScale') {
      applyXRScale(state.scaleMode === 'table' ? 'room' : 'table');
    }
    return;
  }

  // If no UI hit, pulling trigger fires projectile
  fireSimulation();
}

function onXRSelectEnd(event) {
  intersectedObj = null;
}

function triggerHaptic(controller, intensity = 0.5, duration = 40) {
  const session = renderer.xr.getSession();
  if (!session) return;
  for (const source of session.inputSources) {
    if (source.gamepad && source.gamepad.hapticActuators && source.gamepad.hapticActuators.length > 0) {
      source.gamepad.hapticActuators[0].pulse(intensity, duration);
    }
  }
}

// --- Text Sprite Utility for 3D Math Billboards ---
function createTextSprite(text, options = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 256;

  renderSpriteText(ctx, canvas, text, options);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.userData = { canvas, ctx, texture, options };
  return sprite;
}

function updateTextSprite(sprite, newText, newOptions = {}) {
  if (!sprite || !sprite.userData || !sprite.userData.canvas) return;
  const { canvas, ctx, texture, options } = sprite.userData;
  const mergedOptions = { ...options, ...newOptions };
  renderSpriteText(ctx, canvas, newText, mergedOptions);
  texture.needsUpdate = true;
}

function renderSpriteText(ctx, canvas, text, options) {
  const {
    fontsize = 28,
    textColor = '#123140',
    bg = null
  } = options;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (bg) {
    ctx.fillStyle = bg;
    ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 16);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#c8dbe3';
    ctx.stroke();
  }

  ctx.font = `bold ${fontsize}px 'Inter', sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = text.split('\n');
  const lineHeight = fontsize * 1.35;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, startY + i * lineHeight);
  });
}

function updateDOMScrubber() {
  const scrubber = document.getElementById('time-scrubber');
  const timeDisplay = document.getElementById('hud-time');
  if (scrubber && !state.scrubbing) {
    scrubber.max = kinematics.tTotal.toFixed(2);
    scrubber.value = state.simTime.toFixed(2);
  }
  if (timeDisplay) {
    timeDisplay.textContent = `${state.simTime.toFixed(2)}s / ${kinematics.tTotal.toFixed(2)}s`;
  }
}

function onWindowResize() {
  if (!container || !camera || !renderer) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
