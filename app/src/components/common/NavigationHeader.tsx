import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { BackButton } from '@/components/common/BackButton';

export function NavigationHeader({ title, fallback }: { title: string; fallback: string }) {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.row}>
        <BackButton fallback={fallback} />
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Colors.dark.bgPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  title: { flex: 1, color: Colors.dark.textPrimary, fontSize: 20, fontWeight: '700' },
});
