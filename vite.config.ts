import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative base so the built asset URLs work behind CloudFront / any S3 prefix.
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    // Lets us import with "@/..." instead of long relative paths.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
