/**
 * Empacota dist-extension/ no ZIP que a Chrome Web Store aceita no upload.
 *
 * O painel exige um ZIP cuja raiz seja o manifest.json, e nao uma pasta contendo
 * o manifesto; o zip roda de dentro de dist-extension por causa disso.
 *
 * Saida: dist-extension-<versao>.zip
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = resolve(root, "dist-extension");

if (!existsSync(resolve(buildDir, "manifest.json"))) {
  console.error("dist-extension/ nao existe ou esta incompleta. Rode: npm run extension");
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(resolve(buildDir, "manifest.json"), "utf8"));
const zipPath = resolve(root, `promo-radar-extensao-${version}.zip`);

// Reempacotar por cima do anterior deixaria arquivos de builds antigas dentro.
rmSync(zipPath, { force: true });

execFileSync("zip", ["-r", "-q", zipPath, "."], { cwd: buildDir, stdio: "inherit" });

const files = execFileSync("unzip", ["-l", zipPath], { encoding: "utf8" })
  .trim()
  .split("\n")
  .slice(-1)[0];

console.log(`[32m✓ ${zipPath.replace(`${root}/`, "")}[0m`);
console.log(`  ${files.trim()}`);
console.log("  Upload em: https://chrome.google.com/webstore/devconsole");
