import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // These packages touch the filesystem / native crypto and must not be bundled
  // by the server compiler, otherwise pass signing breaks at runtime.
  serverExternalPackages: [
    "passkit-generator",
    "node-forge",
    "google-auth-library",
  ],
};

export default withPWA({
  dest: "public",
  register: false, // We register manually via window.workbox.register()
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    disableDevLogs: true,
  },
})(nextConfig);
