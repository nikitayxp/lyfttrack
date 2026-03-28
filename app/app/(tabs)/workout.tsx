import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/theme';
import type { Tables } from '@/types/database';

const palette = Colors.dark;

type WorkoutRow = Tables<'workouts'>;
type RoutineQuickStart = Pick<WorkoutRow, 'id' | 'name'> & {
  exerciseCount: number;
};

const QUICK_START_ROUTINES: RoutineQuickStart[] = [
  { id: 'routine-push', name: 'Push Day', exerciseCount: 6 },
  { id: 'routine-pull', name: 'Pull Day', exerciseCount: 5 },
  { id: 'routine-legs', name: 'Leg Day', exerciseCount: 7 },
];

export default function WorkoutScreen() {
  function handleStartEmptyWorkout() {
    router.push('/workout/active' as any);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Workout</Text>
      <Text style={styles.subtitle}>Start from scratch or jump into a saved routine.</Text>

      <TouchableOpacity style={styles.primaryButton} activeOpacity={0.9} onPress={handleStartEmptyWorkout}>
        <Ionicons name="play" size={22} color="#FFFFFF" />
        <Text style={styles.primaryButtonText}>Start Empty Workout</Text>
      </TouchableOpacity>

      <View style={styles.quickStartSection}>
        <Text style={styles.sectionTitle}>Quick Start</Text>
        {QUICK_START_ROUTINES.map((routine) => (
          <TouchableOpacity key={routine.id} style={styles.quickStartCard} activeOpacity={0.88}>
            <View>
              <Text style={styles.quickStartTitle}>{routine.name}</Text>
              <Text style={styles.quickStartMeta}>{routine.exerciseCount} exercises</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bgPrimary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: palette.accent,
    minHeight: 76,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: palette.accent,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },
  quickStartSection: {
    marginTop: 28,
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  quickStartCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickStartTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  quickStartMeta: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});