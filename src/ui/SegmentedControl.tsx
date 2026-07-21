import { useEffect, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { palette, useNative } from "./theme";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type Props<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

const TRACK_PADDING = 4;

/**
 * Segmentado com pilula deslizante: o indicador viaja ate a opcao escolhida
 * enquanto os rotulos fazem crossfade entre o estado ativo e o inativo.
 */
export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / options.length : 0;

  const translateX = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  // Uma opacidade por segmento controla o crossfade do rotulo ativo.
  const labelOpacities = useRef(options.map((_, index) => new Animated.Value(index === activeIndex ? 1 : 0))).current;

  useEffect(() => {
    if (segmentWidth === 0) {
      return;
    }

    Animated.spring(translateX, {
      toValue: activeIndex * segmentWidth,
      useNativeDriver: useNative,
      speed: 18,
      bounciness: 8
    }).start();

    Animated.parallel(
      labelOpacities.map((opacity, index) =>
        Animated.timing(opacity, {
          toValue: index === activeIndex ? 1 : 0,
          duration: 180,
          useNativeDriver: useNative
        })
      )
    ).start();
  }, [activeIndex, labelOpacities, segmentWidth, translateX]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setTrackWidth(width);

    // Posiciona o indicador sem animar na primeira medicao.
    if (trackWidth === 0) {
      translateX.setValue((activeIndex * (width - TRACK_PADDING * 2)) / options.length);
    }
  };

  const animatePress = (toValue: number) => {
    Animated.spring(pressScale, {
      toValue,
      useNativeDriver: useNative,
      speed: 40,
      bounciness: 0
    }).start();
  };

  return (
    <View style={styles.track} onLayout={handleLayout}>
      {segmentWidth > 0 ? (
        <Animated.View
          style={[
            styles.indicator,
            {
              width: segmentWidth,
              transform: [{ translateX }, { scale: pressScale }]
            }
          ]}
        />
      ) : null}

      {options.map((option, index) => (
        <Pressable
          key={option.value}
          style={styles.segment}
          onPress={() => onChange(option.value)}
          onPressIn={() => animatePress(0.94)}
          onPressOut={() => animatePress(1)}
          accessibilityRole="tab"
          accessibilityState={{ selected: index === activeIndex }}
        >
          <View style={styles.labelStack}>
            <Text style={styles.label} numberOfLines={1}>
              {option.label}
            </Text>
            <Animated.Text
              style={[styles.label, styles.labelActive, { opacity: labelOpacities[index] }]}
              numberOfLines={1}
            >
              {option.label}
            </Animated.Text>
          </View>

          {typeof option.count === "number" ? (
            // Cor de texto nao anima na thread nativa, entao alterna direto.
            <Text style={[styles.count, index === activeIndex && styles.countActive]}>{option.count}</Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    padding: TRACK_PADDING,
    height: 52,
    borderRadius: 10,
    backgroundColor: palette.track,
    flexDirection: "row"
  },
  indicator: {
    position: "absolute",
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
    borderRadius: 8,
    backgroundColor: palette.surface,
    boxShadow: "0px 2px 6px rgba(11, 18, 32, 0.12)",
    pointerEvents: "none"
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2
  },
  labelStack: {
    justifyContent: "center"
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: palette.inkSoft
  },
  labelActive: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    color: palette.ink,
    textAlign: "center"
  },
  count: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "900",
    color: palette.muted
  },
  countActive: {
    color: palette.accentDeep
  }
});
