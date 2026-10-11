import { useEffect, useState } from 'react';
import { Animated, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

type Props = {
  count: number;
  containerStyle: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
};

export default function AnimatedCountBadge({
  count,
  containerStyle,
  textStyle,
}: Props) {
  const [scale] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (count <= 0) {
      scale.setValue(0);
      return;
    }

    scale.setValue(0.65);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 22,
      bounciness: 10,
    }).start();
  }, [count, scale]);

  if (count <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[containerStyle, { transform: [{ scale }] }]}
    >
      <Text style={textStyle}>{count > 9 ? '9+' : count}</Text>
    </Animated.View>
  );
}
