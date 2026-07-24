import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const routes = [
  "/",
  "/mobile",
  "/fastresearch",
  "/mes-trajets",
  "/settings",
  "/suivi-beta",
  "/infotrafic",
];

const indexHtml = await readFile(path.join(distDir, "index.html"), "utf8");

for (const route of routes) {
  const targetDir = path.join(
    distDir,
    route === "/" ? "" : route.replace(/^\//, ""),
  );
  const targetPath = path.join(targetDir, "index.html");
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, indexHtml, "utf8");
}

console.log("Static route files created for Vercel:", routes.join(", "));
