import { MarketOffer } from "../../types";
import { fetchJson } from "../httpClient";
import { decodeEntities, sanitizeListPrice, keywordTasks, SearchProvider } from "./types";

const API_BASE = "https://servicespub.prod.api.aws.grupokabum.com.br/catalog/v2/products";
const PAGE_SIZE = 20;
const STORE_NAME = "KaBuM!";

type KabumResponse = {
  data?: {
    id?: number;
    attributes?: {
      title?: string;
      price?: number;
      old_price?: number;
      price_with_discount?: number;
      discount_percentage?: number;
      available?: boolean;
      product_link?: string;
      photos?: string[];
      images?: string[];
      score_of_ratings?: number;
      number_of_ratings?: number;
      has_free_shipping?: boolean;
    };
  }[];
};

const toOffer = (item: NonNullable<KabumResponse["data"]>[number]): MarketOffer | undefined => {
  const attributes = item.attributes;
  const title = attributes?.title ? decodeEntities(attributes.title.trim()) : "";
  // price_with_discount ja considera o desconto a vista anunciado pela loja.
  const price = attributes?.price_with_discount || attributes?.price || 0;

  if (!title || price <= 0 || attributes?.available === false) {
    return undefined;
  }

  // old_price e o preco anterior; sem ele, o desconto a vista usa o preco cheio.
  const rawListPrice =
    attributes?.old_price && attributes.old_price > 0
      ? attributes.old_price
      : attributes?.discount_percentage
        ? attributes.price
        : undefined;

  return {
    productKey: `kabum:${item.id ?? title.toLowerCase()}`,
    title,
    store: STORE_NAME,
    price,
    listPrice: sanitizeListPrice(rawListPrice, price),
    url: attributes?.product_link
      ? `https://www.kabum.com.br/produto/${item.id}/${attributes.product_link}`
      : "https://www.kabum.com.br",
    imageUrl: attributes?.photos?.[0] ?? attributes?.images?.[0],
    provider: STORE_NAME,
    rating: attributes?.score_of_ratings,
    reviewCount: attributes?.number_of_ratings,
    freeShipping: attributes?.has_free_shipping
  };
};

export const kabumProvider: SearchProvider = {
  key: "kabum",
  name: STORE_NAME,
  kind: "store",
  // A API responde 403 quando a chamada carrega cabecalho Origin (navegador).
  availableOnWeb: false,
  buildTasks: keywordTasks(STORE_NAME),
  search: async (query) => {
    if (!query) {
      return [];
    }

    const url = `${API_BASE}?query=${encodeURIComponent(query)}&page_number=1&page_size=${PAGE_SIZE}`;
    const response = await fetchJson<KabumResponse>(url);

    return (response.data ?? [])
      .map(toOffer)
      .filter((offer): offer is MarketOffer => Boolean(offer));
  }
};
