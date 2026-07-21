import {
  isCriticalDeal,
  notifyCriticalDeal,
  notifyDeal,
  notifyScanSummary,
  setupNotifications
} from "./notificationService";
import { Deal } from "../types";

/** Teto de alertas criticos por varredura, para nao inundar a barra de avisos. */
const MAX_CRITICAL_ALERTS = 5;

/**
 * Politica de aviso de uma varredura, compartilhada pelo app e pelo service
 * worker da extensao: erro de preco e queda extrema somem rapido, entao vao um a
 * um; o resto rende um unico aviso da melhor oferta, para a bandeja nao virar
 * uma lista. Acima do teto, um resumo diz quantos ficaram de fora.
 *
 * Devolve se os avisos chegaram a sair, o que tambem confirma a permissao.
 */
export const announceDeals = async (deals: Deal[]): Promise<boolean> => {
  const fresh = deals.filter((deal) => deal.isNew);

  if (fresh.length === 0) {
    return false;
  }

  if (!(await setupNotifications())) {
    return false;
  }

  const criticalDeals = fresh.filter(isCriticalDeal);

  for (const deal of criticalDeals.slice(0, MAX_CRITICAL_ALERTS)) {
    await notifyCriticalDeal(deal);
  }

  if (criticalDeals.length > MAX_CRITICAL_ALERTS) {
    await notifyScanSummary(criticalDeals.length - MAX_CRITICAL_ALERTS);
  }

  const topDeal = fresh.find((deal) => !isCriticalDeal(deal));

  if (topDeal) {
    await notifyDeal(topDeal);
  }

  return true;
};
