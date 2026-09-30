"use client";

import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Line2 } from "three-stdlib";
import { METROS } from "@/lib/data/geo";
import type { SceneProps } from "./LazyScene";

/*
 * A clean, abstract dotted globe: fibonacci-distributed dots (front bright, back faded),
 * a thin graticule, pulsing markers at the metros where sample tutors teach, and "comet"
 * arcs travelling between them — a quiet picture of a marketplace connecting people.
 */

const D2R = Math.PI / 180;
const US_CENTER = { lat: 38.5, lng: -96 };

function latLng(lat: number, lng: number, r = 1): THREE.Vector3 {
  const phi = (90 - lat) * D2R;
  const theta = (lng + 180) * D2R;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

const dotVertex = /* glsl */ `
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aHighlight;
  attribute vec3 aColor;
  varying float vFacing;
  varying float vHighlight;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFacing = dot(n, normalize(-mv.xyz));
    vHighlight = aHighlight;
    gl_PointSize = uSize * uPixelRatio * (1.0 + aHighlight * 0.35) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const dotFragment = /* glsl */ `
  uniform float uOpacity;
  varying float vFacing;
  varying float vHighlight;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float edge = smoothstep(0.5, 0.32, d);
    float facing = smoothstep(-0.15, 0.55, vFacing);
    float a = mix(0.07, mix(0.42, 1.0, vHighlight), facing) * uOpacity * edge;
    gl_FragColor = vec4(vColor, a);
  }
`;

function Dots({ count }: { count: number }) {
  const { gl } = useThree();
  const geometry = React.useMemo(() => {
    const pos = new Float32Array(count * 3);
    const hi = new Float32Array(count);
    const col = new Float32Array(count * 3);
    // Light aurora gradient wrapped around the sphere: sky → indigo → violet → mint → sky
    const stops = ["#0ea5e9", "#6366f1", "#8b5cf6", "#14b8a6", "#0ea5e9"].map((c) => new THREE.Color(c));
    const tmp = new THREE.Color();
    const center = latLng(US_CENTER.lat, US_CENTER.lng).normalize();
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = golden * i;
      const v = new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r);
      pos.set([v.x, v.y, v.z], i * 3);
      // Dots over the continental US glow slightly brighter.
      const ang = Math.acos(Math.min(1, Math.max(-1, v.dot(center))));
      hi[i] = Math.max(0, 1 - ang / (24 * D2R));
      const u = ((Math.atan2(v.z, v.x) / (2 * Math.PI) + 0.5) * 4 + (v.y + 1) * 0.35) % 4;
      const k = Math.floor(u);
      tmp.copy(stops[k]).lerp(stops[k + 1], u - k);
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(pos.slice(), 3));
    g.setAttribute("aHighlight", new THREE.BufferAttribute(hi, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    return g;
  }, [count]);
  const uniforms = React.useMemo(
    () => ({ uSize: { value: 8 }, uPixelRatio: { value: gl.getPixelRatio() }, uOpacity: { value: 1 } }),
    [gl],
  );
  return (
    <points geometry={geometry}>
      <shaderMaterial vertexShader={dotVertex} fragmentShader={dotFragment} uniforms={uniforms} transparent depthWrite={false} />
    </points>
  );
}

function Graticule() {
  const lines = React.useMemo(() => {
    const out: THREE.Vector3[][] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lng = -180; lng <= 180; lng += 4) pts.push(latLng(lat, lng, 1.001));
      out.push(pts);
    }
    for (let lng = -180; lng < 180; lng += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 4) pts.push(latLng(lat, lng, 1.001));
      out.push(pts);
    }
    return out;
  }, []);
  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color="#818cf8" lineWidth={0.6} transparent opacity={0.16} depthWrite={false} />
      ))}
    </>
  );
}

const ROUTES: [string, string][] = [
  ["new-york-ny", "chicago-il"],
  ["chicago-il", "austin-tx"],
  ["austin-tx", "los-angeles-ca"],
  ["los-angeles-ca", "seattle-wa"],
  ["seattle-wa", "denver-co"],
  ["denver-co", "atlanta-ga"],
  ["atlanta-ga", "miami-fl"],
  ["boston-ma", "washington-dc"],
  ["san-francisco-ca", "phoenix-az"],
  ["houston-tx", "philadelphia-pa"],
  ["new-york-ny", "miami-fl"],
];

function Arc({ from, to, delay }: { from: THREE.Vector3; to: THREE.Vector3; delay: number }) {
  const ref = React.useRef<Line2>(null);
  const points = React.useMemo(() => {
    const dist = from.distanceTo(to);
    const mid = from.clone().add(to).normalize().multiplyScalar(1 + dist * 0.45);
    return new THREE.QuadraticBezierCurve3(from, mid, to).getPoints(64);
  }, [from, to]);
  const colors = React.useMemo(() => {
    const a = new THREE.Color("#14b8a6");
    const b = new THREE.Color("#6366f1");
    const c = new THREE.Color("#a855f7");
    return points.map((_, i) => {
      const t = i / (points.length - 1);
      const out = t < 0.5 ? a.clone().lerp(b, t * 2) : b.clone().lerp(c, (t - 0.5) * 2);
      return [out.r, out.g, out.b] as [number, number, number];
    });
  }, [points]);
  useFrame((_, dt) => {
    const m = ref.current?.material as unknown as { dashOffset: number } | undefined;
    if (m) m.dashOffset -= dt * 0.55;
  });
  return (
    <>
      <Line points={points} color="#a5b4fc" lineWidth={0.8} transparent opacity={0.35} depthWrite={false} />
      <Line
        ref={ref}
        points={points}
        vertexColors={colors}
        color="#ffffff"
        lineWidth={1.8}
        dashed
        dashSize={0.28}
        gapSize={1.6}
        dashOffset={-delay}
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </>
  );
}

function Marker({ position, phase }: { position: THREE.Vector3; phase: number }) {
  const ring = React.useRef<THREE.Mesh>(null);
  const quaternion = React.useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize()), [position]);
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * 0.6 + phase) % 1;
    if (ring.current) {
      ring.current.scale.setScalar(1 + t * 1.6);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - t);
    }
  });
  return (
    <group position={position} quaternion={quaternion}>
      <mesh>
        <circleGeometry args={[0.011, 20]} />
        <meshBasicMaterial color="#4f46e5" />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.016, 0.019, 40]} />
        <meshBasicMaterial color="#0ea5e9" transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function GlobeRig({ compact, tiltFactor = 0.72 }: { compact: boolean; tiltFactor?: number }) {
  const tilt = React.useRef<THREE.Group>(null);
  const spin = React.useRef<THREE.Group>(null);
  const { pointer } = useThree();
  const center = React.useMemo(() => latLng(US_CENTER.lat, US_CENTER.lng), []);
  const baseY = React.useMemo(() => -Math.atan2(center.x, center.z), [center]);
  const baseX = US_CENTER.lat * D2R * tiltFactor;
  const metros = React.useMemo(() => Object.fromEntries(METROS.map((m) => [m.slug, latLng(m.lat, m.lng, 1.004)])), []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (spin.current) {
      const target = baseY + Math.sin(t * 0.12) * 0.32 + pointer.x * 0.18;
      spin.current.rotation.y += (target - spin.current.rotation.y) * Math.min(1, dt * 2.5);
    }
    if (tilt.current) {
      const target = baseX - pointer.y * 0.1;
      tilt.current.rotation.x += (target - tilt.current.rotation.x) * Math.min(1, dt * 2.5);
    }
  });

  return (
    <group ref={tilt} rotation={[baseX, 0, 0]}>
      <group ref={spin} rotation={[0, baseY, 0]}>
        <Dots count={compact ? 1400 : 2600} />
        <Graticule />
        {ROUTES.map(([a, b], i) => (
          <Arc key={`${a}-${b}`} from={metros[a]} to={metros[b]} delay={i * 0.37} />
        ))}
        {METROS.map((m, i) => (
          <Marker key={m.slug} position={metros[m.slug]} phase={(i * 0.137) % 1} />
        ))}
      </group>
    </group>
  );
}

/** Crisp outline that stays facing the camera. */
function Outline() {
  return (
    <mesh>
      <ringGeometry args={[1.0, 1.0045, 160]} />
      <meshBasicMaterial color="#818cf8" transparent opacity={0.3} depthWrite={false} />
    </mesh>
  );
}

export default function GlobeScene({ active, compact, variant = "hero" }: SceneProps & { variant?: "hero" | "horizon" }) {
  const horizon = variant === "horizon";
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={[1, compact ? 1.5 : 2]}
      camera={{ position: [0, 0, horizon ? 3.35 : 3.05], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={active ? "always" : "demand"}
      eventSource={typeof document !== "undefined" ? document.body : undefined}
      eventPrefix="client"
    >
      <Outline />
      <GlobeRig compact={compact} tiltFactor={horizon ? 0.12 : 0.72} />
    </Canvas>
  );
}

/** Globe framed as a horizon rising from the bottom of a centered hero. */
export function GlobeHorizon(props: SceneProps) {
  return <GlobeScene {...props} variant="horizon" />;
}
