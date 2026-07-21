import { useEffect, useRef } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { openOffer } from "../services/openOffer";
import { Deal, ImportTaxEstimate } from "../types";
import { formatElapsed } from "./relativeTime";
import { currency, kindTheme, palette, useNative } from "./theme";

type Props = {
  deal: Deal;
  index: number;
  /** Substitui a etiqueta padrao, para telas com classificacao propria. */
  highlight?: { label: string; tint: string; soft: string };
};

/** Cartao da oferta, com entrada escalonada para o feed nao aparecer de uma vez. */
export function DealCard({ deal, index, highlight }: Props) {
  const enter = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const theme = highlight ?? kindTheme[deal.kind];
  const isCouponOnly = deal.price <= 0;
  // O mesmo tipo cobre codigo de cupom e cashback; o rotulo segue o que a oferta tem.
  const kindLabel = highlight
    ? highlight.label
    : deal.kind === "coupon" && !deal.coupon
      ? "Cashback"
      : theme.label;
  const age = describeAge(deal);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      delay: Math.min(index, 6) * 40,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useNative
    }).start();
  }, [enter, index]);

  const animatePress = (toValue: number) => {
    Animated.spring(press, { toValue, useNativeDriver: useNative, speed: 40, bounciness: 0 }).start();
  };

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          { scale: press }
        ]
      }}
    >
      <Pressable
        style={styles.card}
        onPress={() => openOffer(deal.url)}
        onPressIn={() => animatePress(0.98)}
        onPressOut={() => animatePress(1)}
      >
        <View style={styles.row}>
          {deal.imageUrl ? (
            <Image source={{ uri: deal.imageUrl }} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={[styles.imageFallback, { backgroundColor: theme.soft }]}>
              <Text style={[styles.imageFallbackText, { color: theme.tint }]}>{kindLabel}</Text>
            </View>
          )}

          <View style={styles.content}>
            <View style={styles.header}>
              <View style={[styles.kindPill, { backgroundColor: theme.soft }]}>
                <Text style={[styles.kindText, { color: theme.tint }]}>{kindLabel}</Text>
              </View>
              {deal.isNew ? (
                <View style={styles.newPill}>
                  <Text style={styles.newText}>NOVO</Text>
                </View>
              ) : null}
              <View style={styles.spacer} />
              <Text style={styles.score}>{deal.score}</Text>
            </View>

            <Text style={styles.title} numberOfLines={2}>
              {deal.title}
            </Text>
            <Text style={styles.store}>
              {deal.store} · via {deal.sourceName}
            </Text>

            {age ? <Text style={styles.age}>{age}</Text> : null}

            {isCouponOnly ? (
              // Cupom nao tem preco: o codigo e a informacao principal.
              <View style={styles.couponRow}>
                <View style={styles.couponCode}>
                  <Text style={styles.couponCodeText}>{deal.coupon}</Text>
                </View>
                {deal.couponLabel ? <Text style={styles.couponLabel}>{deal.couponLabel}</Text> : null}
              </View>
            ) : (
              <View style={styles.priceRow}>
                <Text style={styles.price}>{currency.format(deal.price)}</Text>

                {deal.discountPercent > 0 ? (
                  <View style={[styles.discountGroup, { backgroundColor: theme.soft }]}>
                    {/* O valor cheio fica junto do percentual: o desconto ganha referencia. */}
                    {deal.oldPrice ? (
                      <Text style={styles.oldPrice}>{currency.format(deal.oldPrice)}</Text>
                    ) : null}
                    <Text style={[styles.discount, { color: theme.tint }]}>
                      {/* Cashback volta pra voce depois; desconto ja sai do preco. Sinais opostos. */}
                      {deal.kind === "coupon" ? `+${deal.discountPercent}%` : `-${deal.discountPercent}%`}
                    </Text>
                  </View>
                ) : deal.oldPrice ? (
                  <Text style={styles.reference}>de {currency.format(deal.oldPrice)}</Text>
                ) : (
                  // Sem desconto apurado, o proprio valor exibido e o preco cheio.
                  <Text style={styles.reference}>preco cheio</Text>
                )}
              </View>
            )}

            <View style={styles.tagRow}>
              {deal.appOnly ? (
                // Vem primeiro: sem o app da loja, o preco ou o cupom nao valem.
                <View style={styles.appTag}>
                  <Text style={styles.appTagText}>SO NO APP</Text>
                </View>
              ) : null}

              {deal.coupon && !isCouponOnly ? (
                <View style={styles.inlineCoupon}>
                  <Text style={styles.inlineCouponText}>cupom {deal.coupon}</Text>
                </View>
              ) : null}

              {deal.imported ? (
                <View style={styles.importedTag}>
                  <Text style={styles.importedTagText}>IMPORTADO</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {deal.importTax ? <ImportTaxRow estimate={deal.importTax} /> : null}

        {deal.notes ? (
          <Text style={styles.notes} numberOfLines={2}>
            {deal.notes}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/**
 * Ha quanto tempo a oferta esta valendo. A data de publicacao da fonte descreve
 * a promocao em si; sem ela, o historico local diz desde quando o preco nao muda.
 */
const describeAge = (deal: Deal) => {
  const published = formatElapsed(deal.publishedAt);
  if (published) {
    return `promocao publicada ${published}`;
  }

  const since = formatElapsed(deal.priceSince);
  // Uma unica leitura recente nao caracteriza "esta neste preco ha algum tempo".
  return since && since !== "agora" ? `neste preco ${since}` : undefined;
};

/**
 * Custo final estimado do importado. A conta e uma estimativa: a aliquota de
 * ICMS varia por estado e o frete internacional tambem entra na base real.
 */
function ImportTaxRow({ estimate }: { estimate: ImportTaxEstimate }) {
  if (estimate.aboveSimplifiedLimit) {
    return (
      <View style={styles.taxBox}>
        <Text style={styles.taxBreakdown}>
          Acima de US$ 3.000: fora do regime simplificado, a tributacao segue outras regras.
        </Text>
      </View>
    );
  }

  const taxTotal = estimate.importDuty + estimate.icms;

  return (
    <View style={styles.taxBox}>
      <View style={styles.taxHeader}>
        <Text style={styles.taxTotal}>{currency.format(estimate.total)}</Text>
        <Text style={styles.taxTotalLabel}>com imposto</Text>
      </View>
      <Text style={styles.taxBreakdown}>
        + {currency.format(taxTotal)} de imposto
        {estimate.importDuty > 0
          ? ` (II ${currency.format(estimate.importDuty)} + ICMS ${currency.format(estimate.icms)})`
          : ` (ICMS ${estimate.icmsPercent}%, isento de II ate US$ 50)`}
      </Text>
      <Text style={styles.taxDisclaimer}>
        Estimativa · US$ {estimate.priceUsd.toFixed(2)}
        {estimate.liveRate ? "" : " · cambio de reserva"} · sem frete
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    backgroundColor: palette.surface,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.border
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  image: {
    width: 88,
    height: 88,
    borderRadius: 8,
    backgroundColor: palette.track
  },
  imageFallback: {
    width: 88,
    height: 88,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    padding: 6
  },
  imageFallbackText: {
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center"
  },
  content: {
    flex: 1,
    minWidth: 0
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  spacer: {
    flex: 1
  },
  kindPill: {
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  kindText: {
    fontSize: 10,
    fontWeight: "900"
  },
  newPill: {
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    backgroundColor: palette.ink
  },
  newText: {
    fontSize: 10,
    fontWeight: "900",
    color: palette.surface
  },
  score: {
    fontSize: 13,
    fontWeight: "900",
    color: palette.accentDeep,
    fontVariant: ["tabular-nums"]
  },
  title: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    color: palette.ink
  },
  store: {
    marginTop: 4,
    fontSize: 12,
    color: palette.inkSoft
  },
  age: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
    color: palette.muted
  },
  priceRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8
  },
  price: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F766E"
  },
  discountGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  oldPrice: {
    fontSize: 12,
    color: "#64748B",
    textDecorationLine: "line-through"
  },
  discount: {
    fontSize: 12,
    fontWeight: "900"
  },
  reference: {
    fontSize: 12,
    color: palette.muted
  },
  couponRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8
  },
  couponCode: {
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.coupon,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: palette.couponSoft
  },
  couponCodeText: {
    fontSize: 14,
    fontWeight: "900",
    color: palette.coupon,
    letterSpacing: 0.5
  },
  couponLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: palette.ink
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6
  },
  importedTag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: palette.warnSoft
  },
  importedTagText: {
    fontSize: 10,
    fontWeight: "900",
    color: palette.warn,
    letterSpacing: 0.3
  },
  appTag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: palette.infoSoft
  },
  appTagText: {
    fontSize: 10,
    fontWeight: "900",
    color: palette.info,
    letterSpacing: 0.3
  },
  taxBox: {
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: palette.warnSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2
  },
  taxHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6
  },
  taxTotal: {
    fontSize: 16,
    fontWeight: "900",
    color: "#92400E"
  },
  taxTotalLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.warn
  },
  taxBreakdown: {
    fontSize: 11,
    lineHeight: 15,
    color: "#78350F"
  },
  taxDisclaimer: {
    fontSize: 10,
    color: "#A16207",
    fontVariant: ["tabular-nums"]
  },
  inlineCoupon: {
    alignSelf: "flex-start",
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.coupon,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  inlineCouponText: {
    fontSize: 11,
    fontWeight: "900",
    color: palette.coupon
  },
  notes: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    color: "#526071"
  }
});
