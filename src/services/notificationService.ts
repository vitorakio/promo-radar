import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { isExtension, notifyViaChrome } from "../platform/extension";
import { Deal } from "../types";

const CHANNEL_ID = "promo-alerts";

/**
 * expo-notifications nao implementa agendamento no navegador: chamar
 * scheduleNotificationAsync ali lanca erro. No web usamos a Notification API
 * do proprio browser, que cobre o aviso imediato que o radar precisa.
 */
const isWeb = Platform.OS === "web";

const webNotificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

export const setupNotifications = async () => {
  // A extensao declara a permissao no manifesto: nao ha o que pedir em tempo de
  // execucao, e o aviso sai pelo canal do navegador mesmo com o popup fechado.
  if (isExtension) {
    return true;
  }

  if (isWeb) {
    if (!webNotificationsSupported()) {
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission === "denied") {
      return false;
    }

    return (await Notification.requestPermission()) === "granted";
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Alertas de promocao",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#12B981"
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === "granted";
};

type NotificationPayload = {
  title: string;
  body: string;
  critical?: boolean;
  data?: Record<string, unknown>;
};

/** Entrega o aviso pelo caminho que a plataforma atual suporta. */
const present = async ({ title, body, critical, data }: NotificationPayload) => {
  if (isExtension) {
    await notifyViaChrome({
      id: String(data?.dealId ?? title),
      title,
      body,
      url: typeof data?.url === "string" ? data.url : undefined,
      critical
    });

    return;
  }

  if (isWeb) {
    if (!webNotificationsSupported() || Notification.permission !== "granted") {
      return;
    }

    // tag agrupa por oferta: reabrir a mesma promocao nao empilha avisos.
    const notification = new Notification(title, {
      body,
      tag: String(data?.dealId ?? title),
      requireInteraction: critical
    });

    notification.onclick = () => {
      window.focus();
      const url = data?.url;
      if (typeof url === "string") {
        window.open(url, "_blank");
      }
      notification.close();
    };

    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      ...(critical
        ? {
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 400, 200, 400]
          }
        : {}),
      data: data ?? {}
    },
    trigger: null
  });
};

const formatPrice = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const notifyDeal = async (deal: Deal) => {
  const title =
    deal.kind === "bug"
      ? "Possivel anuncio bugado"
      : deal.kind === "coupon"
        ? "Cupom encontrado"
        : "Promocao encontrada";

  const price =
    deal.price > 0
      ? `R$ ${deal.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : "Cupom ativo";

  await present({
    title,
    body: `${deal.store}: ${deal.title} - ${price}`,
    data: { dealId: deal.id, url: deal.url }
  });
};

/**
 * Queda a partir da qual a oferta vira alerta critico mesmo sem ser erro de preco.
 */
export const CRITICAL_DISCOUNT_PERCENT = 80;

/** Oferta que nao pode passar batida: erro de preco ou queda muito grande. */
export const isCriticalDeal = (deal: Deal) =>
  deal.kind === "bug" || deal.discountPercent >= CRITICAL_DISCOUNT_PERCENT;

/**
 * Alerta de prioridade maxima. Some rapido do ar, entao vai com som, vibracao
 * longa e o preco no titulo para decidir sem abrir o app.
 */
export const notifyCriticalDeal = async (deal: Deal) => {
  const title =
    deal.kind === "bug"
      ? `Possivel erro de preco: ${deal.store}`
      : `${deal.discountPercent}% off na ${deal.store}`;

  const priceLine = deal.price > 0 ? formatPrice(deal.price) : (deal.coupon ?? "cupom");
  const fromLine = deal.oldPrice ? ` (de ${formatPrice(deal.oldPrice)})` : "";

  await present({
    title,
    body: `${priceLine}${fromLine} · ${deal.title}`,
    critical: true,
    data: { dealId: deal.id, url: deal.url, critical: true }
  });
};

/**
 * Dispara um alerta critico de exemplo para conferir permissao, som e formato
 * sem precisar esperar uma oferta real aparecer.
 */
export const sendTestNotification = async (): Promise<boolean> => {
  const ready = await setupNotifications();

  if (!ready) {
    return false;
  }

  await notifyCriticalDeal({
    id: "test-notification",
    productKey: "test",
    title: "SSD NVMe 2TB Gen4 (exemplo de alerta)",
    store: "KaBuM!",
    kind: "bug",
    price: 89.9,
    oldPrice: 899.9,
    discountPercent: 90,
    category: "Informatica",
    sourceName: "Teste",
    url: "https://www.kabum.com.br",
    score: 99,
    foundAt: new Date().toISOString(),
    baseline: "history"
  });

  return true;
};

export const notifyScanSummary = async (count: number) => {
  await present({
    title: count === 1 ? "1 alerta novo" : `${count} alertas novos`,
    body: "Abra o Promo Radar para ver as oportunidades filtradas."
  });
};
