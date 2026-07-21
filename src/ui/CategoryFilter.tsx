import { useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { palette, useNative } from "./theme";

export const ALL_CATEGORIES = "__all__";

export type CategoryOption = {
  value: string;
  label: string;
  count: number;
};

type Props = {
  options: CategoryOption[];
  value: string;
  onChange: (value: string) => void;
};

/** Faixa horizontal de categorias: filtra o feed sem ocupar altura da lista. */
export function CategoryFilter({ options, value, onChange }: Props) {
  if (options.length <= 1) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Sem altura fixa o flex do feed comprime a faixa e corta os chips.
      style={styles.track}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((option) => (
        <CategoryChip
          key={option.value}
          option={option}
          active={option.value === value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </ScrollView>
  );
}

function CategoryChip({
  option,
  active,
  onPress
}: {
  option: CategoryOption;
  active: boolean;
  onPress: () => void;
}) {
  const press = useRef(new Animated.Value(1)).current;
  const select = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(select, {
      toValue: active ? 1 : 0,
      duration: 160,
      // Cor de fundo nao anima na thread nativa.
      useNativeDriver: false
    }).start();
  }, [active, select]);

  const animatePress = (toValue: number) => {
    Animated.spring(press, { toValue, useNativeDriver: useNative, speed: 40, bounciness: 0 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: press }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animatePress(0.95)}
        onPressOut={() => animatePress(1)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
      >
        <Animated.View
          style={[
            styles.chip,
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
          <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
            {option.label}
          </Text>
          <Text style={[styles.count, active && styles.countActive]}>{option.count}</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const CHIP_HEIGHT = 34;
const ROW_PADDING = 10;

const styles = StyleSheet.create({
  track: {
    height: CHIP_HEIGHT + ROW_PADDING * 2,
    flexGrow: 0,
    flexShrink: 0
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: ROW_PADDING,
    gap: 8,
    flexDirection: "row",
    alignItems: "center"
  },
  chip: {
    height: CHIP_HEIGHT,
    borderRadius: CHIP_HEIGHT / 2,
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
  count: {
    fontSize: 11,
    fontWeight: "900",
    color: palette.muted,
    fontVariant: ["tabular-nums"]
  },
  countActive: {
    color: "#93C5AF"
  }
});
