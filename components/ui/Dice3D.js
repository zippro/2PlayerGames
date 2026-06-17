'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

// ─── Face value → rotation to show that value on TOP ───
const FACE_ROTATIONS = {
  1: { x: -Math.PI / 2, z: 0 },
  2: { x: 0, z: Math.PI / 2 },
  3: { x: 0, z: 0 },
  4: { x: Math.PI, z: 0 },
  5: { x: 0, z: -Math.PI / 2 },
  6: { x: Math.PI / 2, z: 0 },
};

// ─── Create dot pattern texture for a face value ───
function createFaceTexture(value) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Die face background — ivory white with subtle gradient
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.7);
  grad.addColorStop(0, '#FAF6F0');
  grad.addColorStop(1, '#EDE5D8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle border/edge using manual rounded rect (for browser compat)
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 4;
  const r = 24;
  const m = 2;
  const w = size - 4;
  ctx.beginPath();
  ctx.moveTo(m + r, m);
  ctx.lineTo(m + w - r, m);
  ctx.quadraticCurveTo(m + w, m, m + w, m + r);
  ctx.lineTo(m + w, m + w - r);
  ctx.quadraticCurveTo(m + w, m + w, m + w - r, m + w);
  ctx.lineTo(m + r, m + w);
  ctx.quadraticCurveTo(m, m + w, m, m + w - r);
  ctx.lineTo(m, m + r);
  ctx.quadraticCurveTo(m, m, m + r, m);
  ctx.closePath();
  ctx.stroke();

  // Dot positions (normalized 0-1)
  const positions = {
    1: [[0.5, 0.5]],
    2: [[0.28, 0.28], [0.72, 0.72]],
    3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
    4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
    5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
    6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]],
  };

  const dots = positions[value] || [];
  const dotRadius = size * 0.085;

  for (const [x, y] of dots) {
    const px = x * size;
    const py = y * size;

    // Dot shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.arc(px + 1.5, py + 1.5, dotRadius + 1, 0, Math.PI * 2);
    ctx.fill();

    // Dot body
    const dotGrad = ctx.createRadialGradient(px - 2, py - 2, 0, px, py, dotRadius);
    dotGrad.addColorStop(0, '#2A2A2A');
    dotGrad.addColorStop(1, '#111111');
    ctx.fillStyle = dotGrad;
    ctx.beginPath();
    ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    // Dot highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(px - dotRadius * 0.25, py - dotRadius * 0.25, dotRadius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ─── Easing functions ───
function easeOutBounce(t) {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}

function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

// ─── Main Component ───
export default function Dice3D({ values = [1, 1], rolling = false, onRollComplete, size = 280 }) {
  const containerRef = useRef(null);
  const diceRef = useRef([]);
  const animRef = useRef(null);
  const onCompleteRef = useRef(onRollComplete); // ref to avoid stale closure
  const rollStateRef = useRef({
    rolling: false,
    startTime: 0,
    duration: 1200,
    spinSpeeds: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }],
    targetRotations: [{ x: 0, z: 0 }, { x: 0, z: 0 }],
    startPositions: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    bounceOffsets: [0, 0],
    completeFired: false,
  });

  // Keep callback ref updated
  useEffect(() => {
    onCompleteRef.current = onRollComplete;
  }, [onRollComplete]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const w = size;
    const h = size * 0.5;

    // Scene
    const scene = new THREE.Scene();
    scene.background = null;

    // Camera — closer, more dramatic angle
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 5, 4.5);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    containerRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xfff5e8, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.4);
    dirLight.position.set(3, 8, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 512;
    dirLight.shadow.mapSize.height = 512;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 20;
    dirLight.shadow.camera.left = -3;
    dirLight.shadow.camera.right = 3;
    dirLight.shadow.camera.top = 3;
    dirLight.shadow.camera.bottom = -3;
    dirLight.shadow.radius = 4;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xccddff, 0.35);
    fillLight.position.set(-2, 4, -2);
    scene.add(fillLight);

    // Ground plane (shadow receiver)
    const groundGeo = new THREE.PlaneGeometry(10, 10);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.52;
    ground.receiveShadow = true;
    scene.add(ground);

    // Create two dice
    const diceObjects = [];
    for (let d = 0; d < 2; d++) {
      // Face order for BoxGeometry: +X, -X, +Y, -Y, +Z, -Z
      // Standard die: +X=2, -X=5, +Y=3, -Y=4, +Z=1, -Z=6
      const faceValues = [2, 5, 3, 4, 1, 6];
      const materials = faceValues.map(v =>
        new THREE.MeshStandardMaterial({
          map: createFaceTexture(v),
          roughness: 0.32,
          metalness: 0.02,
        })
      );

      // Slightly rounded box using RoundedBoxGeometry approximation
      const geometry = new THREE.BoxGeometry(0.9, 0.9, 0.9, 4, 4, 4);

      const die = new THREE.Mesh(geometry, materials);
      die.castShadow = true;
      die.receiveShadow = true;
      die.position.set(d === 0 ? -0.75 : 0.75, 0, 0);
      scene.add(die);
      diceObjects.push(die);
    }
    diceRef.current = diceObjects;

    // Set initial rotations
    const initValues = values;
    for (let d = 0; d < 2; d++) {
      const rot = FACE_ROTATIONS[initValues[d]] || FACE_ROTATIONS[1];
      diceObjects[d].rotation.set(rot.x, 0, rot.z);
    }

    // Render loop
    function animate() {
      animRef.current = requestAnimationFrame(animate);
      const rs = rollStateRef.current;

      if (rs.rolling) {
        const elapsed = Date.now() - rs.startTime;
        const progress = Math.min(elapsed / rs.duration, 1);

        for (let d = 0; d < 2; d++) {
          const die = diceRef.current[d];
          if (!die) continue;

          const target = rs.targetRotations[d];
          const spin = rs.spinSpeeds[d];

          if (progress < 0.6) {
            // Tumbling phase
            const tumbleProgress = progress / 0.6;
            const slowdown = 1 - easeOutQuart(tumbleProgress) * 0.65;
            die.rotation.x += spin.x * slowdown * 0.16;
            die.rotation.y += spin.y * slowdown * 0.16;
            die.rotation.z += spin.z * slowdown * 0.16;

            // Bounce height — multiple bounces with decreasing amplitude
            const bounceCount = 3;
            const bouncePhase = Math.abs(Math.sin(tumbleProgress * Math.PI * bounceCount));
            const amplitude = (1 - tumbleProgress) * 2.2;
            die.position.y = bouncePhase * amplitude;

            // Lateral movement toward final position
            const startX = rs.startPositions[d].x;
            const targetX = d === 0 ? -0.75 : 0.75;
            die.position.x = startX + (targetX - startX) * easeOutQuart(tumbleProgress);
          } else {
            // Settling phase
            const settleProgress = (progress - 0.6) / 0.4;
            const eased = easeOutBounce(settleProgress);

            const fullSpinsX = Math.round(die.rotation.x / (Math.PI * 2)) * Math.PI * 2;
            const fullSpinsZ = Math.round(die.rotation.z / (Math.PI * 2)) * Math.PI * 2;
            const finalX = fullSpinsX + target.x;
            const finalZ = fullSpinsZ + target.z;

            if (settleProgress < 0.08) {
              rs.bounceOffsets[d] = die.rotation.y;
            }

            die.rotation.x += (finalX - die.rotation.x) * eased * 0.12;
            die.rotation.z += (finalZ - die.rotation.z) * eased * 0.12;
            die.rotation.y = rs.bounceOffsets[d] * (1 - eased);

            // Height settles with small bounce
            const settleHeight = Math.max(0, (1 - eased) * 0.5);
            die.position.y = settleHeight * Math.abs(Math.sin(settleProgress * Math.PI * 1.5));

            // Final position
            die.position.x += ((d === 0 ? -0.75 : 0.75) - die.position.x) * eased * 0.1;
          }
        }

        if (progress >= 1 && !rs.completeFired) {
          rs.completeFired = true;
          rs.rolling = false;
          // Snap to exact rotations
          for (let d = 0; d < 2; d++) {
            const die = diceRef.current[d];
            if (!die) continue;
            const target = rs.targetRotations[d];
            die.rotation.set(target.x, 0, target.z);
            die.position.y = 0;
            die.position.x = d === 0 ? -0.75 : 0.75;
          }
          // Use ref callback to avoid stale closure
          if (onCompleteRef.current) onCompleteRef.current();
        }
      }

      renderer.render(scene, camera);
    }
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animRef.current);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      renderer.dispose();
      diceObjects.forEach(die => {
        die.geometry.dispose();
        die.material.forEach(m => {
          m.map?.dispose();
          m.dispose();
        });
      });
      groundGeo.dispose();
      groundMat.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start roll animation when rolling prop changes
  useEffect(() => {
    if (rolling && values.length === 2) {
      const rs = rollStateRef.current;
      rs.rolling = true;
      rs.completeFired = false;
      rs.startTime = Date.now();
      rs.duration = 1000 + Math.random() * 400;

      for (let d = 0; d < 2; d++) {
        rs.spinSpeeds[d] = {
          x: (3 + Math.random() * 5) * (Math.random() > 0.5 ? 1 : -1),
          y: (2 + Math.random() * 3) * (Math.random() > 0.5 ? 1 : -1),
          z: (2 + Math.random() * 5) * (Math.random() > 0.5 ? 1 : -1),
        };
        rs.targetRotations[d] = FACE_ROTATIONS[values[d]] || FACE_ROTATIONS[1];
        rs.startPositions[d] = {
          x: (Math.random() - 0.5) * 2.5,
          y: 2.5 + Math.random(),
        };

        const die = diceRef.current[d];
        if (die) {
          die.position.x = rs.startPositions[d].x;
          die.position.y = rs.startPositions[d].y;
        }
      }
    } else if (!rolling && values.length === 2 && !rollStateRef.current.rolling) {
      // Show final values statically
      for (let d = 0; d < 2; d++) {
        const die = diceRef.current[d];
        if (!die) continue;
        const rot = FACE_ROTATIONS[values[d]] || FACE_ROTATIONS[1];
        die.rotation.set(rot.x, 0, rot.z);
        die.position.y = 0;
      }
    }
  }, [rolling, values]);

  return (
    <div
      ref={containerRef}
      style={{
        width: size,
        height: size * 0.5,
        position: 'relative',
        pointerEvents: 'none',
      }}
    />
  );
}
