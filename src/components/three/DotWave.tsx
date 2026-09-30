"use client";

import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { SceneProps } from "./LazyScene";

/*
 * A field of dots rolling like a surface, colored across in the light aurora palette
 * (sky → indigo → violet, mint on the crests). All motion runs in the vertex shader — one draw call.
 * The pointer presses a soft ripple into the field.
 */

const COLS = 110;
const ROWS = 46;
const SPACING = 0.18;

const vertex = (halfWidth: number) => /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec2 uPointer;
  uniform float uAmp;
  varying float vDepth;
  varying float vLift;
  varying float vEdge;
  varying float vT;
  void main() {
    vec3 p = position;
    float w = sin(p.x * 0.55 + uTime * 0.55) * 0.55 + cos(p.z * 0.8 + uTime * 0.42) * 0.45 + sin((p.x + p.z) * 0.35 + uTime * 0.3) * 0.35;
    float ripple = exp(-pow(distance(p.xz, uPointer), 2.0) * 1.4) * 0.32;
    p.y += w * uAmp + ripple;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    vLift = w * 0.5 + 0.5 + ripple;
    vT = clamp(position.x / ${halfWidth.toFixed(3)} * 0.5 + 0.5, 0.0, 1.0);
    vEdge = 1.0 - smoothstep(0.62, 1.0, abs(position.x) / ${halfWidth.toFixed(3)});
    gl_PointSize = uSize * uPixelRatio / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform vec3 uCrest;
  uniform float uOpacity;
  uniform float uNear;
  uniform float uFar;
  varying float vDepth;
  varying float vLift;
  varying float vEdge;
  varying float vT;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float disc = smoothstep(0.5, 0.3, d);
    float fog = 1.0 - smoothstep(uNear, uFar, vDepth);
    vec3 base = mix(mix(uColorA, uColorB, smoothstep(0.0, 0.55, vT)), uColorC, smoothstep(0.5, 1.0, vT));
    vec3 color = mix(base, uCrest, smoothstep(0.7, 1.1, vLift) * 0.6);
    float a = uOpacity * disc * fog * vEdge * mix(0.45, 1.0, clamp(vLift, 0.0, 1.0));
    gl_FragColor = vec4(color, a);
  }
`;

function Field({ compact, opacity }: { compact: boolean; opacity: number }) {
  const { gl, pointer, camera } = useThree();
  const cols = compact ? 64 : COLS;
  const rows = compact ? 30 : ROWS;
  const spacing = compact ? SPACING * 1.25 : SPACING;
  const halfWidth = ((cols - 1) * spacing) / 2;

  const geometry = React.useMemo(() => {
    const pos = new Float32Array(cols * rows * 3);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 3;
        pos[i] = (c - (cols - 1) / 2) * spacing;
        pos[i + 1] = 0;
        pos[i + 2] = (r - (rows - 1) / 2) * spacing;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [cols, rows, spacing]);

  const uniforms = React.useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 18 },
      uPixelRatio: { value: gl.getPixelRatio() },
      uPointer: { value: new THREE.Vector2(99, 99) },
      uAmp: { value: 0.32 },
      uColorA: { value: new THREE.Color("#0ea5e9") },
      uColorB: { value: new THREE.Color("#6366f1") },
      uColorC: { value: new THREE.Color("#a855f7") },
      uCrest: { value: new THREE.Color("#14b8a6") },
      uOpacity: { value: opacity },
      uNear: { value: 2.5 },
      uFar: { value: 12 },
    }),
    [gl, opacity],
  );

  const raycaster = React.useMemo(() => new THREE.Raycaster(), []);
  const plane = React.useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit = React.useMemo(() => new THREE.Vector3(), []);
  const target = React.useMemo(() => new THREE.Vector2(), []);
  const material = React.useRef<THREE.ShaderMaterial>(null);

  useFrame((_, dt) => {
    const u = material.current?.uniforms;
    if (!u) return;
    u.uTime.value += dt;
    // Ripple follows the pointer across the field (only once the pointer has actually moved).
    if (pointer.x === 0 && pointer.y === 0) return;
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(plane, hit)) {
      (u.uPointer.value as THREE.Vector2).lerp(target.set(hit.x, hit.z), Math.min(1, dt * 4));
    }
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial ref={material} vertexShader={vertex(halfWidth)} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} />
    </points>
  );
}

/** Aurora dot field for page heroes. */
export function AuroraWave({ active, compact }: SceneProps) {
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.55, 4.4], fov: 45 }}
      onCreated={({ camera }) => camera.lookAt(0, -0.35, -1.2)}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={active ? "always" : "demand"}
      eventSource={typeof document !== "undefined" ? document.body : undefined}
      eventPrefix="client"
    >
      <Field compact={compact} opacity={0.62} />
    </Canvas>
  );
}
