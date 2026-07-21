import { MarketOffer } from "../../types";
import { fetchPageHtml } from "../httpClient";
import { decodeEntities, readNextData, sanitizeListPrice } from "./types";

/**
 * O AliExpress responde com captcha a acesso automatizado, entao a leitura vem
 * da pagina que o Promobit mantem para a loja: ofertas garimpadas pela
 * comunidade, com preco cheio e votos que ajudam a separar erro de preco real.
 */
const OFFERS_URL = "https://www.promobit.com.br/promocoes/loja/aliexpress/";
const COUPONS_URL = "https://www.promobit.com.br/cupons/loja/aliexpress/";
const IMAGE_HOST = "https://i.promobit.com.br";
const STORE_NAME = "AliExpress";
const SOURCE_NAME = "Promobit · AliExpress";

/** Marcador de "oferta sem preco proprio" usado pela fonte. */
const PLACEHOLDER_PRICE = 1;

const PRICE_ERROR_PATTERN = /erro\s+de\s+pre|pre[cç]o\s+bugad|bug\s+de\s+pre|pre[cç]o\s+errad/i;

type RawOffer = {
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
  categoryName?: string;
};

type RawCoupon = {
  couponId?: number;
  couponCode?: string;
  couponTitle?: string;
  couponDiscount?: string;
  couponUrl?: string;
  storeImage?: string;
};

type PageProps = {
  serverOffers?: { offers?: RawOffer[] };
  serverFeaturedOffers?: RawOffer[];
  serverCoupons?: RawCoupon[] | { coupons?: RawCoupon[] };
};

const readPageProps = (html: string): PageProps =>
  ((readNextData(html) as any)?.props?.pageProps ?? {}) as PageProps;

const toOffer = (raw: RawOffer): MarketOffer | undefined => {
  const title = raw.offerTitle ? decodeEntities(raw.offerTitle.trim()) : "";
  const rawPrice = raw.offerPrice ?? 0;
  const hasRealPrice = rawPrice >= PLACEHOLDER_PRICE;

  // Aqui so interessam produtos com preco: cupons entram pela outra consulta.
  if (!title || !hasRealPrice) {
    return undefined;
  }

  const isStartingAt = raw.offerPriceType === "STARTING_AT";

  return {
    productKey: `aliexpress:${raw.offerId ?? title.toLowerCase().slice(0, 60)}`,
    title,
    store: STORE_NAME,
    price: rawPrice,
    listPrice: isStartingAt ? undefined : sanitizeListPrice(raw.offerOldPrice, rawPrice),
    url: raw.offerSlug ? `https://www.promobit.com.br/oferta/${raw.offerSlug}/` : OFFERS_URL,
    imageUrl: raw.offerPhoto ? `${IMAGE_HOST}${raw.offerPhoto}` : undefined,
    provider: SOURCE_NAME,
    category: raw.categoryName,
    coupon: raw.offerCoupon ?? undefined,
    communityVotes: raw.offerLikes,
    publishedAt: raw.offerPublished,
    priceError: PRICE_ERROR_PATTERN.test(title),
    curated: true
  };
};

const toCoupon = (raw: RawCoupon): MarketOffer | undefined => {
  const code = raw.couponCode?.trim();
  const title = raw.couponTitle ? decodeEntities(raw.couponTitle.trim()) : "";

  if (!code || !title) {
    return undefined;
  }

  return {
    productKey: `aliexpress-coupon:${raw.couponId ?? code}`,
    title,
    store: STORE_NAME,
    price: 0,
    url: raw.couponUrl ? `https://www.promobit.com.br${raw.couponUrl}` : COUPONS_URL,
    imageUrl: raw.storeImage ?? undefined,
    provider: SOURCE_NAME,
    category: "Cupons",
    coupon: code,
    couponLabel: raw.couponDiscount?.trim(),
    curated: true
  };
};

const readCoupons = (props: PageProps): RawCoupon[] => {
  const source = props.serverCoupons;
  return Array.isArray(source) ? source : (source?.coupons ?? []);
};

export const fetchAliexpressOffers = async (): Promise<MarketOffer[]> => {
  const html = await fetchPageHtml(OFFERS_URL);
  const props = readPageProps(html);

  return [...(props.serverOffers?.offers ?? []), ...(props.serverFeaturedOffers ?? [])]
    .map(toOffer)
    .filter((offer): offer is MarketOffer => Boolean(offer));
};

export const fetchAliexpressCoupons = async (): Promise<MarketOffer[]> => {
  const html = await fetchPageHtml(COUPONS_URL);

  return readCoupons(readPageProps(html))
    .map(toCoupon)
    .filter((offer): offer is MarketOffer => Boolean(offer));
};
