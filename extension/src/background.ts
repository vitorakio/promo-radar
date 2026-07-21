/**
 * Service worker da extensao: a varredura que roda sem ninguem olhando.
 *
 * O popup so existe enquanto esta aberto, entao o radar de verdade mora aqui. O
 * alarme acorda o worker no intervalo escolhido nas preferencias, ele varre as
 * mesmas fontes que o app, avisa pelas notificacoes do navegador e publica o
 * resultado no mesmo armazenamento que o popup le ao abrir.
 */

import { NOTIFICATION_TARGET_PREFIX } from "../../src/platform/extension";
import { announceDeals } from "../../src/services/dealAlerts";
import { scanDeals } from "../../src/services/dealMonitor";
import { loadSettings, loadStores } from "../../src/storage/appStorage";
import { loadFeed, saveFeed } from "../../src/storage/feedCache";

const SCAN_ALARM = "promo-radar/scan";
const SETTINGS_KEY = "@promo-radar/settings";
const BADGE_COLOR = "#12B981";
/** Acima disso o contador do icone nao caberia. */
const MAX_BADGE_COUNT = 99;
/**
 * O worker hiberna depois de 30s parado. Uma chamada de API a cada 20s renova
 * esse prazo enquanto a varredura, que leva bem mais que isso, ainda corre.
 */
const KEEPALIVE_INTERVAL_MS = 20000;
/**
 * Varredura recente o bastante para o alarme nao repetir o trabalho que o popup
 * acabou de fazer, ou que o proprio worker fez num disparo anterior.
 */
const MIN_INTERVAL_BETWEEN_SCANS_MS = 60000;

let scanning = false;

const setBadge = async (count: number) => {
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  await chrome.action.setBadgeText({
    text: count > 0 ? String(Math.min(count, MAX_BADGE_COUNT)) : ""
  });
};

const keepWorkerAwake = () => {
  const timerId = setInterval(() => {
    chrome.runtime.getPlatformInfo().catch(() => undefined);
  }, KEEPALIVE_INTERVAL_MS);

  return () => clearInterval(timerId);
};

type ScanReason = "alarm" | "manual";

const runScan = async (reason: ScanReason) => {
  if (scanning) {
    return { ran: false, reason: "ja em andamento" as const };
  }

  const cached = await loadFeed();

  if (reason === "alarm" && cached && Date.now() - cached.savedAt < MIN_INTERVAL_BETWEEN_SCANS_MS) {
    return { ran: false, reason: "varredura recente" as const };
  }

  scanning = true;
  const stopKeepAlive = keepWorkerAwake();

  try {
    const [stores, settings] = await Promise.all([loadStores(), loadSettings()]);
    // O feed guardado diz o que ja era conhecido, para nao avisar duas vezes da
    // mesma oferta a cada varredura.
    const knownProductKeys = new Set((cached?.deals ?? []).map((deal) => deal.productKey));

    const result = await scanDeals(stores, settings, knownProductKeys);

    // O catalogo de demonstracao aparece quando nenhuma fonte respondeu: nao e
    // resultado de varredura e nao pode virar alerta nem feed guardado.
    if (result.usedFallback) {
      return { ran: true, deals: 0, newCount: 0 };
    }

    await saveFeed(result.deals, result.newCount);
    await announceDeals(result.deals);
    await setBadge(result.newCount);

    return { ran: true, deals: result.deals.length, newCount: result.newCount };
  } finally {
    scanning = false;
    stopKeepAlive();
  }
};

/**
 * Mantem o alarme igual as preferencias do app. Um alarme com o mesmo periodo e
 * deixado como esta: recria-lo adiaria a proxima varredura a cada mudanca de
 * qualquer outra preferencia.
 */
const syncAlarm = async () => {
  const settings = await loadSettings();

  if (!settings.autoScanEnabled) {
    await chrome.alarms.clear(SCAN_ALARM);
    return;
  }

  const period = settings.autoScanIntervalMinutes;
  const existing = await chrome.alarms.get(SCAN_ALARM);

  if (existing?.periodInMinutes === period) {
    return;
  }

  chrome.alarms.create(SCAN_ALARM, { periodInMinutes: period, delayInMinutes: period });
};

chrome.runtime.onInstalled.addListener(() => {
  syncAlarm().catch(() => undefined);
});

chrome.runtime.onStartup.addListener(() => {
  syncAlarm().catch(() => undefined);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SCAN_ALARM) {
    runScan("alarm").catch(() => undefined);
  }
});

// Ligar a analise automatica ou trocar o intervalo no app grava as preferencias;
// o worker acompanha a gravacao em vez de depender de um aviso do popup, que
// poderia fechar antes de manda-lo.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && SETTINGS_KEY in changes) {
    syncAlarm().catch(() => undefined);
  }
});

type WorkerMessage = { type: "SCAN_NOW" } | { type: "GET_STATUS" };

chrome.runtime.onMessage.addListener((message: WorkerMessage, _sender, sendResponse) => {
  if (message?.type === "SCAN_NOW") {
    runScan("manual")
      .then(sendResponse)
      .catch((error: unknown) => sendResponse({ ran: false, error: String(error) }));

    // Resposta assincrona: o canal precisa continuar aberto ate a varredura acabar.
    return true;
  }

  if (message?.type === "GET_STATUS") {
    sendResponse({ scanning });
    return false;
  }

  return false;
});

chrome.notifications.onClicked.addListener((notificationId) => {
  const key = `${NOTIFICATION_TARGET_PREFIX}${notificationId}`;

  chrome.storage.session
    .get(key)
    .then(async (stored) => {
      const url = stored[key];

      if (typeof url === "string") {
        await chrome.tabs.create({ url, active: true });
        await chrome.storage.session.remove(key);
      }

      await chrome.notifications.clear(notificationId);
    })
    .catch(() => undefined);
});
