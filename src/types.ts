export type DealKind = "promo" | "coupon" | "bug";

export type ScreenKey = "feed" | "aliexpress" | "stores" | "settings";

export type ScanIntervalMinutes = 5 | 10 | 15 | 30 | 60;

/**
 * De onde saiu o desconto do anuncio: do historico de precos deste aparelho,
 * do valor cheio anunciado pela loja, de um sinal do agregador, ou de lugar nenhum.
 */
export type BaselineKind = "history" | "store" | "market" | "none";

export type Deal = {
  id: string;
  /** Identidade estavel do produto entre varreduras, usada para historico e deduplicacao. */
  productKey: string;
  title: string;
  store: string;
  kind: DealKind;
  price: number;
  /** Preco cheio de referencia, exibido mesmo quando nao ha desconto apurado. */
  oldPrice?: number;
  discountPercent: number;
  coupon?: string;
  couponLabel?: string;
  /** Categoria usada para agrupar o feed. */
  category: string;
  /** Fonte que encontrou a oferta (Buscape, Zoom, Amazon, KaBuM, Promobit). */
  sourceName: string;
  url: string;
  imageUrl?: string;
  score: number;
  foundAt: string;
  baseline: BaselineKind;
  isNew?: boolean;
  notes?: string;
  /** Quando a promocao foi publicada pela fonte (ISO). */
  publishedAt?: string;
  /** Desde quando o produto esta neste mesmo preco (ISO). */
  priceSince?: string;
  /** Produto que sai do exterior e entra tributado. */
  imported?: boolean;
  /** Estimativa de custo final para produto importado. */
  importTax?: ImportTaxEstimate;
  /**
   * Preco (ou cupom) que so vale comprando pelo aplicativo da loja. Aberto no
   * navegador, o valor anunciado pode nao aparecer.
   */
  appOnly?: boolean;
};

export type ImportTaxEstimate = {
  importDuty: number;
  icms: number;
  total: number;
  priceUsd: number;
  icmsPercent: number;
  aboveSimplifiedLimit: boolean;
  liveRate: boolean;
};

/** Oferta crua devolvida por um agregador, antes da classificacao. */
export type MarketOffer = {
  productKey: string;
  title: string;
  store: string;
  price: number;
  /** Preco anterior anunciado pela loja, quando ela expoe o valor cheio. */
  listPrice?: number;
  url: string;
  imageUrl?: string;
  provider: string;
  category?: string;
  freeShipping?: boolean;
  storeCount?: number;
  rating?: number;
  reviewCount?: number;
  /** Indice 0-1 do agregador: quao competitivo o preco esta frente ao mercado. */
  competitiveness?: number;
  /** Queda de preco ja detectada pelo agregador, em pontos percentuais. */
  loweringPercent?: number;
  cashbackValue?: number;
  cashbackRate?: number;
  /** Codigo do cupom, quando a oferta depende de um. */
  coupon?: string;
  /** Desconto do cupom como a fonte descreve ("15% OFF", "Frete gratis"). */
  couponLabel?: string;
  /** Votos da comunidade que validou a oferta. */
  communityVotes?: number;
  /** A fonte sinaliza suspeita de erro de preco. */
  priceError?: boolean;
  /** Oferta cujo desconto ou cupom so vale dentro do aplicativo da loja. */
  appOnly?: boolean;
  /** Quando a fonte publicou a promocao (ISO). */
  publishedAt?: string;
  /**
   * Oferta garimpada por curadoria: ja e uma promocao por definicao, entao nao
   * passa pelo filtro de palavras-chave, que serve para busca dirigida.
   */
  curated?: boolean;
};

/** Loja nacional usada como filtro sobre o resultado agregado. */
export type StorePreference = {
  id: string;
  name: string;
  enabled: boolean;
};

export type AlertSettings = {
  /** Faixas de desconto aceitas. Lista vazia significa qualquer desconto. */
  discountTiers: number[];
  notifyCoupons: boolean;
  notifyBuggedAds: boolean;
  autoScanEnabled: boolean;
  autoScanIntervalMinutes: ScanIntervalMinutes;
  keywords: string[];
  blockedTerms: string[];
  /** Mostra tambem lojas fora do catalogo conhecido. */
  includeUnlistedStores: boolean;
  /** Aliquota de ICMS do seu estado, usada na estimativa de importacao. */
  icmsPercent: number;
};

export type ProviderStatus = "ok" | "empty" | "failed";

export type ProviderResult = {
  provider: string;
  query: string;
  status: ProviderStatus;
  offers: number;
  durationMs: number;
  error?: string;
};

export type ScanProgress = {
  current: number;
  total: number;
  label: string;
};

export type ScanOutcome = {
  deals: Deal[];
  /** Ofertas que passaram pelos filtros e ainda nao estavam no feed. */
  newCount: number;
  /** Total de ofertas coletadas antes dos filtros. */
  collected: number;
  durationMs: number;
  providers: ProviderResult[];
  /** True quando nenhuma fonte respondeu e o app caiu no catalogo de demonstracao. */
  usedFallback: boolean;
};
