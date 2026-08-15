import { defineConfig } from "tsdown";

export default defineConfig({
  name: "dsh-plugin-tabnexus/client",
  entry: { client: "lib/client/index.js" },
  outDir: "lib",
  format: ["cjs"],
  platform: "browser",
  dts: false,
  sourcemap: true,
  clean: false,
  external: [/^@deepseek-ai\//, /^react$/, /^react-dom/],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production")
  },
  outputOptions: {
    entryFileNames: "client.js",
    banner: 'window.__ModuleLoader__.load({ id: "dsh-plugin-tabnexus", factory: (require) => {',
    footer: "return module.exports; } });",
    intro: "var module = { exports: {} }; var exports = module.exports;"
  }
});
