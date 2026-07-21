const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

/**
 * A interface da extensao e o service worker precisam ler e escrever o mesmo
 * estado. O AsyncStorage web guarda tudo no localStorage, que nao existe dentro
 * de um service worker, entao a build da extensao troca o modulo pelo adaptador
 * de chrome.storage. As demais plataformas seguem com o pacote original.
 */
if (process.env.PROMO_TARGET === "extension") {
  const storageShim = path.resolve(__dirname, "extension/shims/asyncStorage.ts");

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "@react-native-async-storage/async-storage") {
      return { type: "sourceFile", filePath: storageShim };
    }

    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
