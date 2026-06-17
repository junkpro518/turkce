import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Long-lived Node server in Docker (plan / research A2).
  output: "standalone",
  // Keep these as runtime Node requires (they use dynamic require + bundled data files); do not
  // let the bundler trace them. The morphology data files are copied into cwd at runtime / image.
  serverExternalPackages: [
    "nlptoolkit-morphologicalanalysis",
    "nlptoolkit-spellchecker",
    "nlptoolkit-dictionary",
    "nlptoolkit-corpus",
    "nlptoolkit-datastructure",
    "nlptoolkit-ngram",
    "nlptoolkit-xmlparser",
    "postgres",
  ],
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
