import { MarketOffer } from "../../types";
import { fetchPageHtml } from "../httpClient";
import { decodeEntities, parseBrlNumber, sanitizeListPrice, keywordTasks, SearchProvider } from "./types";

const STORE_NAME = "Amazon";
const MAX_RESULTS = 24;

/** Cada cartao da busca comeca com o data-asin do produto. */
const CARD_SPLIT = /<div[^>]+data-asin="/g;
const RESULT_MARKER = 'data-component-type="s-search-result"';

const readAsin = (block: string) => block.match(/^([A-Z0-9]{10})"/)?.[1];

const readTitle = (block: string) =>
  block.match(/<h2[^>]*>(?:[\s\S]*?)<span[^>]*>([^<]{10,})<\/span>/)?.[1] ??
  block.match(/<h2[^>]*aria-label="([^"]{10,})"/)?.[1];

const readPrice = (block: string) => {
  const whole = block.match(/a-price-whole">([\d.]+)/)?.[1];
  if (!whole) {
    return undefined;
  }

  const fraction = block.match(/a-price-fraction">(\d+)/)?.[1] ?? "00";
  return parseBrlNumber(`${whole},${fraction}`);
};

/**
 * O markup do preco riscado tambem embala o valor da parcela ("10x de R$ 102,90"),
 * por isso o candidato passa por sanidade antes de virar preco anterior.
 */
const readListPrice = (block: string) => {
  const candidates = [...block.matchAll(/a-text-price[^>]*>\s*<span[^>]*class="a-offscreen">([^<]+)</g)].map(
    (match) => parseBrlNumber(match[1])
  );

  return candidates.filter((value): value is number => Boolean(value)).sort((a, b) => b - a)[0];
};

const toOffer = (block: string): MarketOffer | undefined => {
  const title = readTitle(block);
  const price = readPrice(block);

  if (!title || !price) {
    return undefined;
  }

  const asin = readAsin(block);
  const rating = block.match(/([\d,]+) de 5 estrelas/)?.[1];
  const reviews = block.match(/s-underline-text">\(?([\d.]+)\)?</)?.[1];

  return {
    productKey: asin ? `amazon:${asin}` : `amazon:${title.toLowerCase().slice(0, 60)}`,
    title: decodeEntities(title.trim()),
    store: STORE_NAME,
    price,
    listPrice: sanitizeListPrice(readListPrice(block), price),
    url: asin ? `https://www.amazon.com.br/dp/${asin}` : "https://www.amazon.com.br",
    imageUrl: block.match(/src="(https:\/\/m\.media-amazon\.com[^"]+)"/)?.[1],
    provider: STORE_NAME,
    rating: parseBrlNumber(rating),
    reviewCount: reviews ? Number(reviews.replace(/\./g, "")) : undefined
  };
};

export const amazonProvider: SearchProvider = {
  key: "amazon",
  name: STORE_NAME,
  kind: "store",
  // Sem cabecalhos CORS na busca; o leitor tambem nao devolve os cartoes completos.
  availableOnWeb: false,
  buildTasks: keywordTasks(STORE_NAME),
  search: async (query) => {
    if (!query) {
      return [];
    }

    const html = await fetchPageHtml(`https://www.amazon.com.br/s?k=${encodeURIComponent(query)}`, {
      allowProxy: false
    });

    return html
      .split(CARD_SPLIT)
      .filter((block) => block.includes(RESULT_MARKER))
      .map(toOffer)
      .filter((offer): offer is MarketOffer => Boolean(offer))
      .slice(0, MAX_RESULTS);
  }
};
