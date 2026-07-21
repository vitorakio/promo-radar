import AsyncStorage from "@react-native-async-storage/async-storage";

const RATE_KEY = "@promo-radar/usd-rate";
const RATE_URL = "https://economia.awesomeapi.com.br/last/USD-BRL";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Usado apenas se a cotacao nunca pode ser lida. A estimativa de imposto avisa
 * quando cai neste valor, para nao passar por numero apurado.
 */
const FALLBACK_RATE = 5.4;

export type UsdRate = {
  brlPerUsd: number;
  fetchedAt: number;
  /** False quando a cotacao veio do valor de reserva, e nao da fonte. */
  live: boolean;
};

let cache: UsdRate | undefined;

const readCached = async (): Promise<UsdRate | undefined> => {
  if (cache) {
    return cache;
  }

  try {
    const raw = await AsyncStorage.getItem(RATE_KEY);
    cache = raw ? (JSON.parse(raw) as UsdRate) : undefined;
  } catch {
    cache = undefined;
  }

  return cache;
};

const fetchRate = async (): Promise<number | undefined> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(RATE_URL, { signal: controller.signal });
    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as { USDBRL?: { bid?: string } };
    const parsed = Number(payload.USDBRL?.bid);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Cotacao do dolar para enquadrar o produto nas faixas da Receita, que sao
 * definidas em dolares. Cacheada por 12h: a faixa nao muda com oscilacao diaria.
 */
export const getUsdRate = async (): Promise<UsdRate> => {
  const cached = await readCached();

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  const brlPerUsd = await fetchRate();

  if (!brlPerUsd) {
    // Cotacao vencida ainda descreve melhor o cambio do que o valor de reserva.
    return cached ?? { brlPerUsd: FALLBACK_RATE, fetchedAt: Date.now(), live: false };
  }

  const rate: UsdRate = { brlPerUsd, fetchedAt: Date.now(), live: true };
  cache = rate;

  try {
    await AsyncStorage.setItem(RATE_KEY, JSON.stringify(rate));
  } catch {
    // Cache de cotacao e conveniencia: falha ao gravar nao interrompe a varredura.
  }

  return rate;
};
