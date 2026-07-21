const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Assina a build de release com a chave do projeto.
 *
 * O template do React Native assina o release com a keystore de depuracao, que e
 * publica e igual em toda maquina: o Android recusa atualizar um app instalado se
 * a assinatura mudar, entao um APK de debug nao serve para distribuir.
 *
 * Este plugin roda a cada prebuild, que reescreve o diretorio android/ inteiro.
 * As credenciais ficam em keystore.properties na raiz do projeto, fora do que e
 * gerado e fora do controle de versao; sem esse arquivo o build continua com a
 * chave de depuracao, para quem so quer compilar e testar nao precisar de uma.
 */

const PROPERTIES_LOADER = `
// Credenciais de assinatura (keystore.properties na raiz do projeto, fora do git).
def promoSigning = new Properties()
def promoSigningFile = rootProject.file("../keystore.properties")
if (promoSigningFile.exists()) {
    promoSigningFile.withInputStream { promoSigning.load(it) }
}
`;

const RELEASE_SIGNING_CONFIG = `        release {
            if (promoSigning['storeFile']) {
                storeFile rootProject.file("../" + promoSigning['storeFile'])
                storePassword promoSigning['storePassword']
                keyAlias promoSigning['keyAlias']
                keyPassword promoSigning['keyPassword']
            }
        }
`;

const DEBUG_SIGNING_CONFIG = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
`;

const TEMPLATE_RELEASE_SIGNING = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

const PROJECT_RELEASE_SIGNING = `            // Chave do projeto quando keystore.properties existe; sem ele, a de depuracao.
            signingConfig promoSigning['storeFile'] ? signingConfigs.release : signingConfigs.debug`;

const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (gradleConfig) => {
    let contents = gradleConfig.modResults.contents;

    if (contents.includes("promoSigning")) {
      return gradleConfig;
    }

    if (!contents.includes(DEBUG_SIGNING_CONFIG) || !contents.includes(TEMPLATE_RELEASE_SIGNING)) {
      throw new Error(
        "withReleaseSigning: o build.gradle nao tem o formato esperado do template. " +
          "Confira android/app/build.gradle antes de assinar a release."
      );
    }

    contents = contents.replace(
      'apply plugin: "com.facebook.react"',
      `apply plugin: "com.facebook.react"\n${PROPERTIES_LOADER}`
    );
    contents = contents.replace(DEBUG_SIGNING_CONFIG, DEBUG_SIGNING_CONFIG + RELEASE_SIGNING_CONFIG);
    contents = contents.replace(TEMPLATE_RELEASE_SIGNING, PROJECT_RELEASE_SIGNING);

    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });

module.exports = withReleaseSigning;
