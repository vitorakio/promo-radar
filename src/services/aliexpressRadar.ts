import { AlertSettings, Deal, ScanProgress } from "../types";
import { AnomalySignal, detectAnomaly } from "./anomalyDetector";
import { resolveCategory } from "./categories";
import { describeError } from "./httpClient";
import { getUsdRate } from "./exchangeRate";
import { estimateImportTax } from "./importTax";
import { getBaselines, recordOffers } from "./priceHistory";
import { fetchAliexpressCoupons, fetchAliexpressOffers } from "./providers/aliexpressStore";

export type WatchedDeal = Deal & { anomaly: AnomalySignal };

export type AliexpressScanResult = {
  deals: WatchedDeal[];
  /** Quantos produtos foram lidos antes da classificacao. */
  collected: number;
  durationMs: number;
  /** Mensagens de falha por consulta, quando alguma fonte nao respondeu. */
  errors: string[];
};

const MAX_WATCHED = 80;

/**
 * Varredura dedicada ao AliExpress. Diferente do radar geral, aqui nada e
 * descartado por faixa de desconto: o objetivo e vigiar o preco de tudo e
 * destacar o que fugiu do padrao.
 */
export const scanAliexpress = async (
  settings: AlertSettings,
  knownProductKeys: Set<string> = new Set(),
  onProgress?: (progress: ScanProgress) => void
): Promise<AliexpressScanResult> => {
  const startedAt = Date.now();
  const errors: string[] = [];
  const tasks = [
    { label: "AliExpress: ofertas da loja", run: fetchAliexpressOffers },
    { label: "AliExpress: cupons", run: fetchAliexpressCoupons }
  ];

  onProgress?.({ current: 0, total: tasks.length, label: "Consultando AliExpress" });

  const collected = (
    await Promise.all(
      tasks.map(async (task, index) => {
        onProgress?.({ current: index, total: tasks.length, label: task.label });

        try {
          return await task.run();
        } catch (error) {
          errors.push(`${task.label}: ${describeError(error)}`);
          return [];
        } finally {
          onProgress?.({ current: index + 1, total: tasks.length, label: task.label });
        }
      })
    )
  ).flat();

  const priced = collected.filter((offer) => offer.price > 0);
  if (priced.length > 0) {
    await recordOffers(priced);
  }

  const [baselines, usdRate] = await Promise.all([getBaselines(priced), getUsdRate()]);
  const now = Date.now();

  const deals = collected
    .map((offer, index) => {
      const baseline = baselines.get(offer.productKey);
      const anomaly = detectAnomaly(offer, baseline);
      const reference = anomaly.reference ?? offer.listPrice;

      return {
        id: `${offer.productKey}-${now}-${index}`,
        productKey: offer.productKey,
        title: offer.title,
        store: offer.store,
        // A tela ja e do AliExpress; o tipo segue o sinal encontrado.
        kind: anomaly.level === "price-error" ? "bug" : offer.price <= 0 ? "coupon" : "promo",
        price: offer.price,
        oldPrice: reference,
        discountPercent: anomaly.dropPercent ?? 0,
        category: resolveCategory(offer),
        coupon: offer.coupon,
        couponLabel: offer.couponLabel,
        sourceName: offer.provider,
        url: offer.url,
        imageUrl: offer.imageUrl,
        score: anomaly.score,
        foundAt: new Date(now).toISOString(),
        baseline: anomaly.referenceSource ?? "none",
        isNew: !knownProductKeys.has(offer.productKey),
        notes: anomaly.reason,
        publishedAt: offer.publishedAt,
        priceSince: baseline?.currentPriceSince
          ? new Date(baseline.currentPriceSince).toISOString()
          : undefined,
        // Tudo aqui sai do exterior e entra tributado.
        imported: true,
        importTax:
          offer.price > 0
            ? estimateImportTax(offer.price, usdRate.brlPerUsd, settings.icmsPercent, usdRate.live)
            : undefined,
        anomaly
      } satisfies WatchedDeal;
    })
    .sort((a, b) => b.anomaly.score - a.anomaly.score)
    .slice(0, MAX_WATCHED);

  return { deals, collected: collected.length, durationMs: Date.now() - startedAt, errors };
};
