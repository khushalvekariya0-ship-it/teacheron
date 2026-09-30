"use client";

import { motion } from "framer-motion";

/**
 * Re-mounts on every navigation, so each public page fades in the same way.
 * Opacity only: a transform here would break `position: fixed` bars inside pages (e.g. mobile booking bar).
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}
