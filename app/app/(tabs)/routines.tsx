import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/theme';
import type { Tables } from '@/types/database';

const palette = Colors.dark;

type WorkoutRow = Tables<'workouts'>;
type RoutineCard = Pick<WorkoutRow, 'id' | 'name' | 'notes'> & {
  exerciseCount: number;
};

const MOCK_ROUTINES: RoutineCard[] = [
  {
    id: 'routine-push',
    name: 'Push Day',
    notes: 'Chest, shoulders and triceps focus.',
    exerciseCount: 6,
  },
  {
    id: 'routine-pull',
    name: 'Pull Day',
    notes: 'Back thickness, lats and biceps.',
    exerciseCount: 5,
  },
  {
    id: 'routine-legs',
    name: 'Leg Day',
    notes: 'Quads, glutes and hamstrings.',
    exerciseCount: 7,
  },
];

export default function RoutinesScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.newRoutineButton} activeOpacity={0.9}>
        <Ionicons name="add" size={24} color="#FFFFFF" />
        <Text style={styles.newRoutineButtonText}>New Routine</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Your Routines</Text>
      {MOCK_ROUTINES.map((routine) => (
        <TouchableOpacity key={routine.id} style={styles.routineCard} activeOpacity={0.88}>
          <View style={styles.cardHead}>
            <Text style={styles.routineName}>{routine.name}</Text>
            <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
          </View>
          <Text style={styles.routineMeta}>{routine.exerciseCount} exercises</Text>
          <Text style={styles.routineNotes}>{routine.notes ?? 'No notes available.'}</Text>
        </TouchableOpacity>
      ))}
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
    paddingTop: 20,
    paddingBottom: 32,
  },
  newRoutineButton: {
    minHeight: 74,
    borderRadius: 20,
    backgroundColor: palette.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
    shadowColor: palette.accent,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  newRoutineButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  routineCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  routineName: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  routineMeta: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  routineNotes: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});