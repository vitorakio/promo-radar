import AsyncStorage from "@react-native-async-storage/async-storage";
import { MarketOffer } from "../types";

const HISTORY_KEY = "@promo-radar/price-history";
const MAX_SAMPLES_PER_PRODUCT = 24;
const MAX_TRACKED_PRODUCTS = 900;

type PriceSample = {
  /** Preco observado. */
  p: number;
  /** Momento da observacao (epoch ms). */
  t: number;
};

type HistoryEntry = {
  samples: PriceSample[];
  updatedAt: number;
};

type HistoryMap = Record<string, HistoryEntry>;

export type PriceBaseline = {
  /** Preco de referencia usado para calcular o desconto. */
  reference: number;
  /** Menor preco ja observado localmente. */
  lowest: number;
  sampleCount: number;
  /** Desde quando o produto esta neste mesmo preco (epoch ms). */
  currentPriceSince?: number;
};

/**
 * Momento da leitura mais antiga da sequencia atual no mesmo preco. Voltamos do
 * fim ate o preco mudar: e ali que a oferta corrente comecou.
 */
const findCurrentPriceSince = (samples: PriceSample[], price: number) => {
  let since: number | undefined;

  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const sample = samples[index];
    if (!sample || sample.p !== price) {
      break;
    }

    since = sample.t;
  }

  return since;
};

let cache: HistoryMap | undefined;

const readHistory = async (): Promise<HistoryMap> => {
  if (cache) {
    return cache;
  }

  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    cache = raw ? (JSON.parse(raw) as HistoryMap) : {};
  } catch {
    cache = {};
  }

  return cache;
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;

  return sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? upper) + upper) / 2 : upper;
};

/**
 * Baseline do produto a partir das varreduras anteriores. Usamos a mediana e
 * nao a media para que um unico preco fora da curva nao contamine a referencia.
 */
export const getBaseline = async (productKey: string): Promise<PriceBaseline | undefined> => {
  const history = await readHistory();
  const entry = history[productKey];

  if (!entry || entry.samples.length === 0) {
    return undefined;
  }

  const prices = entry.samples.map((sample) => sample.p);

  return {
    reference: median(prices),
    lowest: Math.min(...prices),
    sampleCount: prices.length
  };
};

/** Baselines das ofertas da varredura, indexados por produto. */
export const getBaselines = async (offers: { productKey: string; price: number }[]) => {
  const history = await readHistory();
  const baselines = new Map<string, PriceBaseline>();

  offers.forEach(({ productKey, price }) => {
    const entry = history[productKey];
    if (!entry || entry.samples.length === 0) {
      return;
    }

    const prices = entry.samples.map((sample) => sample.p);
    baselines.set(productKey, {
      reference: median(prices),
      lowest: Math.min(...prices),
      sampleCount: prices.length,
      currentPriceSince: findCurrentPriceSince(entry.samples, price)
    });
  });

  return baselines;
};

/** Guarda os precos desta varredura para servir de referencia nas proximas. */
export const recordOffers = async (offers: MarketOffer[]) => {
  if (offers.length === 0) {
    return;
  }

  const history = await readHistory();
  const now = Date.now();

  offers.forEach((offer) => {
    const entry = history[offer.productKey] ?? { samples: [], updatedAt: now };
    const lastSample = entry.samples[entry.samples.length - 1];

    // Sem mudanca de preco basta atualizar o carimbo de tempo.
    if (lastSample && lastSample.p === offer.price) {
      entry.updatedAt = now;
    } else {
      entry.samples = [...entry.samples, { p: offer.price, t: now }].slice(-MAX_SAMPLES_PER_PRODUCT);
      entry.updatedAt = now;
    }

    history[offer.productKey] = entry;
  });

  const trackedKeys = Object.keys(history);
  if (trackedKeys.length > MAX_TRACKED_PRODUCTS) {
    const survivors = trackedKeys
      .sort((a, b) => (history[b]?.updatedAt ?? 0) - (history[a]?.updatedAt ?? 0))
      .slice(0, MAX_TRACKED_PRODUCTS);

    const pruned: HistoryMap = {};
    survivors.forEach((key) => {
      const entry = history[key];
      if (entry) {
        pruned[key] = entry;
      }
    });
    cache = pruned;
  } else {
    cache = history;
  }

  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(cache));
  } catch {
    // Historico e um cache: falha ao gravar nao pode derrubar a varredura.
  }
};

export const countTrackedProducts = async () => Object.keys(await readHistory()).length;

export const clearPriceHistory = async () => {
  cache = {};
  await AsyncStorage.removeItem(HISTORY_KEY);
};
