import { ImportTaxEstimate, MarketOffer } from "../types";
import { normalizeStoreName } from "../data/stores";

/**
 * Regime de tributacao simplificada (Remessa Conforme), conforme a Receita
 * Federal em 19/05/2026:
 *   - ate US$ 50: Imposto de Importacao zero
 *   - de US$ 50,01 a US$ 3.000: 60% com desconto fixo de US$ 30
 *   - ICMS de 17% a 20% conforme o estado, calculado "por dentro"
 * A MP 1.357/2026 autoriza reduzir a faixa superior para 30%, mas isso depende
 * de ato do Ministro da Fazenda que ainda nao foi editado.
 * https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/manuais/remessas-postal-e-expressa/preciso-pagar-impostos-nas-compras-internacionais/quanto-pagarei-de-imposto
 */
const FREE_TIER_USD = 50;
const SIMPLIFIED_LIMIT_USD = 3000;
const IMPORT_DUTY_RATE = 0.6;
const IMPORT_DUTY_DISCOUNT_USD = 30;

/** Lojas cujo envio sai do exterior por padrao. */
const INTERNATIONAL_STORES = [
  "aliexpress",
  "shein",
  "temu",
  "wish",
  "banggood",
  "alibaba",
  "gearbest",
  "lightinthebox",
  "shopltk"
];

/** Marcadores de origem estrangeira no titulo do anuncio. */
const IMPORTED_TITLE_PATTERN =
  /\b(importad[oa]s?|internacional|envio\s+do\s+exterior|direto\s+da\s+china|cross\s*border)\b/i;


export const isImportedOffer = (offer: MarketOffer) => {
  if (INTERNATIONAL_STORES.includes(normalizeStoreName(offer.store))) {
    return true;
  }

  return IMPORTED_TITLE_PATTERN.test(offer.title);
};

/**
 * Estima o custo final de um produto importado. O ICMS incide sobre o produto
 * somado ao imposto de importacao e integra a propria base, entao o total sai
 * de (valor + II) / (1 - aliquota).
 */
export const estimateImportTax = (
  priceBrl: number,
  brlPerUsd: number,
  icmsPercent: number,
  liveRate: boolean
): ImportTaxEstimate | undefined => {
  if (priceBrl <= 0 || brlPerUsd <= 0) {
    return undefined;
  }

  const icmsRate = icmsPercent / 100;
  const priceUsd = priceBrl / brlPerUsd;

  const importDuty =
    priceUsd <= FREE_TIER_USD
      ? 0
      : Math.max(0, priceBrl * IMPORT_DUTY_RATE - IMPORT_DUTY_DISCOUNT_USD * brlPerUsd);

  const total = (priceBrl + importDuty) / (1 - icmsRate);
  const icms = total - priceBrl - importDuty;

  return {
    importDuty: round(importDuty),
    icms: round(icms),
    total: round(total),
    priceUsd: round(priceUsd),
    icmsPercent,
    aboveSimplifiedLimit: priceUsd > SIMPLIFIED_LIMIT_USD,
    liveRate
  };
};

const round = (value: number) => Math.round(value * 100) / 100;
