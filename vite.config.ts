import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

const proxyConfig: Record<string, ProxyOptions> = {
  "/__dreamscribe/openai": {
    target: "https://api.openai.com",
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/__dreamscribe\/openai/, "/v1/responses"),
  },
  "/__dreamscribe/openai-models": {
    target: "https://api.openai.com",
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/__dreamscribe\/openai-models/, "/v1/models"),
  },
  "/__dreamscribe/anthropic": {
    target: "https://api.anthropic.com",
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/__dreamscribe\/anthropic/, "/v1/messages"),
  },
  "/__dreamscribe/deepseek": {
    target: "https://api.deepseek.com",
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/__dreamscribe\/deepseek/, "/chat/completions"),
  },
  "/__dreamscribe/gemini": {
    target: "https://generativelanguage.googleapis.com",
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/__dreamscribe\/gemini/, ""),
  },
};

export default defineConfig({`n  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: proxyConfig,
  },
});

