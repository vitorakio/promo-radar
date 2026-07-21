import { AlertSettings, StorePreference } from "../types";

/**
 * Catalogo dos e-commerces nacionais mais populares. Ele nao define onde
 * buscamos: a varredura sempre cobre o mercado inteiro pelos agregadores.
 * Serve para filtrar de quais lojas voce quer receber alerta.
 */
type StoreCatalogEntry = {
  id: string;
  name: string;
  /** Como a loja pode aparecer no nome do vendedor devolvido pelo agregador. */
  aliases: string[];
  enabledByDefault: boolean;
};

export const storeCatalog: StoreCatalogEntry[] = [
  { id: "amazon", name: "Amazon", aliases: ["amazon", "amazonbr", "amazonbrasil"], enabledByDefault: true },
  { id: "mercado-livre", name: "Mercado Livre", aliases: ["mercadolivre", "mercadolibre"], enabledByDefault: true },
  { id: "magalu", name: "Magazine Luiza", aliases: ["magazineluiza", "magalu", "magazinevoce"], enabledByDefault: true },
  { id: "casas-bahia", name: "Casas Bahia", aliases: ["casasbahia"], enabledByDefault: true },
  { id: "ponto", name: "Ponto", aliases: ["ponto", "pontofrio"], enabledByDefault: true },
  { id: "extra", name: "Extra", aliases: ["extra", "extracom"], enabledByDefault: true },
  { id: "americanas", name: "Americanas", aliases: ["americanas", "lojasamericanas"], enabledByDefault: true },
  { id: "submarino", name: "Submarino", aliases: ["submarino"], enabledByDefault: true },
  { id: "shoptime", name: "Shoptime", aliases: ["shoptime"], enabledByDefault: true },
  { id: "carrefour", name: "Carrefour", aliases: ["carrefour"], enabledByDefault: true },
  { id: "shopee", name: "Shopee", aliases: ["shopee"], enabledByDefault: true },
  { id: "aliexpress", name: "AliExpress", aliases: ["aliexpress"], enabledByDefault: false },
  { id: "kabum", name: "KaBuM!", aliases: ["kabum"], enabledByDefault: true },
  { id: "pichau", name: "Pichau", aliases: ["pichau", "pichauinformatica"], enabledByDefault: true },
  { id: "terabyte", name: "TerabyteShop", aliases: ["terabyteshop", "terabyte"], enabledByDefault: true },
  { id: "fast-shop", name: "Fast Shop", aliases: ["fastshop"], enabledByDefault: true },
  { id: "netshoes", name: "Netshoes", aliases: ["netshoes"], enabledByDefault: true },
  { id: "centauro", name: "Centauro", aliases: ["centauro"], enabledByDefault: true },
  { id: "kalunga", name: "Kalunga", aliases: ["kalunga"], enabledByDefault: true },
  { id: "leroy-merlin", name: "Leroy Merlin", aliases: ["leroymerlin"], enabledByDefault: true },
  { id: "madeira-madeira", name: "MadeiraMadeira", aliases: ["madeiramadeira"], enabledByDefault: true },
  { id: "webcontinental", name: "Webcontinental", aliases: ["webcontinental"], enabledByDefault: true },
  { id: "girafa", name: "Girafa", aliases: ["girafa"], enabledByDefault: true },
  { id: "havan", name: "Havan", aliases: ["havan"], enabledByDefault: true }
];

export const normalizeStoreName = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const aliasToStoreId = new Map<string, string>();
storeCatalog.forEach((store) => {
  aliasToStoreId.set(normalizeStoreName(store.name), store.id);
  store.aliases.forEach((alias) => aliasToStoreId.set(normalizeStoreName(alias), store.id));
});

/** Resolve o vendedor devolvido pelo agregador para uma loja do catalogo. */
export const resolveStoreId = (merchantName: string): string | undefined =>
  aliasToStoreId.get(normalizeStoreName(merchantName));

export const defaultStorePreferences: StorePreference[] = storeCatalog.map((store) => ({
  id: store.id,
  name: store.name,
  enabled: store.enabledByDefault
}));

export const defaultSettings: AlertSettings = {
  discountTiers: [],
  notifyCoupons: true,
  notifyBuggedAds: true,
  autoScanEnabled: false,
  autoScanIntervalMinutes: 15,
  keywords: ["ssd", "notebook", "smart tv"],
  blockedTerms: ["usado", "recondicionado"],
  includeUnlistedStores: true,
  // Menor aliquota estadual; ajustavel na tela de alertas.
  icmsPercent: 17
};
