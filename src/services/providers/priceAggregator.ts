import { MarketOffer } from "../../types";
import { fetchPageHtml } from "../httpClient";
import { decodeEntities, readNextData, SearchProvider, SearchTaskSpec } from "./types";

/**
 * Buscape e Zoom sao do mesmo grupo e publicam o resultado da busca em um JSON
 * embutido na pagina. Cada item ja vem com a loja que oferece o melhor preco,
 * o que da cobertura das lojas que bloqueiam acesso direto (Magalu, Casas Bahia,
 * Ponto, Extra, Fast Shop) sem precisar de um parser por loja.
 */
type AggregatorSite = {
  key: string;
  name: string;
  buildSearchUrl: (query: string) => string;
  dealsUrl: string;
};

const sites: AggregatorSite[] = [
  {
    key: "buscape",
    name: "Buscape",
    buildSearchUrl: (query) => `https://www.buscape.com.br/search?q=${encodeURIComponent(query)}`,
    dealsUrl: "https://www.buscape.com.br/ofertas"
  },
  {
    key: "zoom",
    name: "Zoom",
    buildSearchUrl: (query) => `https://www.zoom.com.br/search?q=${encodeURIComponent(query)}`,
    dealsUrl: "https://www.zoom.com.br/ofertas"
  }
];

type AggregatorHit = {
  objectId?: string;
  sourceId?: string;
  name?: string;
  shortName?: string;
  price?: number;
  image?: string;
  url?: string;
  categoryName?: string;
  storeCount?: number;
  rating?: number;
  countOfComments?: number;
  competitivenessIndex?: number;
  loweringPercentage?: number;
  bestOffer?: { merchantName?: string };
  cashback?: { cashbackValue?: number | null; formula?: { cashbackRate?: number } | null };
};

const readHits = (payload: unknown): AggregatorHit[] => {
  const hits = (payload as any)?.props?.initialReduxState?.hits?.hits;
  return Array.isArray(hits) ? (hits as AggregatorHit[]) : [];
};

const toOffer = (hit: AggregatorHit, site: AggregatorSite, baseUrl: string): MarketOffer | undefined => {
  const title = decodeEntities((hit.name ?? hit.shortName ?? "").trim());
  const price = typeof hit.price === "number" ? hit.price : 0;
  const store = hit.bestOffer?.merchantName?.trim();

  if (!title || price <= 0 || !store) {
    return undefined;
  }

  return {
    productKey: hit.objectId ?? hit.sourceId ?? `${site.key}:${title.toLowerCase()}`,
    title,
    store,
    price,
    url: hit.url ? new URL(hit.url, baseUrl).toString() : baseUrl,
    imageUrl: hit.image,
    provider: site.name,
    category: hit.categoryName,
    storeCount: hit.storeCount,
    rating: hit.rating,
    reviewCount: hit.countOfComments,
    competitiveness: hit.competitivenessIndex,
    loweringPercent: hit.loweringPercentage,
    cashbackValue: hit.cashback?.cashbackValue ?? undefined,
    cashbackRate: hit.cashback?.formula?.cashbackRate ?? undefined
  };
};

const toProvider = (site: AggregatorSite): SearchProvider => ({
  key: site.key,
  name: site.name,
  kind: "aggregator",
  availableOnWeb: true,
  buildTasks: (keywords): SearchTaskSpec[] =>
    keywords.length > 0
      ? keywords.map((keyword) => ({ query: keyword, label: `${site.name}: ${keyword}` }))
      : [{ query: "", label: `${site.name}: ofertas do dia` }],
  search: async (query) => {
    const url = query ? site.buildSearchUrl(query) : site.dealsUrl;
    const html = await fetchPageHtml(url);

    return readHits(readNextData(html))
      .map((hit) => toOffer(hit, site, url))
      .filter((offer): offer is MarketOffer => Boolean(offer));
  }
});

export const aggregatorProviders: SearchProvider[] = sites.map(toProvider);
