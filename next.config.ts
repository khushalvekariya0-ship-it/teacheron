import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The file check (src/server/scan.ts) runs OCR in a worker thread and reads PDFs; these load from node_modules as they are.
  // nodemailer sends the site's own email over SMTP.
  serverExternalPackages: ["tesseract.js", "unpdf", "nodemailer"],
};

export default nextConfig;
