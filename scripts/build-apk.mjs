/**
 * Gera o APK de release assinado.
 *
 * O prebuild recria o diretorio android/ a partir do app.json e dos plugins, o
 * que mantem o projeto nativo descartavel: a fonte da verdade continua sendo a
 * configuracao do Expo. Depois o Gradle compila e assina com a chave descrita em
 * keystore.properties.
 *
 * Saida: dist-apk/promo-radar-<versao>.apk
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "dist-apk");

const run = (command, args, cwd = root) =>
  execFileSync(command, args, { cwd, stdio: "inherit" });

const step = (message) => console.log(`\n[36m▸ ${message}[0m`);

const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

if (!existsSync(resolve(root, "keystore.properties"))) {
  console.warn(
    "[33m⚠ keystore.properties nao encontrado: o APK sairia assinado com a chave de\n" +
      "  depuracao, que nao serve para distribuir nem para atualizar um app ja instalado.\n" +
      "  Veja README.md para gerar a sua.[0m"
  );
  process.exit(1);
}

step("Sincronizando o projeto nativo (expo prebuild)");
run("npx", ["expo", "prebuild", "--platform", "android", "--no-install"]);

step("Compilando o APK de release");
run("./gradlew", ["assembleRelease"], resolve(root, "android"));

step("Publicando o artefato");
mkdirSync(outDir, { recursive: true });
const apkName = `promo-radar-${version}.apk`;
copyFileSync(
  resolve(root, "android/app/build/outputs/apk/release/app-release.apk"),
  resolve(outDir, apkName)
);

console.log(`\n[32m✓ APK pronto em dist-apk/${apkName}[0m`);
console.log("  Instale com: adb install -r dist-apk/" + apkName);
