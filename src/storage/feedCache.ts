import AsyncStorage from "@react-native-async-storage/async-storage";
import { subscribeToStorageKey } from "../platform/extension";
import { MAX_FEED_SIZE } from "../services/dealMonitor";
import { Deal } from "../types";

const FEED_KEY = "@promo-radar/feed";
/** Passado esse tempo a oferta guardada nao descreve mais o preco de agora. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type CachedFeed = {
  deals: Deal[];
  /** Quando a varredura que gerou este feed terminou (epoch ms). */
  savedAt: number;
  /** Ofertas que eram novas naquela varredura, usado pelo contador do icone. */
  newCount: number;
};

/**
 * Ultima varredura, para o app abrir mostrando o que ja foi encontrado em vez de
 * uma tela vazia. Na extensao esse e tambem o canal entre o service worker, que
 * varre em segundo plano, e o popup, que so exibe.
 */
export const saveFeed = async (deals: Deal[], newCount: number) => {
  const payload: CachedFeed = {
    // Guarda o feed inteiro, e nao um recorte: o que ficasse de fora voltaria a
    // ser tratado como oferta nova na proxima varredura e alertaria de novo.
    deals: deals.slice(0, MAX_FEED_SIZE),
    savedAt: Date.now(),
    newCount
  };

  try {
    await AsyncStorage.setItem(FEED_KEY, JSON.stringify(payload));
  } catch {
    // O feed e cache: falha ao gravar nao pode derrubar a varredura.
  }
};

export const loadFeed = async (): Promise<CachedFeed | undefined> => {
  try {
    const raw = await AsyncStorage.getItem(FEED_KEY);
    if (!raw) {
      return undefined;
    }

    const cached = JSON.parse(raw) as CachedFeed;

    if (!Array.isArray(cached.deals) || Date.now() - cached.savedAt > MAX_AGE_MS) {
      return undefined;
    }

    return cached;
  } catch {
    return undefined;
  }
};

export const clearFeed = async () => {
  try {
    await AsyncStorage.removeItem(FEED_KEY);
  } catch {
    // Idem: limpar o cache nunca e critico.
  }
};

/** Notifica o popup quando o service worker publica uma varredura nova. */
export const subscribeToFeed = (onChange: () => void) => subscribeToStorageKey(FEED_KEY, onChange);
