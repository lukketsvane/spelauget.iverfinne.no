/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // R3F reads React internals; Next's tree-shaker (optimizePackageImports) and
  // strict mode's double-invoke can both confuse fiber. Keep it simple.
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
};

export default nextConfig;
