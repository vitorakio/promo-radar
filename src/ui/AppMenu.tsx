import { useEffect, useRef } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScanIntervalMinutes, ScreenKey } from "../types";
import { formatCountdown, formatInterval, scanIntervals } from "./scanInterval";
import { palette, useNative } from "./theme";

const PANEL_WIDTH = 300;

type Props = {
  visible: boolean;
  screen: ScreenKey;
  dealCount: number;
  storeCount: number;
  trackedProducts: number;
  autoScanEnabled: boolean;
  interval: ScanIntervalMinutes;
  msRemaining: number;
  onNavigate: (screen: ScreenKey) => void;
  onToggleAutoScan: (enabled: boolean) => void;
  onChangeInterval: (interval: ScanIntervalMinutes) => void;
  /** So a extensao passa: no popup estreito a lista pede uma aba inteira. */
  onOpenInTab?: () => void;
  onClose: () => void;
};

const navItems: { key: ScreenKey; label: string; hint: string }[] = [
  { key: "feed", label: "Radar", hint: "Ofertas encontradas por categoria" },
  { key: "aliexpress", label: "AliExpress", hint: "Vigia preco bugado e fora do padrao" },
  { key: "stores", label: "Lojas", hint: "De quais lojas quer receber alerta" },
  { key: "settings", label: "Alertas", hint: "Filtros, palavras-chave e notificacoes" }
];

/** Gaveta lateral: tira a navegacao e os controles do caminho do feed. */
export function AppMenu({
  visible,
  screen,
  dealCount,
  storeCount,
  trackedProducts,
  autoScanEnabled,
  interval,
  msRemaining,
  onNavigate,
  onToggleAutoScan,
  onChangeInterval,
  onOpenInTab,
  onClose
}: Props) {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: visible ? 240 : 180,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: useNative
    }).start();
  }, [slide, visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlayRoot}>
        <Animated.View style={[styles.backdrop, { opacity: slide }]}>
          <Pressable style={styles.backdropPress} onPress={onClose} accessibilityLabel="Fechar menu" />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            {
              transform: [
                { translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-PANEL_WIDTH, 0] }) }
              ]
            }
          ]}
        >
          <ScrollView contentContainerStyle={styles.panelContent}>
            <View>
              <Text style={styles.appName}>Promo Radar</Text>
              <Text style={styles.subtitle}>Promocao, cupom e erro de preco</Text>
            </View>

            <View style={styles.statsRow}>
              <Stat value={dealCount} label="ofertas" />
              <Stat value={storeCount} label="lojas" />
              <Stat value={trackedProducts} label="monitorados" />
            </View>

            <View style={styles.navGroup}>
              {navItems.map((item) => {
                const active = item.key === screen;

                return (
                  <Pressable
                    key={item.key}
                    style={[styles.navItem, active && styles.navItemActive]}
                    onPress={() => onNavigate(item.key)}
                  >
                    <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
                    <Text style={[styles.navHint, active && styles.navHintActive]}>{item.hint}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.autoGroup}>
              <Pressable style={styles.autoHeader} onPress={() => onToggleAutoScan(!autoScanEnabled)}>
                <View style={styles.autoText}>
                  <Text style={styles.autoTitle}>Analise automatica</Text>
                  <Text style={styles.autoHint}>
                    {autoScanEnabled
                      ? `A cada ${formatInterval(interval)} · proxima em ${formatCountdown(msRemaining)}`
                      : "Desligada"}
                  </Text>
                </View>
                <View style={[styles.toggle, autoScanEnabled && styles.toggleOn]}>
                  <View style={[styles.knob, autoScanEnabled && styles.knobOn]} />
                </View>
              </Pressable>

              {autoScanEnabled ? (
                <View style={styles.chipRow}>
                  {scanIntervals.map((value) => {
                    const active = value === interval;

                    return (
                      <Pressable
                        key={value}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => onChangeInterval(value)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {value === 60 ? "1h" : `${value}m`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>

            {onOpenInTab ? (
              <Pressable style={styles.expandButton} onPress={onOpenInTab}>
                <Text style={styles.expandButtonText}>Abrir em aba</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(11, 18, 32, 0.45)"
  },
  backdropPress: {
    flex: 1
  },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: PANEL_WIDTH,
    backgroundColor: palette.surface
  },
  panelContent: {
    padding: 20,
    paddingTop: 56,
    gap: 20
  },
  appName: {
    fontSize: 24,
    fontWeight: "900",
    color: palette.ink
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: palette.inkSoft
  },
  statsRow: {
    flexDirection: "row",
    gap: 8
  },
  stat: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: palette.track,
    paddingVertical: 10,
    paddingHorizontal: 8
  },
  statValue: {
    fontSize: 18,
    fontWeight: "900",
    color: palette.ink
  },
  statLabel: {
    marginTop: 2,
    fontSize: 10,
    color: palette.inkSoft
  },
  navGroup: {
    gap: 6
  },
  navItem: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  navItemActive: {
    backgroundColor: palette.ink
  },
  navLabel: {
    fontSize: 16,
    fontWeight: "900",
    color: palette.ink
  },
  navLabelActive: {
    color: palette.surface
  },
  navHint: {
    marginTop: 2,
    fontSize: 11,
    color: palette.inkSoft
  },
  navHintActive: {
    color: "#94A3B8"
  },
  autoGroup: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 16,
    gap: 10
  },
  autoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  autoText: {
    flex: 1
  },
  autoTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: palette.ink
  },
  autoHint: {
    marginTop: 2,
    fontSize: 11,
    color: palette.inkSoft,
    fontVariant: ["tabular-nums"]
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#D8DEE7",
    padding: 3,
    justifyContent: "center"
  },
  toggleOn: {
    backgroundColor: palette.accentSoft
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.surface,
    boxShadow: "0px 1px 2px rgba(11, 18, 32, 0.25)"
  },
  knobOn: {
    backgroundColor: palette.accent,
    alignSelf: "flex-end"
  },
  chipRow: {
    flexDirection: "row",
    gap: 6
  },
  chip: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D8DEE7",
    alignItems: "center",
    justifyContent: "center"
  },
  chipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft
  },
  chipText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#526071"
  },
  chipTextActive: {
    color: palette.accentDeep
  },
  expandButton: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.ink,
    alignItems: "center",
    justifyContent: "center"
  },
  expandButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: palette.ink
  }
});
