/**
 * Monta a extensao do Chrome a partir do mesmo codigo do app.
 *
 * Sao duas builds com origens diferentes: a interface sai do Metro, que ja sabe
 * transformar react-native-web em uma pagina, e o service worker sai do esbuild,
 * porque precisa de um unico arquivo sem a arvore de interface junto. As duas
 * usam o adaptador de chrome.storage no lugar do AsyncStorage para enxergarem o
 * mesmo estado.
 *
 * Saida: dist-extension/, pronta para "Carregar sem compactacao" em
 * chrome://extensions com o modo desenvolvedor ligado.
 */

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "dist-extension");
const extensionDir = resolve(root, "extension");

const run = (command, args, env = {}) => {
  execFileSync(command, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
};

const step = (message) => console.log(`\n[36m▸ ${message}[0m`);

step("Limpando a saida anterior");
rmSync(outDir, { recursive: true, force: true });

step("Exportando a interface com o Metro");
run("npx", ["expo", "export", "--platform", "web", "--output-dir", "dist-extension"], {
  PROMO_TARGET: "extension"
});

step("Gerando as paginas da extensao");
const exportedHtml = readFileSync(resolve(outDir, "index.html"), "utf8");
const bundleMatch = exportedHtml.match(/<script src="([^"]+)"/);

if (!bundleMatch) {
  throw new Error("Nao encontrei o script do bundle no index.html exportado.");
}

// O Chrome recusa a extensao inteira se algum diretorio comecar com "_", nome
// reservado para uso do proprio navegador, e o Expo exporta o bundle em _expo.
const EXPORTED_DIR = "_expo";
const BUNDLE_DIR = "bundle";
renameSync(resolve(outDir, EXPORTED_DIR), resolve(outDir, BUNDLE_DIR));

// O Expo aponta para a raiz do servidor; dentro da extensao o caminho e relativo
// a propria pagina.
const bundlePath = `.${bundleMatch[1].replace(`/${EXPORTED_DIR}/`, `/${BUNDLE_DIR}/`)}`;
const template = readFileSync(resolve(extensionDir, "pages/page.template.html"), "utf8");

const writePage = (name, surface) => {
  writeFileSync(
    resolve(outDir, name),
    template.replace("__SURFACE__", surface).replace("__BUNDLE__", bundlePath)
  );
};

writePage("popup.html", "popup");
writePage("tab.html", "tab");

// Sobras de uma aplicacao web servida por HTTP, que nao e o caso aqui: o Chrome
// carrega popup.html e tab.html direto, e o icone vem do manifesto.
["index.html", "metadata.json", "favicon.ico"].forEach((file) =>
  rmSync(resolve(outDir, file), { force: true })
);

step("Empacotando o service worker");
run("npx", [
  "esbuild",
  "extension/src/background.ts",
  "--bundle",
  "--format=esm",
  "--target=chrome120",
  "--minify",
  "--legal-comments=none",
  `--outfile=${resolve(outDir, "background.js")}`,
  // O worker roda so a camada de servicos: react-native e expo-notifications
  // entram como recortes, e o armazenamento vai para chrome.storage.
  "--alias:react-native=./extension/shims/react-native.ts",
  "--alias:expo-notifications=./extension/shims/expo-notifications.ts",
  "--alias:@react-native-async-storage/async-storage=./extension/shims/asyncStorage.ts"
]);

step("Copiando manifesto e icones");
cpSync(resolve(extensionDir, "manifest.json"), resolve(outDir, "manifest.json"));

const iconsDir = resolve(extensionDir, "icons");
if (!existsSync(iconsDir)) {
  throw new Error("Faltam os icones em extension/icons. Rode: npm run icons");
}
mkdirSync(resolve(outDir, "icons"), { recursive: true });
cpSync(iconsDir, resolve(outDir, "icons"), { recursive: true });

// A versao do manifesto acompanha a do app: sao a mesma entrega.
const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const manifestPath = resolve(outDir, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.version = version;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`\n[32m✓ Extensao pronta em ${outDir}[0m`);
console.log("  chrome://extensions › modo desenvolvedor › Carregar sem compactacao");
