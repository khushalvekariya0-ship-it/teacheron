import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The file check (src/server/scan.ts) runs OCR in a worker thread and reads PDFs; these load from node_modules as they are.
  serverExternalPackages: ["tesseract.js", "unpdf"],
};

export default nextConfig;
