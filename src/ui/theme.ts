import { Platform } from "react-native";

/** RN Web nao roda animacoes na thread nativa; evita o aviso em tempo de execucao. */
export const useNative = Platform.OS !== "web";

export const palette = {
  background: "#F7FAF9",
  surface: "#FFFFFF",
  ink: "#0B1220",
  inkSoft: "#637083",
  border: "#E1E8F0",
  track: "#E8EEF2",
  accent: "#12B981",
  accentDeep: "#065F46",
  accentSoft: "#D1FAE5",
  warn: "#B45309",
  warnSoft: "#FEF3C7",
  info: "#1D4ED8",
  infoSoft: "#DBEAFE",
  coupon: "#BE185D",
  couponSoft: "#FCE7F3",
  muted: "#94A3B8"
};

export const kindTheme = {
  promo: { label: "Promocao", tint: palette.info, soft: palette.infoSoft },
  coupon: { label: "Cupom", tint: palette.coupon, soft: palette.couponSoft },
  bug: { label: "Preco suspeito", tint: palette.warn, soft: palette.warnSoft }
} as const;

export const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});
