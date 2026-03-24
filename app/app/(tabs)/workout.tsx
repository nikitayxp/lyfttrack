import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function WorkoutScreen() {
  return (
    <View style={styles.container}>
      <Ionicons name="barbell-outline" size={64} color="#1e293b" />
      <Text style={styles.title}>Novo Treino</Text>
      <Text style={styles.subtitle}>
        Em breve — vais poder registar{'\n'}exercícios, séries, pesos e RIR.
      </Text>
      <TouchableOpacity style={styles.startBtn}>
        <Text style={styles.startBtnText}>+ Iniciar Treino</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  startBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 40,
  },
  startBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});