/**
 * Instala a build num caminho fixo, fora do diretorio de trabalho.
 *
 * O Chrome deriva o id de uma extensao descompactada do caminho absoluto dela, e
 * o id e a identidade do armazenamento: mover a pasta zera historico de precos,
 * preferencias e feed. Como `npm run extension` recria dist-extension do zero a
 * cada build, apontar o Chrome direto para la faz a extensao sumir da lista no
 * meio de qualquer rebuild.
 *
 * Aqui o destino nunca e apagado, so tem o conteudo trocado: o id se mantem, os
 * dados ficam, e atualizar e recarregar a extensao em chrome://extensions.
 *
 * Destino: ~/.local/share/promo-radar/extension
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = resolve(root, "dist-extension");
const installDir = resolve(homedir(), ".local/share/promo-radar/extension");

if (!existsSync(resolve(buildDir, "manifest.json"))) {
  console.error("dist-extension/ nao existe ou esta incompleta. Rode: npm run extension");
  process.exit(1);
}

const firstInstall = !existsSync(installDir);
mkdirSync(installDir, { recursive: true });

// Esvazia por dentro em vez de recriar o diretorio: e o caminho que o Chrome
// guarda, e some-lo faria a extensao ser descarregada junto com os dados.
readdirSync(installDir).forEach((entry) =>
  rmSync(resolve(installDir, entry), { recursive: true, force: true })
);

cpSync(buildDir, installDir, { recursive: true });

console.log(`[32m✓ Instalada em ${installDir}[0m`);

if (firstInstall) {
  console.log("\n  Primeira instalacao:");
  console.log("  1. Abra chrome://extensions");
  console.log("  2. Ligue o modo desenvolvedor (canto superior direito)");
  console.log("  3. Carregar sem compactacao › selecione o caminho acima");
} else {
  console.log("  Abra chrome://extensions e clique em atualizar no Promo Radar.");
}
