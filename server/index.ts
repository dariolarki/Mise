import dotenv from "dotenv";
import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import app from "./app.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: path.resolve(currentDirectory, "../.env.local"),
  override: false
});

const port = Number(process.env.PORT ?? 8787);

if (process.env.NODE_ENV === "production") {
  const distDirectory = path.resolve(currentDirectory, "../dist");
  app.use(express.static(distDirectory));
  app.use((_request, response) => {
    response.sendFile(path.join(distDirectory, "index.html"));
  });
}

app.listen(port, "0.0.0.0", () => {
  console.info("[mise:server] ready", {
    url: `http://localhost:${port}`,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
  });
});
