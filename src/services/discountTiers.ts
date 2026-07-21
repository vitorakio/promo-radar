/**
 * Faixas de desconto oferecidas como filtro. Cada valor abre uma faixa que vai
 * ate o proximo: marcar 50 e 80 mostra 50-59% e 80%+, escondendo o miolo.
 * Nenhuma faixa marcada significa "qualquer desconto".
 */
export const DISCOUNT_TIERS = [15, 25, 35, 50, 60, 70, 80, 90];

const tierRange = (tier: number) => {
  const index = DISCOUNT_TIERS.indexOf(tier);
  const next = index >= 0 ? DISCOUNT_TIERS[index + 1] : undefined;

  return { min: tier, max: next ?? Number.POSITIVE_INFINITY };
};

/** Rotulo da faixa: "50-59%" para as intermediarias, "90%+" para a ultima. */
export const tierLabel = (tier: number) => {
  const { max } = tierRange(tier);

  return max === Number.POSITIVE_INFINITY ? `${tier}%+` : `${tier}-${max - 1}%`;
};

export const matchesDiscountTiers = (discountPercent: number, tiers: number[]) => {
  if (tiers.length === 0) {
    return true;
  }

  return tiers.some((tier) => {
    const { min, max } = tierRange(tier);
    return discountPercent >= min && discountPercent < max;
  });
};

/** Liga ou desliga uma faixa, mantendo a lista ordenada. */
export const toggleDiscountTier = (tiers: number[], tier: number) =>
  tiers.includes(tier)
    ? tiers.filter((item) => item !== tier)
    : [...tiers, tier].sort((a, b) => a - b);

/**
 * Converte a preferencia antiga de piso unico nas faixas equivalentes, para que
 * quem ja usava o app continue vendo o mesmo recorte.
 */
export const tiersFromLegacyMinimum = (minDiscountPercent: number) =>
  DISCOUNT_TIERS.filter((tier) => tier >= minDiscountPercent);
