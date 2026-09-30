"use client";

import dynamic from "next/dynamic";
import type { SceneProps } from "./LazyScene";

/*
 * three.js is used only in hero sections (homepage hero globe, inner-page hero wave).
 * Code-split so the 3D bundle downloads only when a hero scene first scrolls into view.
 */
export const GlobeScene = dynamic<SceneProps>(() => import("./Globe"), { ssr: false });
export const GlobeHorizonScene = dynamic<SceneProps>(() => import("./Globe").then((m) => m.GlobeHorizon), { ssr: false });
export const AuroraWaveScene = dynamic<SceneProps>(() => import("./DotWave").then((m) => m.AuroraWave), { ssr: false });
