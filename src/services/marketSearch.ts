import { MarketOffer, ProviderResult, ScanProgress } from "../types";
import { describeError, isWeb } from "./httpClient";
import { amazonProvider } from "./providers/amazonStore";
import { kabumProvider } from "./providers/kabumStore";
import { aggregatorProviders } from "./providers/priceAggregator";
import { promobitProvider } from "./providers/promobit";
import { SearchProvider } from "./providers/types";

const MAX_QUERIES_PER_SCAN = 4;
const CONCURRENCY = 4;

export type MarketSearchResult = {
  offers: MarketOffer[];
  providers: ProviderResult[];
};

/**
 * Agregadores cobrem as lojas que bloqueiam acesso direto; as lojas diretas
 * trazem preco de primeira mao com o valor cheio anunciado; a curadoria traz
 * promocao, cupom e erro de preco garimpados pela comunidade.
 */
const allProviders: SearchProvider[] = [
  ...aggregatorProviders,
  amazonProvider,
  kabumProvider,
  promobitProvider
];

export const allProviderCount = allProviders.length;

export const activeProviders = () => allProviders.filter((provider) => !isWeb || provider.availableOnWeb);

type SearchTask = {
  provider: SearchProvider;
  query: string;
  label: string;
};

const buildTasks = (keywords: string[]): SearchTask[] => {
  const queries = keywords.map((keyword) => keyword.trim()).filter(Boolean).slice(0, MAX_QUERIES_PER_SCAN);

  return activeProviders().flatMap((provider) =>
    provider.buildTasks(queries).map((task) => ({ provider, ...task }))
  );
};

/**
 * Mantem uma oferta por produto, preferindo a de menor preco. Ofertas da propria
 * loja e do agregador convivem: o dedup por chave de produto nao as mistura,
 * entao o mesmo item pode aparecer com o preco de cada fonte.
 */
const dedupeOffers = (offers: MarketOffer[]) => {
  const byProduct = new Map<string, MarketOffer>();

  offers.forEach((offer) => {
    const current = byProduct.get(offer.productKey);
    if (!current || offer.price < current.price) {
      byProduct.set(offer.productKey, offer);
    }
  });

  return [...byProduct.values()];
};

export const searchMarket = async (
  keywords: string[],
  onProgress?: (progress: ScanProgress) => void
): Promise<MarketSearchResult> => {
  const tasks = buildTasks(keywords);
  const providers: ProviderResult[] = [];
  const collected: MarketOffer[] = [];
  let completed = 0;
  let cursor = 0;

  onProgress?.({ current: 0, total: tasks.length, label: "Preparando varredura" });

  const runNext = async (): Promise<void> => {
    const taskIndex = cursor;
    cursor += 1;

    const task = tasks[taskIndex];
    if (!task) {
      return;
    }

    const startedAt = Date.now();
    onProgress?.({ current: completed, total: tasks.length, label: task.label });

    try {
      const offers = await task.provider.search(task.query);
      collected.push(...offers);
      providers.push({
        provider: task.provider.name,
        query: task.query,
        status: offers.length > 0 ? "ok" : "empty",
        offers: offers.length,
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      providers.push({
        provider: task.provider.name,
        query: task.query,
        status: "failed",
        offers: 0,
        durationMs: Date.now() - startedAt,
        error: describeError(error)
      });
    } finally {
      completed += 1;
      onProgress?.({ current: completed, total: tasks.length, label: task.label });
    }

    await runNext();
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => runNext()));

  return { offers: dedupeOffers(collected), providers };
};
