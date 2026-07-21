import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  FlatList,
  StatusBar as SystemStatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { defaultSettings, defaultStorePreferences } from "./src/data/stores";
import { scanDeals } from "./src/services/dealMonitor";
import { activeProviders, allProviderCount } from "./src/services/marketSearch";
import { announceDeals } from "./src/services/dealAlerts";
import {
  CRITICAL_DISCOUNT_PERCENT,
  sendTestNotification,
  setupNotifications
} from "./src/services/notificationService";
import { DISCOUNT_TIERS, tierLabel, toggleDiscountTier } from "./src/services/discountTiers";
import { clearPriceHistory, countTrackedProducts } from "./src/services/priceHistory";
import { clearBadge, isPopupSurface, openAppInTab } from "./src/platform/extension";
import { loadSettings, loadStores, saveSettings, saveStores } from "./src/storage/appStorage";
import { loadFeed, saveFeed, subscribeToFeed } from "./src/storage/feedCache";
import {
  AlertSettings,
  Deal,
  DealKind,
  ScanIntervalMinutes,
  ScanOutcome,
  ScanProgress,
  ScreenKey,
  StorePreference
} from "./src/types";
import { AliexpressScreen } from "./src/ui/AliexpressScreen";
import { AppMenu } from "./src/ui/AppMenu";
import { ALL_CATEGORIES, CategoryFilter } from "./src/ui/CategoryFilter";
import { SortButton, SortMode, sortDeals } from "./src/ui/SortButton";
import { formatInterval, scanIntervals } from "./src/ui/scanInterval";
import { DealCard } from "./src/ui/DealCard";
import { ScanStatusPanel } from "./src/ui/ScanStatusPanel";
import { SegmentedControl } from "./src/ui/SegmentedControl";
import { confirmDestructive, showMessage } from "./src/ui/dialog";
import { palette, useNative } from "./src/ui/theme";

const RESULT_PANEL_TIMEOUT_MS = 9000;

/**
 * O SafeAreaView so recua o conteudo no iOS, e no Android o app desenha por baixo
 * das barras do sistema desde que o edge-to-edge virou padrao: sem este recuo o
 * cabecalho fica atras do relogio e dos icones de status.
 */
const statusBarInset = Platform.OS === "android" ? (SystemStatusBar.currentHeight ?? 0) : 0;

export default function App() {
  const [screen, setScreen] = useState<ScreenKey>("feed");
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState<DealKind | "all">("all");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stores, setStores] = useState<StorePreference[]>(defaultStorePreferences);
  const [settings, setSettings] = useState<AlertSettings>(defaultSettings);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress>();
  const [outcome, setOutcome] = useState<ScanOutcome>();
  const [notificationsReady, setNotificationsReady] = useState(false);
  const [trackedProducts, setTrackedProducts] = useState(0);
  const [keywordDraft, setKeywordDraft] = useState(defaultSettings.keywords.join(", "));
  const [blockedDraft, setBlockedDraft] = useState(defaultSettings.blockedTerms.join(", "));
  const [nextScanAt, setNextScanAt] = useState<number>();
  const [msRemaining, setMsRemaining] = useState(0);

  const isScanningRef = useRef(false);
  const settingsRef = useRef(settings);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const hydrate = async () => {
      const [storedStores, storedSettings, tracked, cachedFeed] = await Promise.all([
        loadStores(),
        loadSettings(),
        countTrackedProducts(),
        loadFeed()
      ]);

      setStores(storedStores);
      settingsRef.current = storedSettings;
      setSettings(storedSettings);
      setKeywordDraft(storedSettings.keywords.join(", "));
      setBlockedDraft(storedSettings.blockedTerms.join(", "));
      setTrackedProducts(tracked);

      // Abrir o app nao devolve uma tela vazia: o feed da ultima varredura ja
      // esta guardado, e na extensao ele vem das varreduras de segundo plano.
      if (cachedFeed) {
        setDeals(cachedFeed.deals);
      }

      // O feed esta na tela: o contador do icone da extensao ja cumpriu o papel.
      await clearBadge();
    };

    hydrate().catch(() => {
      showMessage("Nao consegui carregar suas preferencias.");
    });

    return () => clearTimeout(dismissTimerRef.current);
  }, []);

  // Popup aberto enquanto o service worker varre: o feed novo entra na hora.
  useEffect(
    () =>
      subscribeToFeed(() => {
        loadFeed()
          .then((cached) => {
            if (cached && !isScanningRef.current) {
              setDeals(cached.deals);
            }
          })
          .catch(() => undefined);
      }),
    []
  );

  const dealsByKind = useMemo(
    () => (filter === "all" ? deals : deals.filter((deal) => deal.kind === filter)),
    [deals, filter]
  );

  /** Categorias presentes no recorte atual, da maior para a menor. */
  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    dealsByKind.forEach((deal) => counts.set(deal.category, (counts.get(deal.category) ?? 0) + 1));

    const categories = [...counts.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count);

    return [{ value: ALL_CATEGORIES, label: "Todas", count: dealsByKind.length }, ...categories];
  }, [dealsByKind]);

  // Trocar de aba pode esvaziar a categoria escolhida; nesse caso volta para todas.
  const activeCategory = categoryOptions.some((option) => option.value === category)
    ? category
    : ALL_CATEGORIES;

  const visibleDeals = useMemo(() => {
    const byCategory =
      activeCategory === ALL_CATEGORIES
        ? dealsByKind
        : dealsByKind.filter((deal) => deal.category === activeCategory);

    return sortDeals(byCategory, sortMode);
  }, [activeCategory, dealsByKind, sortMode]);

  const counts = useMemo(
    () => ({
      all: deals.length,
      promo: deals.filter((deal) => deal.kind === "promo").length,
      coupon: deals.filter((deal) => deal.kind === "coupon").length,
      bug: deals.filter((deal) => deal.kind === "bug").length
    }),
    [deals]
  );

  const activeStores = useMemo(() => stores.filter((store) => store.enabled).length, [stores]);

  const sourceSummary = useMemo(() => {
    const providers = activeProviders();
    const names = providers.map((provider) => provider.name).join(", ");

    // No navegador a politica de origem barra a busca direta nas lojas.
    return providers.length < allProviderCount
      ? `${names}. A busca direta na loja so roda no app instalado, por restricao do navegador.`
      : names;
  }, []);

  /**
   * Aplica um ajuste sobre as preferencias atuais. O ref acompanha o valor mais
   * recente para que toques seguidos (marcar varias faixas, por exemplo) nao
   * partam do estado capturado no render e sobrescrevam uns aos outros.
   */
  const persistSettings = useCallback(
    async (patch: Partial<AlertSettings> | ((current: AlertSettings) => Partial<AlertSettings>)) => {
      const current = settingsRef.current;
      const next = { ...current, ...(typeof patch === "function" ? patch(current) : patch) };

      settingsRef.current = next;
      setSettings(next);
      await saveSettings(next);
    },
    []
  );

  const persistStores = useCallback(async (nextStores: StorePreference[]) => {
    setStores(nextStores);
    await saveStores(nextStores);
  }, []);

  const requestNotifications = async () => {
    const ready = await setupNotifications();
    setNotificationsReady(ready);

    if (!ready) {
      showMessage("Permissao negada", "Ative as notificacoes do app nas configuracoes do sistema.");
    }
  };

  const testNotification = async () => {
    try {
      const sent = await sendTestNotification();
      setNotificationsReady(sent);

      showMessage(
        sent ? "Notificacao enviada" : "Permissao negada",
        sent
          ? "Se ela nao aparecer, verifique as notificacoes do app nas configuracoes do sistema."
          : "Ative as notificacoes do app nas configuracoes do sistema e tente de novo."
      );
    } catch (error) {
      showMessage("Falha ao notificar", error instanceof Error ? error.message : "Erro desconhecido");
    }
  };

  const runScan = useCallback(async () => {
    if (isScanningRef.current) {
      return;
    }

    isScanningRef.current = true;
    clearTimeout(dismissTimerRef.current);
    setIsScanning(true);
    setOutcome(undefined);
    setProgress({ current: 0, total: 1, label: "Preparando varredura" });

    try {
      const knownProductKeys = new Set(deals.map((deal) => deal.productKey));
      const result = await scanDeals(stores, settings, knownProductKeys, setProgress);

      setDeals(result.deals);
      setOutcome(result);
      setTrackedProducts(await countTrackedProducts());

      // O catalogo de demonstracao nao vale como feed guardado: ele existe so
      // para a tela nao ficar vazia quando nenhuma fonte respondeu.
      if (!result.usedFallback) {
        await saveFeed(result.deals, result.newCount);

        if (await announceDeals(result.deals)) {
          setNotificationsReady(true);
        }
      }

      dismissTimerRef.current = setTimeout(() => setOutcome(undefined), RESULT_PANEL_TIMEOUT_MS);
    } catch {
      showMessage("Falha na varredura", "Nao consegui consultar as fontes agora.");
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
      setProgress(undefined);

      if (settings.autoScanEnabled) {
        setNextScanAt(Date.now() + settings.autoScanIntervalMinutes * 60 * 1000);
      }
    }
  }, [deals, settings, stores]);

  // Reagenda o ciclo sempre que a analise automatica muda de estado ou intervalo.
  useEffect(() => {
    if (!settings.autoScanEnabled) {
      setNextScanAt(undefined);
      setMsRemaining(0);
      return;
    }

    setNextScanAt((current) => current ?? Date.now() + settings.autoScanIntervalMinutes * 60 * 1000);
  }, [settings.autoScanEnabled, settings.autoScanIntervalMinutes]);

  // Um unico tick de 1s move a contagem regressiva e dispara a varredura na hora certa.
  useEffect(() => {
    if (!settings.autoScanEnabled || !nextScanAt) {
      return undefined;
    }

    const tick = () => {
      const remaining = nextScanAt - Date.now();
      setMsRemaining(Math.max(0, remaining));

      if (remaining <= 0 && !isScanningRef.current) {
        runScan();
      }
    };

    tick();
    const timerId = setInterval(tick, 1000);

    return () => clearInterval(timerId);
  }, [nextScanAt, runScan, settings.autoScanEnabled]);

  const toggleAutoScan = (autoScanEnabled: boolean) => {
    setNextScanAt(autoScanEnabled ? Date.now() + settings.autoScanIntervalMinutes * 60 * 1000 : undefined);
    persistSettings({ autoScanEnabled });
  };

  const changeInterval = (autoScanIntervalMinutes: ScanIntervalMinutes) => {
    setNextScanAt(Date.now() + autoScanIntervalMinutes * 60 * 1000);
    persistSettings({ autoScanIntervalMinutes });
  };

  const updateFilters = async () => {
    await persistSettings({
      keywords: splitTerms(keywordDraft),
      blockedTerms: splitTerms(blockedDraft)
    });

    showMessage("Filtros salvos", "A proxima varredura ja usa os novos termos.");
  };

  const resetHistory = () => {
    confirmDestructive({
      title: "Apagar historico de precos?",
      message: "As proximas varreduras voltam a nao ter base de comparacao.",
      confirmLabel: "Apagar",
      onConfirm: async () => {
        await clearPriceHistory();
        setTrackedProducts(0);
      }
    });
  };

  const openScreen = (next: ScreenKey) => {
    setScreen(next);
    setMenuOpen(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={styles.container}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.menuButton}
            onPress={() => setMenuOpen(true)}
            accessibilityLabel="Abrir menu"
            accessibilityRole="button"
          >
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </Pressable>

          <HeaderStatus
            isScanning={isScanning}
            screen={screen}
            dealCount={counts.all}
            autoScanEnabled={settings.autoScanEnabled}
            msRemaining={msRemaining}
          />

          <Pressable
            style={[styles.scanButton, isScanning && styles.scanButtonBusy]}
            onPress={runScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator color={palette.surface} size="small" />
            ) : (
              <Text style={styles.scanButtonText}>Analisar agora</Text>
            )}
          </Pressable>
        </View>

        {screen === "feed" && (
          <View style={styles.screen}>
            <ScanStatusPanel
              isScanning={isScanning}
              progress={progress}
              outcome={outcome}
              onDismiss={() => setOutcome(undefined)}
            />

            <View style={styles.segmentedWrapper}>
              <SegmentedControl
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "Todos", count: counts.all },
                  { value: "promo", label: "Promos", count: counts.promo },
                  { value: "coupon", label: "Cupons", count: counts.coupon },
                  { value: "bug", label: "Suspeitos", count: counts.bug }
                ]}
              />
            </View>

            <View style={styles.filterRow}>
              <View style={styles.filterScroll}>
                <CategoryFilter options={categoryOptions} value={activeCategory} onChange={setCategory} />
              </View>
              <View style={styles.sortWrapper}>
                <SortButton value={sortMode} onChange={setSortMode} />
              </View>
            </View>

            <FlatList
              data={visibleDeals}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item, index }) => <DealCard deal={item} index={index} />}
              ItemSeparatorComponent={() => <View style={styles.itemGap} />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>
                    {deals.length === 0 ? "Nenhuma varredura ainda" : "Nada neste filtro"}
                  </Text>
                  <Text style={styles.emptyText}>
                    {deals.length === 0
                      ? "Toque em analisar. O radar busca direto na Amazon e no KaBuM, usa agregadores para alcancar Magalu, Casas Bahia, Ponto e Extra, e acompanha promocao, cupom e erro de preco no Promobit."
                      : "Troque a aba ou rode uma nova analise."}
                  </Text>
                </View>
              }
            />
          </View>
        )}

        {screen === "aliexpress" && <AliexpressScreen settings={settings} />}

        {screen === "stores" && (
          <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sectionTitle}>Lojas</Text>
            <Text style={styles.helperText}>
              A varredura cobre o mercado por agregadores de preco, busca direto na Amazon e no KaBuM e acompanha
              as promocoes do Promobit. Aqui voce escolhe de quais lojas quer receber alerta.
            </Text>
            <View style={styles.sourceNote}>
              <Text style={styles.sourceNoteTitle}>Fontes desta varredura</Text>
              <Text style={styles.sourceNoteText}>{sourceSummary}</Text>
            </View>

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceText}>
                <Text style={styles.preferenceTitle}>Lojas fora da lista</Text>
                <Text style={styles.preferenceHint}>
                  Inclui vendedores menores que aparecerem com o melhor preco.
                </Text>
              </View>
              <Switch
                value={settings.includeUnlistedStores}
                onValueChange={(includeUnlistedStores) =>
                  persistSettings({ includeUnlistedStores })
                }
                trackColor={{ true: "#A7F3D0", false: "#D8DEE7" }}
                thumbColor={settings.includeUnlistedStores ? palette.accent : palette.surface}
              />
            </View>

            <View style={styles.bulkRow}>
              <Pressable
                style={styles.bulkButton}
                onPress={() => persistStores(stores.map((store) => ({ ...store, enabled: true })))}
              >
                <Text style={styles.bulkButtonText}>Ativar todas</Text>
              </Pressable>
              <Pressable
                style={styles.bulkButton}
                onPress={() => persistStores(stores.map((store) => ({ ...store, enabled: false })))}
              >
                <Text style={styles.bulkButtonText}>Desativar todas</Text>
              </Pressable>
            </View>

            {stores.map((store) => (
              <View key={store.id} style={styles.storeItem}>
                <Text style={styles.storeName}>{store.name}</Text>
                <Switch
                  value={store.enabled}
                  onValueChange={(enabled) =>
                    persistStores(stores.map((item) => (item.id === store.id ? { ...item, enabled } : item)))
                  }
                  trackColor={{ true: "#A7F3D0", false: "#D8DEE7" }}
                  thumbColor={store.enabled ? palette.accent : palette.surface}
                />
              </View>
            ))}
          </ScrollView>
        )}

        {screen === "settings" && (
          <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sectionTitle}>Alertas</Text>

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceText}>
                <Text style={styles.preferenceTitle}>Analise automatica</Text>
                <Text style={styles.preferenceHint}>
                  {settings.autoScanEnabled
                    ? `A cada ${formatInterval(settings.autoScanIntervalMinutes)}, com o app aberto.`
                    : "Desligada. Ative aqui ou pelo menu."}
                </Text>
              </View>
              <Switch
                value={settings.autoScanEnabled}
                onValueChange={toggleAutoScan}
                trackColor={{ true: "#A7F3D0", false: "#D8DEE7" }}
                thumbColor={settings.autoScanEnabled ? palette.accent : palette.surface}
              />
            </View>

            {settings.autoScanEnabled ? (
              <View style={styles.formPanel}>
                <Text style={styles.inputLabel}>Intervalo</Text>
                <View style={styles.chipRow}>
                  {scanIntervals.map((value) => (
                    <Pressable
                      key={value}
                      style={[
                        styles.chip,
                        settings.autoScanIntervalMinutes === value && styles.chipActive
                      ]}
                      onPress={() => changeInterval(value)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          settings.autoScanIntervalMinutes === value && styles.chipTextActive
                        ]}
                      >
                        {value === 60 ? "1h" : `${value}m`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceText}>
                <Text style={styles.preferenceTitle}>Notificar cupons</Text>
                <Text style={styles.preferenceHint}>Codigos de desconto e cashback das lojas.</Text>
              </View>
              <Switch
                value={settings.notifyCoupons}
                onValueChange={(notifyCoupons) => persistSettings({ notifyCoupons })}
                trackColor={{ true: "#A7F3D0", false: "#D8DEE7" }}
                thumbColor={settings.notifyCoupons ? palette.accent : palette.surface}
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceText}>
                <Text style={styles.preferenceTitle}>Notificar preco suspeito</Text>
                <Text style={styles.preferenceHint}>
                  Erro de preco sinalizado pela comunidade ou queda acima de 50% no historico.
                </Text>
              </View>
              <Switch
                value={settings.notifyBuggedAds}
                onValueChange={(notifyBuggedAds) => persistSettings({ notifyBuggedAds })}
                trackColor={{ true: "#A7F3D0", false: "#D8DEE7" }}
                thumbColor={settings.notifyBuggedAds ? palette.accent : palette.surface}
              />
            </View>

            <View style={styles.formPanel}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Faixas de desconto</Text>
                {settings.discountTiers.length > 0 ? (
                  <Pressable onPress={() => persistSettings({ discountTiers: [] })} hitSlop={8}>
                    <Text style={styles.clearLink}>Limpar</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.fieldHint}>
                {settings.discountTiers.length === 0
                  ? "Nenhuma marcada: qualquer desconto entra no radar."
                  : `Mostrando so ${settings.discountTiers.map(tierLabel).join(", ")}.`}{" "}
                Vale para ofertas com desconto ja apurado. Queda de {CRITICAL_DISCOUNT_PERCENT}% ou mais
                sempre alerta, mesmo fora das faixas.
              </Text>
              <View style={styles.chipGrid}>
                {DISCOUNT_TIERS.map((tier) => {
                  const active = settings.discountTiers.includes(tier);

                  return (
                    <Pressable
                      key={tier}
                      style={[styles.chip, styles.chipGridItem, active && styles.chipActive]}
                      onPress={() =>
                        persistSettings((current) => ({
                          discountTiers: toggleDiscountTier(current.discountTiers, tier)
                        }))
                      }
                      accessibilityRole="checkbox"
                      // accessibilityState cobre o nativo; aria-checked, o navegador.
                      accessibilityState={{ checked: active }}
                      aria-checked={active}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {tierLabel(tier)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>O que buscar</Text>
              <Text style={styles.fieldHint}>
                Cada termo vira uma busca, ate quatro por varredura. As promocoes do Promobit chegam por
                categoria, independente destes termos.
              </Text>
              <TextInput
                value={keywordDraft}
                onChangeText={setKeywordDraft}
                placeholder="ssd, notebook, smart tv"
                placeholderTextColor="#7B8794"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Termos bloqueados</Text>
              <TextInput
                value={blockedDraft}
                onChangeText={setBlockedDraft}
                placeholder="usado, recondicionado"
                placeholderTextColor="#7B8794"
                style={styles.input}
              />

              <Pressable style={styles.secondaryButton} onPress={updateFilters}>
                <Text style={styles.secondaryButtonText}>Salvar filtros</Text>
              </Pressable>
            </View>

            <View style={styles.formPanel}>
              <Text style={styles.inputLabel}>ICMS do seu estado</Text>
              <Text style={styles.fieldHint}>
                Usado na estimativa de imposto dos produtos importados. Ate US$ 50 o Imposto de Importacao e
                zero; acima disso, 60% com desconto de US$ 30.
              </Text>
              <View style={styles.chipRow}>
                {[17, 18, 19, 20].map((value) => (
                  <Pressable
                    key={value}
                    style={[styles.chip, settings.icmsPercent === value && styles.chipActive]}
                    onPress={() => persistSettings({ icmsPercent: value })}
                  >
                    <Text
                      style={[styles.chipText, settings.icmsPercent === value && styles.chipTextActive]}
                    >
                      {value}%
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formPanel}>
              <Text style={styles.inputLabel}>Historico de precos</Text>
              <Text style={styles.fieldHint}>
                {trackedProducts} produtos acompanhados neste aparelho. E dele que sai o percentual de desconto
                real.
              </Text>
              <Pressable style={styles.outlineButton} onPress={resetHistory}>
                <Text style={styles.outlineButtonText}>Apagar historico</Text>
              </Pressable>
            </View>

            <View style={styles.formPanel}>
              <Text style={styles.inputLabel}>Notificacoes</Text>
              <Text style={styles.fieldHint}>
                Erro de preco e queda de {CRITICAL_DISCOUNT_PERCENT}% ou mais sempre geram alerta, um por
                oferta, mesmo com o app em segundo plano.
              </Text>

              <Pressable style={styles.outlineButton} onPress={requestNotifications}>
                <Text style={styles.outlineButtonText}>
                  {notificationsReady ? "Notificacoes ativas" : "Ativar notificacoes"}
                </Text>
              </Pressable>

              <Pressable style={styles.secondaryButton} onPress={testNotification}>
                <Text style={styles.secondaryButtonText}>Enviar notificacao de teste</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <AppMenu
        visible={menuOpen}
        screen={screen}
        dealCount={counts.all}
        storeCount={activeStores}
        trackedProducts={trackedProducts}
        autoScanEnabled={settings.autoScanEnabled}
        interval={settings.autoScanIntervalMinutes}
        msRemaining={msRemaining}
        onNavigate={openScreen}
        onToggleAutoScan={toggleAutoScan}
        onChangeInterval={changeInterval}
        onOpenInTab={isPopupSurface ? openAppInTab : undefined}
        onClose={() => setMenuOpen(false)}
      />
    </SafeAreaView>
  );
}

const screenTitles: Record<ScreenKey, string> = {
  feed: "Radar",
  aliexpress: "AliExpress",
  stores: "Lojas",
  settings: "Alertas"
};

/** Linha central do cabecalho: diz o estado atual sem ocupar altura. */
function HeaderStatus({
  isScanning,
  screen,
  dealCount,
  autoScanEnabled,
  msRemaining
}: {
  isScanning: boolean;
  screen: ScreenKey;
  dealCount: number;
  autoScanEnabled: boolean;
  msRemaining: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isScanning) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: useNative
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: useNative
        })
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [isScanning, pulse]);

  const seconds = Math.max(0, Math.round(msRemaining / 1000));
  const countdown = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const subtitle = isScanning
    ? "varrendo o mercado"
    : autoScanEnabled
      ? `proxima em ${countdown}`
      : `${dealCount} ${dealCount === 1 ? "oferta" : "ofertas"}`;

  return (
    <View style={styles.headerStatus}>
      <View style={styles.headerTitleRow}>
        {isScanning ? (
          <Animated.View
            style={[
              styles.headerDot,
              { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }
            ]}
          />
        ) : null}
        <Text style={styles.headerTitle} numberOfLines={1}>
          {screenTitles[screen]}
        </Text>
      </View>
      <Text style={styles.headerSubtitle} numberOfLines={1}>
        {subtitle}
      </Text>
    </View>
  );
}

function splitTerms(value: string) {
  return value
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
    paddingTop: statusBarInset
  },
  container: {
    flex: 1,
    backgroundColor: palette.background
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  menuLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.ink
  },
  headerStatus: {
    flex: 1,
    minWidth: 0
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  headerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.accent
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: palette.ink
  },
  headerSubtitle: {
    fontSize: 11,
    color: palette.inkSoft,
    fontVariant: ["tabular-nums"]
  },
  scanButton: {
    height: 40,
    minWidth: 118,
    borderRadius: 10,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  scanButtonBusy: {
    backgroundColor: "#0E8F65"
  },
  scanButtonText: {
    color: palette.surface,
    fontSize: 13,
    fontWeight: "900"
  },
  screen: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  filterScroll: {
    flex: 1,
    minWidth: 0
  },
  sortWrapper: {
    paddingRight: 16,
    paddingLeft: 8,
    // Separa o botao fixo dos chips que passam rolando atras dele.
    borderLeftWidth: 1,
    borderLeftColor: palette.border,
    marginLeft: 4,
    paddingVertical: 10
  },
  segmentedWrapper: {
    marginHorizontal: 16,
    marginTop: 10
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32
  },
  itemGap: {
    height: 10
  },
  emptyState: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: palette.ink
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: palette.inkSoft,
    textAlign: "center"
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: palette.ink
  },
  helperText: {
    fontSize: 13,
    lineHeight: 19,
    color: palette.inkSoft
  },
  sourceNote: {
    borderRadius: 10,
    backgroundColor: palette.track,
    padding: 12,
    gap: 4
  },
  sourceNoteTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#334155"
  },
  sourceNoteText: {
    fontSize: 12,
    lineHeight: 17,
    color: palette.inkSoft
  },
  formPanel: {
    borderRadius: 10,
    backgroundColor: palette.surface,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 10
  },
  input: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D8DEE7",
    paddingHorizontal: 12,
    fontSize: 14,
    color: palette.ink,
    backgroundColor: palette.surface
  },
  inputLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "900",
    color: "#334155"
  },
  fieldHint: {
    marginTop: -4,
    fontSize: 12,
    lineHeight: 17,
    color: palette.inkSoft
  },
  secondaryButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: palette.ink,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: palette.surface
  },
  bulkRow: {
    flexDirection: "row",
    gap: 10
  },
  bulkButton: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D8DEE7",
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  bulkButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155"
  },
  storeItem: {
    borderRadius: 10,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  storeName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: palette.ink
  },
  preferenceRow: {
    minHeight: 78,
    borderRadius: 10,
    backgroundColor: palette.surface,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  preferenceText: {
    flex: 1
  },
  preferenceTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: palette.ink
  },
  preferenceHint: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: palette.inkSoft
  },
  chipRow: {
    flexDirection: "row",
    gap: 8
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  clearLink: {
    fontSize: 12,
    fontWeight: "800",
    color: palette.accentDeep
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chipGridItem: {
    // Tres por linha: "50-59%" nao cabe em quatro colunas na largura do celular.
    flexBasis: "30%",
    flexGrow: 1,
    minWidth: 92
  },
  chip: {
    flex: 1,
    height: 42,
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
    fontSize: 13,
    fontWeight: "900",
    color: "#526071"
  },
  chipTextActive: {
    color: palette.accentDeep
  },
  outlineButton: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.ink,
    alignItems: "center",
    justifyContent: "center"
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: palette.ink
  }
});
