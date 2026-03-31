import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { Colors } from '@/constants/theme';
import type { Tables } from '@/types/database';
import { createExercise, getErrorMessage, getExercisesCatalog } from '@/services/workoutService';
import { INPUT_LIMITS, sanitizeText } from '@/utils/inputValidation';

type ExerciseRow = Tables<'exercises'>;
const palette = Colors.dark;
const cardLayoutTransition = LinearTransition.springify().damping(16).stiffness(180);

const MUSCLE_GROUPS = [
  { id: 'Peito', label: 'Peito', color: '#EF4444' },
  { id: 'Costas', label: 'Costas', color: '#3B82F6' },
  { id: 'Pernas', label: 'Pernas', color: '#10B981' },
  { id: 'Braços', label: 'Braços', color: '#F59E0B' },
  { id: 'Ombros', label: 'Ombros', color: '#8B5CF6' },
  { id: 'Core', label: 'Core', color: '#EC4899' },
];

export default function ExercisesScreen() {
  const isWeb = Platform.OS === 'web';
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isCreatingExercise, setIsCreatingExercise] = useState(false);
  const [exerciseNameInput, setExerciseNameInput] = useState('');
  const [muscleGroupInput, setMuscleGroupInput] = useState('');
  const [equipmentInput, setEquipmentInput] = useState('');
  const [animationEpoch, setAnimationEpoch] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAnimationEpoch((currentValue) => currentValue + 1);
    }, [])
  );

  const loadExercises = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const catalog = await getExercisesCatalog();
      setExercises(catalog);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExercises();
  }, [loadExercises]);

  async function handleCreateExercise() {
    const normalizedName = sanitizeText(exerciseNameInput, {
      maxLength: INPUT_LIMITS.nameMax,
      allowEmpty: false,
    });
    const normalizedMuscleGroup = sanitizeText(muscleGroupInput, {
      maxLength: INPUT_LIMITS.nameMax,
      allowEmpty: true,
    });
    const normalizedEquipment = sanitizeText(equipmentInput, {
      maxLength: INPUT_LIMITS.nameMax,
      allowEmpty: true,
    });

    if (!normalizedName) {
      Alert.alert('Validation', 'Exercise name is required.');
      return;
    }

    setIsCreatingExercise(true);

    try {
      await createExercise({
        name: normalizedName,
        muscleGroup: normalizedMuscleGroup,
        equipment: normalizedEquipment,
      });

      setExerciseNameInput('');
      setMuscleGroupInput('');
      setEquipmentInput('');
      setIsCreateModalVisible(false);
      await loadExercises();
    } catch (error) {
      Alert.alert('Unable to create exercise', getErrorMessage(error));
    } finally {
      setIsCreatingExercise(false);
    }
  }

  const groupedExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = normalizedQuery
      ? exercises.filter((exercise) => {
          const byName = exercise.name.toLowerCase().includes(normalizedQuery);
          const byMuscle = (exercise.muscle_group ?? '').toLowerCase().includes(normalizedQuery);
          return byName || byMuscle;
        })
      : exercises;

    const groups = filtered.reduce<Record<string, ExerciseRow[]>>((acc, exercise) => {
      const groupKey = exercise.muscle_group ?? 'Other';
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(exercise);
      return acc;
    }, {});

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [query, exercises]);

  const ModalWrapper = isWeb ? View : Modal;
  const modalProps = isWeb 
    ? { style: [StyleSheet.absoluteFill, { zIndex: 9999 }] }
    : {
        visible: isCreateModalVisible,
        transparent: true,
        animationType: 'slide' as const,
        onRequestClose: () => setIsCreateModalVisible(false),
      };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Animated.View
        key={`toolbar-${animationEpoch}`}
        entering={FadeInUp.duration(320)}
        layout={cardLayoutTransition}
      >
        <View style={styles.toolbarRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={palette.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search exercises"
              placeholderTextColor={palette.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity style={styles.customButton} onPress={() => setIsCreateModalVisible(true)} activeOpacity={0.88}>
            <Text style={styles.customButtonText}>+ Custom</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {isLoading ? (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.statusText}>Loading exercises...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.statusContainer}>
          <Text style={styles.statusTitle}>Unable to load exercises</Text>
          <Text style={styles.statusText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadExercises()} activeOpacity={0.88}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : groupedExercises.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No exercises found</Text>
          <Text style={styles.emptySubtitle}>Try another keyword.</Text>
        </View>
      ) : (
        groupedExercises.map(([muscle, groupedItems], groupIndex) => (
          <Animated.View
            key={`${muscle}-${animationEpoch}`}
            entering={FadeInUp.delay(Math.min(groupIndex * 50, 260)).duration(340)}
            layout={cardLayoutTransition}
          >
            <View style={styles.groupSection}>
              <Text style={styles.groupTitle}>{muscle}</Text>
              {groupedItems.map((exercise, exerciseIndex) => (
                <Animated.View
                  key={`${exercise.id}-${animationEpoch}`}
                  entering={FadeInDown.delay(Math.min(exerciseIndex * 28, 180)).duration(280)}
                  layout={cardLayoutTransition}
                >
                  <View style={styles.exerciseRow}>
                    <View style={styles.exerciseTextWrap}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.exerciseMeta}>{exercise.equipment ?? 'Bodyweight'}</Text>
                    </View>
                    <Text style={styles.exerciseMuscle}>{exercise.muscle_group ?? 'General'}</Text>
                  </View>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        ))
      )}

      {(!isCreateModalVisible && isWeb) ? null : (
      <ModalWrapper {...modalProps}>
        <View style={[styles.modalBackdrop, isWeb && styles.modalBackdropWeb]}>
          <Pressable style={styles.modalDismissArea} onPress={() => setIsCreateModalVisible(false)} />

          <View style={[styles.modalSheet, isWeb && styles.modalSheetWeb]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Create Exercise</Text>

            <TextInput
              value={exerciseNameInput}
              onChangeText={(value) => setExerciseNameInput(value.substring(0, INPUT_LIMITS.nameMax))}
              placeholder="Name"
              placeholderTextColor={palette.textMuted}
              style={styles.modalInput}
              autoCapitalize="words"
              maxLength={INPUT_LIMITS.nameMax}
            />
            <Text style={styles.modalSectionTitle}>Grupo Muscular</Text>
            <View style={styles.muscleGrid}>
              {MUSCLE_GROUPS.map((mg) => {
                const isSelected = muscleGroupInput === mg.id;
                return (
                  <TouchableOpacity
                    key={mg.id}
                    style={[
                      styles.muscleChip, 
                      isSelected && { borderColor: mg.color, backgroundColor: `${mg.color}15` }
                    ]}
                    onPress={() => setMuscleGroupInput(mg.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.muscleColorDot, { backgroundColor: mg.color }]} />
                    <Text style={[styles.muscleChipText, isSelected && { color: mg.color, fontWeight: '700' }]}>{mg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              value={equipmentInput}
              onChangeText={(value) => setEquipmentInput(value.substring(0, INPUT_LIMITS.nameMax))}
              placeholder="Equipment"
              placeholderTextColor={palette.textMuted}
              style={styles.modalInput}
              autoCapitalize="words"
              maxLength={INPUT_LIMITS.nameMax}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsCreateModalVisible(false)}
                activeOpacity={0.88}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalCreateButton, isCreatingExercise && styles.modalCreateButtonDisabled]}
                onPress={() => void handleCreateExercise()}
                activeOpacity={0.88}
                disabled={isCreatingExercise}
              >
                {isCreatingExercise ? (
                  <ActivityIndicator size="small" color={palette.textPrimary} />
                ) : (
                  <Text style={styles.modalCreateButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ModalWrapper>
      )}
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
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    columnGap: 10,
  },
  searchBar: {
    flex: 1,
    backgroundColor: palette.inputBackground,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  customButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: palette.accent,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 4,
  },
  customButtonText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  statusContainer: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  statusTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  statusText: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  retryButton: {
    marginTop: 14,
    backgroundColor: palette.accent,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  groupSection: {
    marginBottom: 16,
  },
  groupTitle: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  exerciseRow: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  exerciseName: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  exerciseMeta: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  exerciseMuscle: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: palette.overlay,
  },
  modalBackdropWeb: {
    width: 393,
    maxWidth: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    left: 0,
    right: 0,
    alignSelf: 'center',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  modalSheetWeb: {
    width: 393,
    maxWidth: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    backgroundColor: palette.surface,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: palette.borderStrong,
    marginBottom: 12,
  },
  modalTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
  },
  modalSectionTitle: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
    marginLeft: 2,
  },
  muscleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  muscleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    backgroundColor: palette.inputBackground,
  },
  muscleColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  muscleChipText: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalInput: {
    backgroundColor: palette.inputBackground,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    color: palette.textPrimary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: '500',
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 10,
    marginTop: 6,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bgPrimary,
  },
  modalCancelButtonText: {
    color: palette.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  modalCreateButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
  },
  modalCreateButtonDisabled: {
    opacity: 0.75,
  },
  modalCreateButtonText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
});