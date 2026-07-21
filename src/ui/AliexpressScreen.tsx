import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { AliexpressScanResult, scanAliexpress, WatchedDeal } from "../services/aliexpressRadar";
import { AnomalyLevel, anomalyLabel } from "../services/anomalyDetector";
import { isCriticalDeal, notifyCriticalDeal, setupNotifications } from "../services/notificationService";
import { AlertSettings, ScanProgress } from "../types";
import { DealCard } from "./DealCard";
import { ScanStatusPanel } from "./ScanStatusPanel";
import { palette } from "./theme";

/** Cores por nivel: o vermelho fica reservado ao provavel erro de preco. */
const levelTheme: Record<AnomalyLevel, { label: string; tint: string; soft: string }> = {
  "price-error": { label: anomalyLabel["price-error"], tint: "#B91C1C", soft: "#FEE2E2" },
  "far-below": { label: anomalyLabel["far-below"], tint: palette.warn, soft: palette.warnSoft },
  below: { label: anomalyLabel.below, tint: palette.info, soft: palette.infoSoft },
  normal: { label: anomalyLabel.normal, tint: palette.inkSoft, soft: palette.track }
};

const FILTERS: { value: AnomalyLevel | "flagged"; label: string }[] = [
  { value: "flagged", label: "Sinalizados" },
  { value: "price-error", label: "Provavel erro" },
  { value: "far-below", label: "Muito abaixo" },
  { value: "below", label: "Abaixo" },
  { value: "normal", label: "Normal" }
];

const MAX_CRITICAL_ALERTS = 5;

type Props = {
  settings: AlertSettings;
};

/**
 * Vigilancia dedicada ao AliExpress. Aqui nenhuma oferta e descartada por faixa
 * de desconto: o radar acompanha o preco de tudo e destaca o que saiu do padrao.
 */
export function AliexpressScreen({ settings }: Props) {
  const [deals, setDeals] = useState<WatchedDeal[]>([]);
  const [result, setResult] = useState<AliexpressScanResult>();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress>();
  const [filter, setFilter] = useState<AnomalyLevel | "flagged">("flagged");
  const scanningRef = useRef(false);

  const counts = useMemo(() => {
    const byLevel = { "price-error": 0, "far-below": 0, below: 0, normal: 0 } as Record<AnomalyLevel, number>;
    deals.forEach((deal) => {
      byLevel[deal.anomaly.level] += 1;
    });

    return {
      ...byLevel,
      flagged: byLevel["price-error"] + byLevel["far-below"] + byLevel.below
    };
  }, [deals]);

  const visible = useMemo(
    () =>
      filter === "flagged"
        ? deals.filter((deal) => deal.anomaly.level !== "normal")
        : deals.filter((deal) => deal.anomaly.level === filter),
    [deals, filter]
  );

  const runScan = useCallback(async () => {
    if (scanningRef.current) {
      return;
    }

    scanningRef.current = true;
    setIsScanning(true);
    setResult(undefined);
    setProgress({ current: 0, total: 2, label: "Consultando AliExpress" });

    try {
      const known = new Set(deals.map((deal) => deal.productKey));
      const scan = await scanAliexpress(settings, known, setProgress);

      setDeals(scan.deals);
      setResult(scan);

      // Erro de preco no AliExpress dura pouco: avisa assim que aparece.
      const critical = scan.deals.filter((deal) => deal.isNew && isCriticalDeal(deal));
      if (critical.length > 0 && (await setupNotifications())) {
        for (const deal of critical.slice(0, MAX_CRITICAL_ALERTS)) {
          await notifyCriticalDeal(deal);
        }
      }
    } catch (error) {
      Alert.alert("Falha na varredura", error instanceof Error ? error.message : "Erro desconhecido");
    } finally {
      scanningRef.current = false;
      setIsScanning(false);
      setProgress(undefined);
    }
  }, [deals, settings]);

  // Primeira carga automatica: a tela so faz sentido com dados na frente.
  useEffect(() => {
    runScan();
    // Rodar apenas na montagem; varreduras seguintes saem do botao.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.intro}>
        <Text style={styles.introText}>
          O AliExpress bloqueia leitura automatizada, entao acompanhamos as ofertas garimpadas pela
          comunidade. Cada preco entra no historico e volta comparado com ele mesmo.
        </Text>
        <Text style={styles.introSession}>
          Ao abrir uma oferta voce cai na sua sessao do navegador, ja logado na sua conta. O app nao
          guarda login nem senha, e os precos listados aqui sao os publicos, sem os descontos que so
          aparecem dentro da conta.
        </Text>
      </View>

      <ScanStatusPanel
        isScanning={isScanning}
        progress={progress}
        outcome={undefined}
        onDismiss={() => setResult(undefined)}
      />

      {result && !isScanning ? (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>
            {counts.flagged} {counts.flagged === 1 ? "sinalizado" : "sinalizados"} de {result.collected}{" "}
            lidos
          </Text>
          <Text style={styles.summaryText}>
            {counts["price-error"]} provavel erro · {counts["far-below"]} muito abaixo · {counts.below}{" "}
            abaixo · {(result.durationMs / 1000).toFixed(1)}s
          </Text>
          {result.errors.map((error) => (
            <Text key={error} style={styles.summaryError} numberOfLines={2}>
              {error}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.filterRow}>
        {FILTERS.map((option) => {
          const active = option.value === filter;
          const count = option.value === "flagged" ? counts.flagged : counts[option.value];

          return (
            <Pressable
              key={option.value}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(option.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{option.label}</Text>
              <Text style={[styles.filterCount, active && styles.filterCountActive]}>{count}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <DealCard deal={item} index={index} highlight={levelTheme[item.anomaly.level]} />
        )}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            {isScanning ? (
              <ActivityIndicator color={palette.accent} />
            ) : (
              <>
                <Text style={styles.emptyTitle}>
                  {deals.length === 0 ? "Sem leitura ainda" : "Nada neste nivel"}
                </Text>
                <Text style={styles.emptyText}>
                  {deals.length === 0
                    ? "Toque em analisar para montar a base de precos."
                    : "A queda so aparece depois de algumas leituras do mesmo produto."}
                </Text>
              </>
            )}
          </View>
        }
      />

      <Pressable
        style={[styles.scanButton, isScanning && styles.scanButtonBusy]}
        onPress={runScan}
        disabled={isScanning}
      >
        {isScanning ? (
          <ActivityIndicator color={palette.surface} size="small" />
        ) : (
          <Text style={styles.scanButtonText}>Rastrear precos do AliExpress</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  intro: {
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: palette.track,
    padding: 12
  },
  introText: {
    fontSize: 12,
    lineHeight: 17,
    color: palette.inkSoft
  },
  introSession: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 16,
    color: palette.muted
  },
  summary: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: "#6EE7B7",
    padding: 12,
    gap: 3
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: palette.ink
  },
  summaryText: {
    fontSize: 12,
    color: "#334155"
  },
  summaryError: {
    fontSize: 11,
    color: "#9F1239"
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 10
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface
  },
  filterChipActive: {
    backgroundColor: palette.ink,
    borderColor: palette.ink
  },
  filterText: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.inkSoft
  },
  filterTextActive: {
    color: palette.surface
  },
  filterCount: {
    fontSize: 11,
    fontWeight: "900",
    color: palette.muted,
    fontVariant: ["tabular-nums"]
  },
  filterCountActive: {
    color: "#93C5AF"
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 88
  },
  gap: {
    height: 10
  },
  empty: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: palette.ink
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: palette.inkSoft,
    textAlign: "center"
  },
  scanButton: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    height: 50,
    borderRadius: 10,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  scanButtonBusy: {
    backgroundColor: "#0E8F65"
  },
  scanButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: palette.surface
  }
});
