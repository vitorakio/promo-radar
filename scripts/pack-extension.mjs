/**
 * Empacota dist-extension/ para distribuicao.
 *
 * O ZIP tem o manifest.json na raiz, e nao uma pasta contendo o manifesto: e o
 * formato que o Chrome espera ao descompactar e o mesmo que a Chrome Web Store
 * aceitaria no upload. Por isso o zip roda de dentro de dist-extension.
 *
 * O nome nao leva a versao para que o link do release mais recente no GitHub
 * (/releases/latest/download/promo-radar-extensao.zip) continue valendo a cada
 * publicacao. A versao fica no manifesto e no nome do release.
 *
 * Saida: promo-radar-extensao.zip
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
const zipPath = resolve(root, "promo-radar-extensao.zip");

// Reempacotar por cima do anterior deixaria arquivos de builds antigas dentro.
rmSync(zipPath, { force: true });

execFileSync("zip", ["-r", "-q", zipPath, "."], { cwd: buildDir, stdio: "inherit" });

const files = execFileSync("unzip", ["-l", zipPath], { encoding: "utf8" })
  .trim()
  .split("\n")
  .slice(-1)[0];

console.log(`[32m✓ ${zipPath.replace(`${root}/`, "")} (versao ${version})[0m`);
console.log(`  ${files.trim()}`);
console.log("  Anexe ao release do GitHub para virar o download da versao mais recente.");
