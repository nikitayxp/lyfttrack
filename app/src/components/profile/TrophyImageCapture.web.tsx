import type { ReactNode } from 'react';
import { View } from 'react-native';

export default function TrophyImageCapture({ children }: { children?: ReactNode }) {
  return <View collapsable={false}>{children}</View>;
}
