import { MarketOffer } from "../../types";
import { fetchPageHtml } from "../httpClient";
import { decodeEntities, readNextData, sanitizeListPrice, SearchProvider, SearchTaskSpec } from "./types";

const BASE_URL = "https://www.promobit.com.br";
const IMAGE_HOST = "https://i.promobit.com.br";
const PROVIDER_NAME = "Promobit";

/** Ofertas com maior desconto: onde erros de preco costumam aparecer primeiro. */
const DEALS_CATEGORY = "menor-preco";
const COUPONS_TASK = "cupons";
const MAX_CATEGORIES_PER_SCAN = 3;

/** Palavras do usuario que apontam para cada secao do site. */
const categoryKeywords: { slug: string; label: string; terms: string[] }[] = [
  { slug: "informatica", label: "Informatica", terms: ["ssd", "hd", "notebook", "pc", "computador", "monitor", "teclado", "mouse", "placa", "processador", "memoria", "impressora"] },
  { slug: "eletronicos-audio-e-video", label: "Eletronicos", terms: ["tv", "televis", "som", "fone", "caixa", "soundbar", "headset", "projetor"] },
  { slug: "smartphones-tablets-e-telefones", label: "Celulares", terms: ["celular", "smartphone", "iphone", "galaxy", "motorola", "xiaomi", "tablet"] },
  { slug: "games", label: "Games", terms: ["game", "jogo", "console", "playstation", "ps5", "xbox", "nintendo", "switch"] },
  { slug: "eletrodomesticos", label: "Eletrodomesticos", terms: ["geladeira", "fogao", "lava", "maquina", "microondas", "ar condicionado"] },
  { slug: "eletroportateis", label: "Eletroportateis", terms: ["air fryer", "fritadeira", "liquidificador", "cafeteira", "aspirador", "batedeira"] },
  { slug: "supermercado-e-delivery", label: "Supermercado", terms: ["mercado", "alimento", "cafe", "arroz", "bebida"] },
  { slug: "perfumes-e-beleza", label: "Beleza", terms: ["perfume", "shampoo", "creme", "maquiagem"] },
  { slug: "esporte-e-lazer", label: "Esporte", terms: ["tenis", "bicicleta", "academia", "esteira"] }
];

type PromobitTag = { name?: string; type?: string };

type PromobitOffer = {
  offerId?: number;
  offerTitle?: string;
  offerPrice?: number;
  offerOldPrice?: number;
  offerDiscontPercentage?: number;
  offerPhoto?: string;
  offerSlug?: string;
  offerPublished?: string;
  offerCoupon?: string | null;
  offerPriceType?: string;
  offerLikes?: number;
  offerClicks?: number;
  offerTags?: PromobitTag[];
  storeName?: string;
  categoryName?: string;
};

type PromobitCoupon = {
  couponId?: number;
  couponCode?: string;
  couponTitle?: string;
  couponDiscount?: string;
  couponUrl?: string;
  storeName?: string;
  storeImage?: string;
};

type PromobitPageProps = {
  serverOffers?: { offers?: PromobitOffer[] };
  serverFeaturedOffers?: PromobitOffer[];
  serverCoupons?: PromobitCoupon[] | { coupons?: PromobitCoupon[] };
};

const readPageProps = (html: string): PromobitPageProps =>
  ((readNextData(html) as any)?.props?.pageProps ?? {}) as PromobitPageProps;

/** A comunidade sinaliza erro de preco no proprio titulo da oferta. */
const PRICE_ERROR_PATTERN = /erro\s+de\s+pre|pre[cç]o\s+bugad|bug\s+de\s+pre|pre[cç]o\s+errad/i;

export const looksLikePriceError = (title: string) => PRICE_ERROR_PATTERN.test(title);

/**
 * O Promobit marca com o selo "APP" a oferta cujo preco ou cupom so vale dentro
 * do aplicativo da loja. Cobre os dois casos: preco exclusivo do app e cupom que
 * so funciona por la.
 */
const isAppOnlyOffer = (tags: PromobitTag[] | undefined) =>
  Boolean(tags?.some((tag) => tag.name?.trim().toUpperCase() === "APP"));

/**
 * O site usa 0,01 como marcador de "sem preco proprio" em ofertas que na verdade
 * sao cupons ou selecoes de loja. Abaixo disso nao ha preco para exibir.
 */
const PLACEHOLDER_PRICE = 1;

const toOffer = (raw: PromobitOffer): MarketOffer | undefined => {
  const title = raw.offerTitle ? decodeEntities(raw.offerTitle.trim()) : "";
  const rawPrice = raw.offerPrice ?? 0;
  const hasRealPrice = rawPrice >= PLACEHOLDER_PRICE;
  const price = hasRealPrice ? rawPrice : 0;

  // Sem preco e sem cupom nao sobra nada de util para mostrar.
  if (!title || (!hasRealPrice && !raw.offerCoupon)) {
    return undefined;
  }

  // "A partir de" nao descreve o item exibido, entao o preco cheio nao vale como base.
  const isStartingAt = raw.offerPriceType === "STARTING_AT" || !hasRealPrice;

  return {
    productKey: `promobit:${raw.offerId ?? title.toLowerCase().slice(0, 60)}`,
    title,
    store: raw.storeName?.trim() || PROVIDER_NAME,
    price,
    listPrice: isStartingAt ? undefined : sanitizeListPrice(raw.offerOldPrice, price),
    url: raw.offerSlug ? `${BASE_URL}/oferta/${raw.offerSlug}/` : BASE_URL,
    imageUrl: raw.offerPhoto ? `${IMAGE_HOST}${raw.offerPhoto}` : undefined,
    provider: PROVIDER_NAME,
    category: raw.categoryName,
    coupon: raw.offerCoupon ?? undefined,
    communityVotes: raw.offerLikes,
    publishedAt: raw.offerPublished,
    priceError: looksLikePriceError(title),
    appOnly: isAppOnlyOffer(raw.offerTags),
    // Promocoes garimpadas pela comunidade valem por si, nao pela palavra-chave.
    curated: true
  };
};

const toCouponOffer = (raw: PromobitCoupon): MarketOffer | undefined => {
  const code = raw.couponCode?.trim();
  const title = raw.couponTitle ? decodeEntities(raw.couponTitle.trim()) : "";

  if (!code || !title) {
    return undefined;
  }

  return {
    productKey: `promobit-coupon:${raw.couponId ?? code}`,
    title,
    store: raw.storeName?.trim() || PROVIDER_NAME,
    // Cupom nao tem preco proprio: o desconto se aplica no carrinho.
    price: 0,
    url: raw.couponUrl ? `${BASE_URL}${raw.couponUrl}` : `${BASE_URL}/cupons/`,
    imageUrl: raw.storeImage ?? undefined,
    provider: PROVIDER_NAME,
    category: "Cupons",
    coupon: code,
    couponLabel: raw.couponDiscount?.trim(),
    curated: true
  };
};

const readCoupons = (props: PromobitPageProps): PromobitCoupon[] => {
  const source = props.serverCoupons;
  if (Array.isArray(source)) {
    return source;
  }

  return source?.coupons ?? [];
};

const fetchCoupons = async (): Promise<MarketOffer[]> => {
  const html = await fetchPageHtml(`${BASE_URL}/cupons/`);

  return readCoupons(readPageProps(html))
    .map(toCouponOffer)
    .filter((offer): offer is MarketOffer => Boolean(offer));
};

const fetchCategory = async (slug: string): Promise<MarketOffer[]> => {
  const html = await fetchPageHtml(`${BASE_URL}/promocoes/${slug}/`);
  const props = readPageProps(html);

  return [...(props.serverOffers?.offers ?? []), ...(props.serverFeaturedOffers ?? [])]
    .map(toOffer)
    .filter((offer): offer is MarketOffer => Boolean(offer));
};

/** Escolhe as secoes do site a partir das palavras-chave configuradas. */
const pickCategories = (keywords: string[]): SearchTaskSpec[] => {
  const normalized = keywords.map((keyword) => keyword.toLowerCase());
  const matched = categoryKeywords.filter((category) =>
    normalized.some((keyword) => category.terms.some((term) => keyword.includes(term) || term.includes(keyword)))
  );

  const chosen = (matched.length > 0 ? matched : categoryKeywords.slice(0, 2)).slice(0, MAX_CATEGORIES_PER_SCAN);

  return chosen.map((category) => ({
    query: category.slug,
    label: `${PROVIDER_NAME}: ${category.label}`
  }));
};

export const promobitProvider: SearchProvider = {
  key: "promobit",
  name: PROVIDER_NAME,
  kind: "curator",
  availableOnWeb: true,
  buildTasks: (keywords) => [
    ...pickCategories(keywords),
    { query: DEALS_CATEGORY, label: `${PROVIDER_NAME}: maiores descontos` },
    { query: COUPONS_TASK, label: `${PROVIDER_NAME}: cupons` }
  ],
  search: (query) => (query === COUPONS_TASK ? fetchCoupons() : fetchCategory(query))
};
