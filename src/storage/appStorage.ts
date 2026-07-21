import AsyncStorage from "@react-native-async-storage/async-storage";
import { defaultSettings, defaultStorePreferences } from "../data/stores";
import { tiersFromLegacyMinimum } from "../services/discountTiers";
import { AlertSettings, StorePreference } from "../types";

const STORES_KEY = "@promo-radar/stores";
const SETTINGS_KEY = "@promo-radar/settings";

export const loadStores = async (): Promise<StorePreference[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORES_KEY);
    if (!raw) {
      return defaultStorePreferences;
    }

    return mergeWithCatalog(JSON.parse(raw) as StorePreference[]);
  } catch {
    return defaultStorePreferences;
  }
};

export const saveStores = async (stores: StorePreference[]) => {
  await AsyncStorage.setItem(STORES_KEY, JSON.stringify(stores));
};

/** Formato anterior, quando o desconto era um piso unico em vez de faixas. */
type LegacySettings = Partial<AlertSettings> & { minDiscountPercent?: number };

export const loadSettings = async (): Promise<AlertSettings> => {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return defaultSettings;
    }

    const stored = JSON.parse(raw) as LegacySettings;
    const { minDiscountPercent, ...settings } = stored;

    // Quem tinha piso unico salvo continua vendo o mesmo recorte, agora em faixas.
    const discountTiers =
      settings.discountTiers ??
      (typeof minDiscountPercent === "number" ? tiersFromLegacyMinimum(minDiscountPercent) : undefined);

    return { ...defaultSettings, ...settings, ...(discountTiers ? { discountTiers } : {}) };
  } catch {
    return defaultSettings;
  }
};

export const saveSettings = async (settings: AlertSettings) => {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

/** Preserva as escolhas do usuario e incorpora lojas novas do catalogo. */
const mergeWithCatalog = (stored: StorePreference[]) => {
  const storedById = new Map(stored.map((store) => [store.id, store]));

  return defaultStorePreferences.map((store) => ({
    ...store,
    enabled: storedById.get(store.id)?.enabled ?? store.enabled
  }));
};
