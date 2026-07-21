/**
 * Ponte com as APIs da extensao do Chrome.
 *
 * O objeto chrome tambem existe em pagina comum aberta no navegador, mas so
 * dentro de uma extensao ele traz runtime.id. E por esse sinal que o app decide
 * usar as APIs da extensao em vez das do navegador, sem afetar o Android nem o
 * app web, onde o objeto nao existe ou nao tem id.
 *
 * Vale para os dois contextos da extensao: a pagina do popup e o service worker
 * que roda a varredura em segundo plano.
 */

const api = (globalThis as { chrome?: typeof chrome }).chrome;

export const isExtension = Boolean(api?.runtime?.id);

/** So use depois de checar isExtension. */
export const chromeApi = api as typeof chrome;

const NOTIFICATION_ICON = "icons/icon128.png";
/** Prefixo do vinculo notificacao -> oferta, lido quando o aviso e clicado. */
export const NOTIFICATION_TARGET_PREFIX = "notif:";

type ChromeNotification = {
  /** Identidade do aviso: repetir o id atualiza o anterior em vez de empilhar outro. */
  id: string;
  title: string;
  body: string;
  url?: string;
  critical?: boolean;
};

/**
 * Aviso pelo canal do sistema. A Notification API do navegador tambem funciona
 * na pagina da extensao, mas o aviso morre junto com o popup quando ele fecha;
 * chrome.notifications sobrevive porque pertence a extensao, nao a pagina.
 */
export const notifyViaChrome = async ({ id, title, body, url, critical }: ChromeNotification) => {
  const notificationId = await chromeApi.notifications.create(id, {
    type: "basic",
    iconUrl: chromeApi.runtime.getURL(NOTIFICATION_ICON),
    title,
    message: body,
    priority: critical ? 2 : 1,
    requireInteraction: Boolean(critical)
  });

  if (url) {
    // O service worker pode ter hibernado entre criar o aviso e o clique, entao o
    // destino vai para o armazenamento de sessao em vez de um mapa em memoria.
    await chromeApi.storage.session.set({ [`${NOTIFICATION_TARGET_PREFIX}${notificationId}`]: url });
  }

  return notificationId;
};

/** Abre a oferta numa aba, reaproveitando a sessao ja logada do navegador. */
export const openInTab = async (url: string) => {
  await chromeApi.tabs.create({ url, active: true });
};

const TAB_PAGE = "tab.html";

/** Abre o proprio app numa aba inteira, para quando a lista nao cabe no popup. */
export const openAppInTab = async () => {
  await chromeApi.tabs.create({ url: chromeApi.runtime.getURL(TAB_PAGE), active: true });
};

/**
 * Zera o contador do icone. Chamado quando o app abre: as ofertas que o service
 * worker encontrou em segundo plano acabaram de ser vistas.
 */
export const clearBadge = async () => {
  if (!isExtension) {
    return;
  }

  await chromeApi.action.setBadgeText({ text: "" });
};

/** Falso na aba expandida, que nao tem por que oferecer "abrir em aba". */
export const isPopupSurface =
  isExtension && !(globalThis.location?.pathname ?? "").endsWith(`/${TAB_PAGE}`);

/**
 * Avisa quando outro contexto da extensao grava nessa chave. E assim que o popup
 * aberto percebe a varredura que o service worker acabou de rodar em segundo plano.
 */
export const subscribeToStorageKey = (key: string, onChange: () => void) => {
  if (!isExtension) {
    return () => undefined;
  }

  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "local" && key in changes) {
      onChange();
    }
  };

  chromeApi.storage.onChanged.addListener(listener);
  return () => chromeApi.storage.onChanged.removeListener(listener);
};
