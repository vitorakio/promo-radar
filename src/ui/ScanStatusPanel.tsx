import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { ScanOutcome, ScanProgress } from "../types";
import { palette, useNative } from "./theme";

type Props = {
  isScanning: boolean;
  progress?: ScanProgress;
  outcome?: ScanOutcome;
  onDismiss: () => void;
};

/**
 * Concentra o retorno visual da varredura: barra de progresso com a fonte que
 * esta sendo consultada e, ao final, um resumo do que foi encontrado.
 */
export function ScanStatusPanel({ isScanning, progress, outcome, onDismiss }: Props) {
  const enter = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  const visible = isScanning || Boolean(outcome);
  const ratio = progress && progress.total > 0 ? progress.current / progress.total : 0;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: visible ? 1 : 0,
      duration: visible ? 260 : 180,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: useNative
    }).start();
  }, [enter, visible]);

  useEffect(() => {
    // scaleX no lugar de width para a barra rodar na thread nativa.
    Animated.timing(fill, {
      toValue: isScanning ? Math.max(ratio, 0.04) : 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useNative
    }).start();
  }, [fill, isScanning, ratio]);

  useEffect(() => {
    if (!isScanning) {
      shimmer.stopAnimation();
      shimmer.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: useNative }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: useNative })
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [isScanning, shimmer]);

  if (!visible) {
    return null;
  }

  const animatedStyle = {
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] })
      }
    ]
  };

  if (isScanning) {
    return (
      <Animated.View style={[styles.panel, styles.panelScanning, animatedStyle]}>
        <View style={styles.headerRow}>
          <Animated.View
            style={[
              styles.pulseDot,
              { opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }
            ]}
          />
          <Text style={styles.title}>Analisando o mercado</Text>
          <Text style={styles.counter}>
            {progress ? `${progress.current}/${progress.total}` : ""}
          </Text>
        </View>

        <Text style={styles.stageText} numberOfLines={1}>
          {progress?.label ?? "Conectando as fontes"}
        </Text>

        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { transform: [{ scaleX: fill }] }]} />
        </View>
      </Animated.View>
    );
  }

  if (!outcome) {
    return null;
  }

  const firstFailure = outcome.providers.find((provider) => provider.status === "failed");
  const tone = outcome.usedFallback ? styles.panelWarn : styles.panelDone;

  return (
    <Animated.View style={[styles.panel, tone, animatedStyle]}>
      <View style={styles.headerRow}>
        <View style={[styles.badge, outcome.usedFallback ? styles.badgeWarn : styles.badgeOk]}>
          <Text style={styles.badgeText}>{outcome.usedFallback ? "DEMO" : "OK"}</Text>
        </View>
        <Text style={styles.title}>
          {outcome.usedFallback
            ? "Nenhuma fonte respondeu"
            : `${outcome.deals.length} ${outcome.deals.length === 1 ? "oferta" : "ofertas"} no radar`}
        </Text>
        <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="Fechar resumo">
          <Text style={styles.dismiss}>Fechar</Text>
        </Pressable>
      </View>

      <Text style={styles.summaryText}>
        {outcome.usedFallback
          ? "Mostrando um catalogo de demonstracao. Confira a conexao e rode de novo."
          : `${outcome.newCount} ${outcome.newCount === 1 ? "nova" : "novas"} · ${outcome.collected} produtos lidos · ${(
              outcome.durationMs / 1000
            ).toFixed(1)}s`}
      </Text>

      <View style={styles.chipRow}>
        {outcome.providers.map((provider, index) => (
          <View
            key={`${provider.provider}-${provider.query}-${index}`}
            style={[
              styles.chip,
              provider.status === "ok" && styles.chipOk,
              provider.status === "failed" && styles.chipFailed
            ]}
          >
            <Text style={styles.chipText} numberOfLines={1}>
              {provider.provider}
              {provider.query ? ` · ${provider.query}` : ""}
              {provider.status === "ok" ? ` · ${provider.offers}` : ""}
              {provider.status === "empty" ? " · vazio" : ""}
              {provider.status === "failed" ? " · falhou" : ""}
            </Text>
          </View>
        ))}
      </View>

      {firstFailure ? (
        <Text style={styles.errorText} numberOfLines={2}>
          {firstFailure.provider}: {firstFailure.error}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    gap: 8
  },
  panelScanning: {
    backgroundColor: palette.surface,
    borderColor: palette.border
  },
  panelDone: {
    backgroundColor: palette.accentSoft,
    borderColor: "#6EE7B7"
  },
  panelWarn: {
    backgroundColor: palette.warnSoft,
    borderColor: "#FCD34D"
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.accent
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
    color: palette.ink
  },
  counter: {
    fontSize: 12,
    fontWeight: "800",
    color: palette.inkSoft,
    fontVariant: ["tabular-nums"]
  },
  dismiss: {
    fontSize: 12,
    fontWeight: "800",
    color: palette.inkSoft
  },
  stageText: {
    fontSize: 13,
    color: palette.inkSoft
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.track,
    overflow: "hidden"
  },
  barFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.accent,
    // Ocupa a largura toda e o scaleX ancorado a esquerda revela o progresso.
    width: "100%",
    alignSelf: "flex-start",
    transformOrigin: "left"
  },
  badge: {
    minWidth: 44,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  badgeOk: {
    backgroundColor: palette.accent
  },
  badgeWarn: {
    backgroundColor: palette.warn
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: palette.surface
  },
  summaryText: {
    fontSize: 13,
    color: "#334155"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  chip: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.7)"
  },
  chipOk: {
    backgroundColor: "rgba(255,255,255,0.9)"
  },
  chipFailed: {
    backgroundColor: "rgba(185,28,28,0.12)"
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155"
  },
  errorText: {
    fontSize: 11,
    color: "#9F1239"
  }
});
