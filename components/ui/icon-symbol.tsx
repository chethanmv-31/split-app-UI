// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'cart.fill': 'shopping-cart',
  'plus': 'add',
  'plus.circle.fill': 'add-circle',
  'clock.fill': 'schedule',
  'chart.bar.fill': 'bar-chart',
  'chart.pie.fill': 'pie-chart',
  'person.fill': 'person',
  'person.2.fill': 'groups',
  'person.3.fill': 'groups',
  'person.badge.plus': 'person-add',
  'dollarsign.circle.fill': 'attach-money',
  'paperplane.fill': 'send',
  'calendar': 'calendar-today',
  'magnifyingglass': 'search',
  'xmark': 'close',
  'xmark.circle.fill': 'cancel',
  'checkmark': 'check',
  'phone.fill': 'phone',
  'chevron.left': 'chevron-left',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.up': 'keyboard-arrow-up',
  'chevron.down': 'keyboard-arrow-down',
  'pencil': 'edit',
  'fork.knife': 'restaurant',
  'airplane': 'flight',
  'bag.fill': 'local-mall',
  'heart.text.square.fill': 'favorite',
  'book.fill': 'menu-book',
  'bolt.fill': 'flash-on',
  'car.fill': 'directions-car',
  'tv.fill': 'tv',
  'doc.plaintext.fill': 'description',
  'ellipsis.circle.fill': 'more-horiz',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: SymbolViewProps['name'];
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name] ?? 'help-outline'}
      style={style}
    />
  );
}
