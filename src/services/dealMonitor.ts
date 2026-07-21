import { demoDeals } from "../data/demoDeals";
import { resolveStoreId } from "../data/stores";
import { resolveCategory } from "./categories";
import { matchesDiscountTiers } from "./discountTiers";
import { CRITICAL_DISCOUNT_PERCENT } from "./notificationService";
import { getUsdRate } from "./exchangeRate";
import { estimateImportTax, isImportedOffer } from "./importTax";
import {
  AlertSettings,
  BaselineKind,
  Deal,
  DealKind,
  MarketOffer,
  ScanOutcome,
  ScanProgress,
  StorePreference
} from "../types";
import { searchMarket } from "./marketSearch";
import { getBaselines, recordOffers, PriceBaseline } from "./priceHistory";

/** Amostras necessarias para confiar no historico como referencia de preco. */
const MIN_SAMPLES_FOR_HISTORY = 2;
/** Amostras necessarias para chamar uma queda de "anuncio bugado". */
const MIN_SAMPLES_FOR_BUG = 3;
/** Queda a partir da qual o preco deixa de parecer promocao e vira suspeita de erro. */
const BUG_DROP_RATIO = 0.5;
/** Piso para o cashback virar alerta proprio, e nao so uma nota da oferta. */
const MIN_NOTABLE_CASHBACK_PERCENT = 3;
export const MAX_FEED_SIZE = 240;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const formatBrl = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const matchesKeyword = (offer: MarketOffer, keywords: string[]) => {
  if (keywords.length === 0) {
    return true;
  }

  const searchable = normalize(`${offer.title} ${offer.store} ${offer.category ?? ""}`);
  return keywords.some((keyword) => searchable.includes(normalize(keyword)));
};

const hasBlockedTerm = (offer: MarketOffer, blockedTerms: string[]) => {
  const searchable = normalize(`${offer.title} ${offer.store}`);
  return blockedTerms.some((term) => term.trim() && searchable.includes(normalize(term)));
};

const isStoreAllowed = (offer: MarketOffer, stores: StorePreference[], includeUnlisted: boolean) => {
  const storeId = resolveStoreId(offer.store);

  if (!storeId) {
    return includeUnlisted;
  }

  return stores.find((store) => store.id === storeId)?.enabled ?? includeUnlisted;
};

type Classification = {
  kind: DealKind;
  discountPercent: number;
  oldPrice?: number;
  baseline: BaselineKind;
  notes?: string;
};

/**
 * Ordem de confianca do desconto: primeiro o historico deste aparelho (unico
 * capaz de apontar queda anomala), depois o preco cheio da propria loja, e por
 * fim os sinais do agregador. Sem nenhum deles nao inventamos percentual: a
 * oferta entra como monitorada ate haver um preco anterior real para comparar.
 */
const classifyOffer = (offer: MarketOffer, baseline: PriceBaseline | undefined): Classification => {
  const cashbackPercent = offer.cashbackRate ? Math.round(offer.cashbackRate * 1000) / 10 : 0;

  // Cupom nao tem preco proprio: o desconto so existe no carrinho da loja.
  if (offer.price <= 0 && offer.coupon) {
    return {
      kind: "coupon",
      discountPercent: 0,
      baseline: "market",
      notes: `Use o codigo ${offer.coupon} no carrinho da ${offer.store}.`
    };
  }

  // A comunidade marcou o anuncio como erro de preco: e o sinal mais direto que existe.
  if (offer.priceError) {
    const discountPercent = offer.listPrice
      ? Math.round(((offer.listPrice - offer.price) / offer.listPrice) * 100)
      : 0;

    return {
      kind: "bug",
      discountPercent,
      oldPrice: offer.listPrice,
      baseline: offer.listPrice ? "store" : "market",
      notes: "Anuncio sinalizado como erro de preco. Costuma ser corrigido rapido."
    };
  }

  if (baseline && baseline.sampleCount >= MIN_SAMPLES_FOR_HISTORY && baseline.reference > offer.price) {
    const discountPercent = Math.round(((baseline.reference - offer.price) / baseline.reference) * 100);
    const isAnomalous =
      baseline.sampleCount >= MIN_SAMPLES_FOR_BUG && offer.price <= baseline.reference * BUG_DROP_RATIO;

    return {
      kind: isAnomalous ? "bug" : "promo",
      discountPercent,
      oldPrice: baseline.reference,
      baseline: "history",
      notes: isAnomalous
        ? `Queda de ${discountPercent}% sobre ${baseline.sampleCount} leituras. Preco pode ser erro do anuncio e sumir rapido.`
        : `Menor preco ja visto: ${formatBrl(baseline.lowest)}.`
    };
  }

  // Sem historico ainda, o valor cheio da propria loja ja permite medir o desconto.
  if (offer.listPrice && offer.listPrice > offer.price) {
    const discountPercent = Math.round(((offer.listPrice - offer.price) / offer.listPrice) * 100);

    if (discountPercent > 0) {
      return {
        kind: "promo",
        discountPercent,
        oldPrice: offer.listPrice,
        baseline: "store",
        notes: `${offer.store} anuncia ${formatBrl(offer.listPrice)} como preco cheio.${
          offer.freeShipping ? " Frete gratis." : ""
        }`
      };
    }
  }

  // Cupom que acompanha um produto ja precificado.
  if (offer.coupon) {
    return {
      kind: "coupon",
      discountPercent: 0,
      oldPrice: offer.listPrice,
      baseline: offer.listPrice ? "store" : "market",
      notes: `Cupom ${offer.coupon} na ${offer.store}.`
    };
  }

  // Quase toda oferta traz um cashback simbolico; so vale alerta proprio acima do piso.
  if (cashbackPercent >= MIN_NOTABLE_CASHBACK_PERCENT) {
    return {
      kind: "coupon",
      discountPercent: cashbackPercent,
      baseline: "market",
      notes: `Cashback de ${cashbackPercent}% na compra por esta loja.`
    };
  }

  if (offer.loweringPercent && offer.loweringPercent > 0) {
    return {
      kind: "promo",
      discountPercent: Math.round(offer.loweringPercent),
      baseline: "market",
      notes: "Queda de preco sinalizada pelo agregador."
    };
  }

  const competitiveness = offer.competitiveness ?? 0;
  const cashbackNote = cashbackPercent > 0 ? ` Cashback de ${cashbackPercent}%.` : "";

  return {
    kind: "promo",
    discountPercent: 0,
    // Ter historico nao basta: sem queda apurada nao existe desconto para comparar
    // com o corte minimo, entao a oferta segue em observacao em vez de ser barrada.
    baseline: "none",
    notes:
      (competitiveness >= 0.8
        ? `Preco entre os mais competitivos da categoria${offer.storeCount ? ` (${offer.storeCount} lojas comparadas)` : ""}.`
        : "Sem base de comparacao ainda. O preco entra no historico para as proximas varreduras.") + cashbackNote
  };
};

/**
 * Melhor valor cheio conhecido para o produto, mesmo quando ele nao gerou
 * desconto: o preco anunciado pela loja tem prioridade sobre a mediana local.
 */
const referencePrice = (offer: MarketOffer, baseline: PriceBaseline | undefined) => {
  if (offer.listPrice && offer.listPrice > offer.price) {
    return offer.listPrice;
  }

  return baseline && baseline.reference > offer.price ? baseline.reference : undefined;
};

const scoreDeal = (offer: MarketOffer, classification: Classification) => {
  let score = 35;

  const hasMeasuredDiscount = classification.baseline === "history" || classification.baseline === "store";
  score += Math.min(classification.discountPercent, 70) * (hasMeasuredDiscount ? 0.9 : 0.5);
  score += (offer.competitiveness ?? 0) * 20;
  score += Math.min(offer.rating ?? 0, 5) * 2;
  score += Math.min((offer.reviewCount ?? 0) / 200, 5);

  if (classification.kind === "bug") {
    score += 20;
  }

  // Voto da comunidade que confirmou a oferta vale como validacao externa.
  score += Math.min((offer.communityVotes ?? 0) / 10, 10);

  if (classification.baseline === "none") {
    score -= 12;
  }

  return Math.max(1, Math.min(99, Math.round(score)));
};

export const shouldAlertDeal = (deal: Deal, settings: AlertSettings) => {
  if (deal.kind === "coupon") {
    return settings.notifyCoupons;
  }

  if (deal.kind === "bug") {
    return settings.notifyBuggedAds;
  }

  // Queda extrema sempre alerta, mesmo fora das faixas escolhidas: e o caso que
  // some do ar em minutos e nao pode depender do recorte do filtro.
  if (deal.discountPercent >= CRITICAL_DISCOUNT_PERCENT) {
    return true;
  }

  // Onde o desconto foi medido as faixas valem; sem medida a oferta fica em observacao.
  if (deal.baseline === "history" || deal.baseline === "store") {
    return matchesDiscountTiers(deal.discountPercent, settings.discountTiers);
  }

  return true;
};

const toDeal = (
  offer: MarketOffer,
  classification: Classification,
  baseline: PriceBaseline | undefined,
  knownProductKeys: Set<string>,
  index: number,
  now: number,
  taxContext: TaxContext
): Deal => ({
  id: `${offer.productKey}-${now}-${index}`,
  productKey: offer.productKey,
  title: offer.title,
  store: offer.store,
  kind: classification.kind,
  price: offer.price,
  // Mesmo sem desconto apurado mostramos o valor cheio conhecido, para que a
  // oferta sempre tenha uma referencia visivel de quanto o produto custa.
  oldPrice: classification.oldPrice ?? referencePrice(offer, baseline),
  discountPercent: classification.discountPercent,
  category: resolveCategory(offer),
  coupon: offer.coupon,
  couponLabel: offer.couponLabel,
  sourceName: offer.provider,
  url: offer.url,
  imageUrl: offer.imageUrl,
  score: scoreDeal(offer, classification),
  foundAt: new Date(now).toISOString(),
  baseline: classification.baseline,
  isNew: !knownProductKeys.has(offer.productKey),
  notes: classification.notes,
  publishedAt: offer.publishedAt,
  priceSince: baseline?.currentPriceSince ? new Date(baseline.currentPriceSince).toISOString() : undefined,
  appOnly: offer.appOnly,
  ...describeImport(offer, taxContext)
});

type TaxContext = {
  brlPerUsd: number;
  liveRate: boolean;
  icmsPercent: number;
};

/** Marca a origem do produto e, se vier de fora, estima o custo ja tributado. */
const describeImport = (offer: MarketOffer, { brlPerUsd, liveRate, icmsPercent }: TaxContext) => {
  if (!isImportedOffer(offer)) {
    return {};
  }

  return {
    imported: true,
    importTax: estimateImportTax(offer.price, brlPerUsd, icmsPercent, liveRate)
  };
};

export const scanDeals = async (
  stores: StorePreference[],
  settings: AlertSettings,
  knownProductKeys: Set<string> = new Set(),
  onProgress?: (progress: ScanProgress) => void
): Promise<ScanOutcome> => {
  const startedAt = Date.now();
  const { offers, providers } = await searchMarket(settings.keywords, onProgress);

  const usedFallback = offers.length === 0;
  const effectiveOffers = usedFallback ? demoDeals : offers;

  if (!usedFallback) {
    await recordOffers(effectiveOffers);
  }

  const relevantOffers = effectiveOffers.filter(
    (offer) =>
      !hasBlockedTerm(offer, settings.blockedTerms) &&
      // Oferta de curadoria ja e uma promocao garimpada: nao passa pelo filtro
      // de palavras-chave, que existe para direcionar a busca por produto.
      (offer.curated || matchesKeyword(offer, settings.keywords)) &&
      isStoreAllowed(offer, stores, settings.includeUnlistedStores)
  );

  const baselines = await getBaselines(relevantOffers);
  const usdRate = await getUsdRate();
  const taxContext: TaxContext = {
    brlPerUsd: usdRate.brlPerUsd,
    liveRate: usdRate.live,
    icmsPercent: settings.icmsPercent
  };
  const now = Date.now();

  const deals = relevantOffers
    .map((offer, index) =>
      toDeal(
        offer,
        classifyOffer(offer, baselines.get(offer.productKey)),
        baselines.get(offer.productKey),
        knownProductKeys,
        index,
        now,
        taxContext
      )
    )
    .filter((deal) => shouldAlertDeal(deal, settings))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_FEED_SIZE);

  return {
    deals,
    newCount: deals.filter((deal) => deal.isNew).length,
    collected: effectiveOffers.length,
    durationMs: Date.now() - startedAt,
    providers,
    usedFallback
  };
};
