import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required so Mongoose (a native Node.js module) doesn't get bundled
  // by Webpack/Turbopack on the server side — prevents "mongoose not found" on Vercel
  serverExternalPackages: ["mongoose"],
  
  // Explicitly allow Turbopack to silence the warning if needed
  turbopack: {},
};

export default nextConfig;
