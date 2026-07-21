import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Deal } from "../types";
import { palette, useNative } from "./theme";

export type SortMode = "relevance" | "recent";

/**
 * Momento que representa a oferta: a publicacao informada pela fonte descreve
 * melhor "quando a promocao comecou"; sem ela, vale desde quando o preco nao
 * muda e, por fim, o instante em que a varredura encontrou o anuncio.
 */
export const dealTimestamp = (deal: Deal) => {
  const candidates = [deal.publishedAt, deal.priceSince, deal.foundAt];

  for (const candidate of candidates) {
    const parsed = candidate ? Date.parse(candidate) : Number.NaN;
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return 0;
};

export const sortDeals = (deals: Deal[], mode: SortMode) =>
  mode === "recent"
    ? [...deals].sort((a, b) => dealTimestamp(b) - dealTimestamp(a))
    : [...deals].sort((a, b) => b.score - a.score);

type Props = {
  value: SortMode;
  onChange: (value: SortMode) => void;
};

/** Alterna a ordem do feed entre melhor oferta e mais recente. */
export function SortButton({ value, onChange }: Props) {
  const isRecent = value === "recent";
  const press = useRef(new Animated.Value(1)).current;
  const select = useRef(new Animated.Value(isRecent ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(select, {
      toValue: isRecent ? 1 : 0,
      duration: 160,
      // Cor de fundo nao anima na thread nativa.
      useNativeDriver: false
    }).start();
  }, [isRecent, select]);

  const animatePress = (toValue: number) => {
    Animated.spring(press, { toValue, useNativeDriver: useNative, speed: 40, bounciness: 0 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: press }] }}>
      <Pressable
        onPress={() => onChange(isRecent ? "relevance" : "recent")}
        onPressIn={() => animatePress(0.95)}
        onPressOut={() => animatePress(1)}
        accessibilityRole="button"
        accessibilityLabel={
          isRecent ? "Ordenado por mais recentes. Trocar para melhor oferta" : "Ordenado por melhor oferta. Trocar para mais recentes"
        }
      >
        <Animated.View
          style={[
            styles.button,
            {
              backgroundColor: select.interpolate({
                inputRange: [0, 1],
                outputRange: [palette.surface, palette.ink]
              }),
              borderColor: select.interpolate({
                inputRange: [0, 1],
                outputRange: [palette.border, palette.ink]
              })
            }
          ]}
        >
          <ClockGlyph active={isRecent} />
          <Text style={[styles.label, isRecent && styles.labelActive]}>
            {isRecent ? "Recentes" : "Melhores"}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** Relogio desenhado com Views: evita depender de uma fonte de icones. */
function ClockGlyph({ active }: { active: boolean }) {
  const tint = active ? palette.surface : palette.inkSoft;

  return (
    <View style={[styles.clockFace, { borderColor: tint }]}>
      <View style={[styles.clockHandHour, { backgroundColor: tint }]} />
      <View style={[styles.clockHandMinute, { backgroundColor: tint }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: palette.inkSoft
  },
  labelActive: {
    color: palette.surface
  },
  clockFace: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center"
  },
  clockHandHour: {
    position: "absolute",
    width: 1.5,
    height: 4,
    borderRadius: 1,
    top: 2.5,
    left: 4.25
  },
  clockHandMinute: {
    position: "absolute",
    width: 3.5,
    height: 1.5,
    borderRadius: 1,
    top: 5,
    left: 5
  }
});
