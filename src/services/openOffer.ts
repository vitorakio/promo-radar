import { Linking, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { isExtension, openInTab } from "../platform/extension";

/**
 * Abre a oferta reaproveitando a sessao que ja existe no navegador do aparelho.
 *
 * O app nao guarda login nem senha de loja nenhuma: quem mantem os cookies e o
 * navegador do sistema. No Android a aba customizada e no iOS o SFSafariViewController
 * compartilham esses cookies, entao voce cai na pagina ja logado na sua conta,
 * com os cupons e precos que ela enxerga, sem sair do app.
 */
export const openOffer = async (url: string) => {
  // Na extensao o window.open partiria de um popup que fecha no mesmo instante;
  // a aba criada pelo proprio navegador nao depende da pagina que a pediu.
  if (isExtension) {
    await openInTab(url);
    return;
  }

  if (Platform.OS === "web") {
    await Linking.openURL(url);
    return;
  }

  try {
    await WebBrowser.openBrowserAsync(url, {
      // Sem isso a aba abriria isolada, sem a sessao do navegador.
      browserPackage: undefined,
      showTitle: true,
      enableBarCollapsing: true,
      dismissButtonStyle: "close"
    });
  } catch {
    // Se a aba customizada nao estiver disponivel, o navegador padrao resolve.
    await Linking.openURL(url);
  }
};
