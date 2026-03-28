import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/theme';
import {
  createExercise,
  createWorkoutWithSets,
  getErrorMessage,
  getExercisesCatalog,
  type WorkoutSetDraft,
} from '@/services/workoutService';
import type { Tables } from '@/types/database';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type ExerciseRow = Tables<'exercises'>;
type SetRow = Tables<'sets'>;

const palette = Colors.dark;
const SET_TYPE_OPTIONS = ['Warmup', 'Working', 'Drop'] as const;

type SetTypeOption = (typeof SET_TYPE_OPTIONS)[number];
type SetInputField = 'weightInput' | 'repsInput' | 'rirInput';

type ActiveSet = Pick<SetRow, 'id' | 'set_number' | 'weight' | 'reps' | 'rir' | 'set_type'> & {
  completed: boolean;
  weightInput: string;
  repsInput: string;
  rirInput: string;
};

type ActiveExercise = {
  id: string;
  exercise: ExerciseRow;
  sets: ActiveSet[];
};

function parseOptionalNumber(value: string): number | null {
  if (!value || value === '.') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeDecimalInput(value: string): string {
  const digitsAndDot = value.replace(/[^0-9.]/g, '');
  const [head, ...tail] = digitsAndDot.split('.');

  if (tail.length === 0) {
    return head;
  }

  return `${head}.${tail.join('')}`;
}

function sanitizeIntegerInput(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

function formatElapsedTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function createSet(
  exerciseId: string,
  setNumber: number,
  initial?: {
    weightInput?: string;
    repsInput?: string;
    rirInput?: string;
    setType?: SetTypeOption;
  }
): ActiveSet {
  const weightInput = initial?.weightInput ?? '';
  const repsInput = initial?.repsInput ?? '';
  const rirInput = initial?.rirInput ?? '';

  return {
    id: `${exerciseId}-set-${setNumber}-${Math.random().toString(36).slice(2, 8)}`,
    set_number: setNumber,
    set_type: initial?.setType ?? 'Working',
    weight: parseOptionalNumber(weightInput),
    reps: parseOptionalNumber(repsInput),
    rir: parseOptionalNumber(rirInput),
    completed: false,
    weightInput,
    repsInput,
    rirInput,
  };
}

function createExerciseBlock(exercise: ExerciseRow): ActiveExercise {
  return {
    id: `active-${exercise.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    exercise,
    sets: [
      createSet(exercise.id, 1, { setType: 'Warmup' }),
      createSet(exercise.id, 2, { setType: 'Working' }),
    ],
  };
}

function getNextSetType(current: string | null): SetTypeOption {
  const normalizedCurrent = (current as SetTypeOption | null) ?? 'Working';
  const currentIndex = SET_TYPE_OPTIONS.indexOf(normalizedCurrent);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % SET_TYPE_OPTIONS.length;
  return SET_TYPE_OPTIONS[nextIndex];
}

export default function ActiveWorkoutScreen() {
  const insets = useSafeAreaInsets();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [createExerciseVisible, setCreateExerciseVisible] = useState(false);
  const [catalogExercises, setCatalogExercises] = useState<ExerciseRow[]>([]);
  const [activeExercises, setActiveExercises] = useState<ActiveExercise[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(true);
  const [exerciseLoadError, setExerciseLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingExercise, setIsCreatingExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseMuscleGroup, setNewExerciseMuscleGroup] = useState('');
  const [newExerciseEquipment, setNewExerciseEquipment] = useState('');
  const [workoutStartedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((currentValue) => currentValue + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const loadExercises = useCallback(async () => {
    setIsLoadingExercises(true);
    setExerciseLoadError(null);

    try {
      const exercises = await getExercisesCatalog();
      setCatalogExercises(exercises);
    } catch (error) {
      setExerciseLoadError(getErrorMessage(error));
    } finally {
      setIsLoadingExercises(false);
    }
  }, []);

  useEffect(() => {
    void loadExercises();
  }, [loadExercises]);

  const timerLabel = useMemo(() => formatElapsedTime(elapsedSeconds), [elapsedSeconds]);

  function toggleSetCompleted(exerciseId: string, setId: string) {
    setActiveExercises((currentValue) =>
      currentValue.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        return {
          ...exercise,
          sets: exercise.sets.map((setItem) =>
            setItem.id === setId ? { ...setItem, completed: !setItem.completed } : setItem
          ),
        };
      })
    );
  }

  function cycleSetType(exerciseId: string, setId: string) {
    setActiveExercises((currentValue) =>
      currentValue.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        return {
          ...exercise,
          sets: exercise.sets.map((setItem) =>
            setItem.id === setId
              ? {
                  ...setItem,
                  set_type: getNextSetType(setItem.set_type),
                }
              : setItem
          ),
        };
      })
    );
  }

  function updateSetInput(exerciseId: string, setId: string, field: SetInputField, value: string) {
    const sanitizedValue = field === 'weightInput' ? sanitizeDecimalInput(value) : sanitizeIntegerInput(value);

    setActiveExercises((currentValue) =>
      currentValue.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        return {
          ...exercise,
          sets: exercise.sets.map((setItem) => {
            if (setItem.id !== setId) {
              return setItem;
            }

            if (field === 'weightInput') {
              return {
                ...setItem,
                weightInput: sanitizedValue,
                weight: parseOptionalNumber(sanitizedValue),
              };
            }

            if (field === 'repsInput') {
              return {
                ...setItem,
                repsInput: sanitizedValue,
                reps: parseOptionalNumber(sanitizedValue),
              };
            }

            return {
              ...setItem,
              rirInput: sanitizedValue,
              rir: parseOptionalNumber(sanitizedValue),
            };
          }),
        };
      })
    );
  }

  function addSet(exerciseId: string) {
    setActiveExercises((currentValue) =>
      currentValue.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        const nextSetNumber = (exercise.sets[exercise.sets.length - 1]?.set_number ?? exercise.sets.length) + 1;

        return {
          ...exercise,
          sets: [...exercise.sets, createSet(exercise.exercise.id, nextSetNumber)],
        };
      })
    );
  }

  function addExercise(exercise: ExerciseRow) {
    setActiveExercises((currentValue) => [...currentValue, createExerciseBlock(exercise)]);
    setExercisePickerVisible(false);
  }

  async function handleCreateExercise() {
    const normalizedName = newExerciseName.trim();

    if (!normalizedName) {
      Alert.alert('Validation', 'Exercise name is required.');
      return;
    }

    setIsCreatingExercise(true);

    try {
      const createdExercise = await createExercise({
        name: normalizedName,
        muscleGroup: newExerciseMuscleGroup,
        equipment: newExerciseEquipment,
      });

      setNewExerciseName('');
      setNewExerciseMuscleGroup('');
      setNewExerciseEquipment('');
      setCreateExerciseVisible(false);

      await loadExercises();
      addExercise(createdExercise);
    } catch (error) {
      Alert.alert('Unable to create exercise', getErrorMessage(error));
    } finally {
      setIsCreatingExercise(false);
    }
  }

  async function handleFinishWorkout() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const setDrafts: WorkoutSetDraft[] = activeExercises.flatMap((exercise) =>
        exercise.sets.map((setItem) => ({
          exerciseId: exercise.exercise.id,
          setNumber: setItem.set_number,
          weight: setItem.weight,
          reps: setItem.reps,
          rir: setItem.rir,
          setType: setItem.set_type,
        }))
      );

      const result = await createWorkoutWithSets({
        name: 'Active Workout',
        notes: null,
        startTime: workoutStartedAt,
        endTime: new Date().toISOString(),
        setDrafts,
      });

      Alert.alert('Workout saved', `Saved workout with ${result.insertedSetCount} sets.`);
      router.back();
    } catch (error) {
      Alert.alert('Unable to finish workout', getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} activeOpacity={0.85}>
            <Ionicons name="close" size={26} color={palette.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.timerText}>{timerLabel}</Text>

          <TouchableOpacity
            style={[styles.finishButton, isSubmitting && styles.finishButtonDisabled]}
            activeOpacity={0.85}
            onPress={handleFinishWorkout}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={palette.textPrimary} />
            ) : (
              <Text style={styles.finishButtonText}>Finish</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {activeExercises.length === 0 ? (
            <View style={styles.emptyWorkoutCard}>
              <Text style={styles.emptyWorkoutTitle}>No exercises yet</Text>
              <Text style={styles.emptyWorkoutSubtitle}>Add an exercise to start logging your sets.</Text>
            </View>
          ) : (
            activeExercises.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseCard}>
                <Text style={styles.exerciseTitle}>{exercise.exercise.name}</Text>

                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text style={[styles.headerLabel, styles.cellSet]}>Set</Text>
                  <Text style={[styles.headerLabel, styles.cellType]}>Type</Text>
                  <Text style={[styles.headerLabel, styles.cellKg]}>kg</Text>
                  <Text style={[styles.headerLabel, styles.cellReps]}>Reps</Text>
                  <Text style={[styles.headerLabel, styles.cellRir]}>RIR</Text>
                  <View style={styles.cellCheck}>
                    <Ionicons name="checkmark" size={15} color={palette.textMuted} />
                  </View>
                </View>

                {exercise.sets.map((setItem) => (
                  <View key={setItem.id} style={[styles.tableRow, setItem.completed && styles.completedRow]}>
                    <Text style={[styles.cellSet, styles.setNumberText]}>{setItem.set_number ?? '-'}</Text>

                    <TouchableOpacity
                      style={[styles.typePill, setItem.completed && styles.typePillCompleted]}
                      activeOpacity={0.85}
                      onPress={() => cycleSetType(exercise.id, setItem.id)}
                    >
                      <Text style={styles.typePillText}>{setItem.set_type ?? 'Working'}</Text>
                    </TouchableOpacity>

                    <TextInput
                      value={setItem.weightInput}
                      onChangeText={(value) => updateSetInput(exercise.id, setItem.id, 'weightInput', value)}
                      style={[styles.numericInput, styles.cellKg, setItem.completed && styles.numericInputCompleted]}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={palette.textMuted}
                    />

                    <TextInput
                      value={setItem.repsInput}
                      onChangeText={(value) => updateSetInput(exercise.id, setItem.id, 'repsInput', value)}
                      style={[styles.numericInput, styles.cellReps, setItem.completed && styles.numericInputCompleted]}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={palette.textMuted}
                    />

                    <TextInput
                      value={setItem.rirInput}
                      onChangeText={(value) => updateSetInput(exercise.id, setItem.id, 'rirInput', value)}
                      style={[styles.numericInput, styles.cellRir, setItem.completed && styles.numericInputCompleted]}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={palette.textMuted}
                    />

                    <TouchableOpacity
                      style={[styles.checkButton, setItem.completed && styles.checkButtonCompleted]}
                      activeOpacity={0.85}
                      onPress={() => toggleSetCompleted(exercise.id, setItem.id)}
                    >
                      <Ionicons
                        name={setItem.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={setItem.completed ? palette.accent : palette.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity style={styles.addSetButton} activeOpacity={0.88} onPress={() => addSet(exercise.id)}>
                  <Ionicons name="add" size={16} color={palette.textSecondary} />
                  <Text style={styles.addSetText}>Add Set</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>

        <View style={[styles.bottomActionArea, { bottom: insets.bottom + 12 }]}> 
          <TouchableOpacity
            style={styles.addExerciseButton}
            activeOpacity={0.9}
            onPress={() => setExercisePickerVisible(true)}
          >
            <Ionicons name="add" size={22} color={palette.textPrimary} />
            <Text style={styles.addExerciseText}>Add Exercise</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={exercisePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setExercisePickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setExercisePickerVisible(false)} />

          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Select Exercise</Text>
              <TouchableOpacity
                style={styles.modalCustomButton}
                activeOpacity={0.88}
                onPress={() => setCreateExerciseVisible(true)}
              >
                <Text style={styles.modalCustomButtonText}>+ Custom</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalHandle} />

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {isLoadingExercises ? (
                <View style={styles.modalStatusContainer}>
                  <ActivityIndicator size="small" color={palette.accent} />
                  <Text style={styles.modalStatusText}>Loading exercise catalog...</Text>
                </View>
              ) : exerciseLoadError ? (
                <View style={styles.modalStatusContainer}>
                  <Text style={styles.modalStatusTitle}>Unable to load exercises</Text>
                  <Text style={styles.modalStatusText}>{exerciseLoadError}</Text>
                  <TouchableOpacity
                    style={styles.modalRetryButton}
                    onPress={() => void loadExercises()}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.modalRetryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : catalogExercises.length === 0 ? (
                <View style={styles.modalStatusContainer}>
                  <Text style={styles.modalStatusTitle}>No exercises available</Text>
                  <Text style={styles.modalStatusText}>Create exercises to start building workouts.</Text>
                </View>
              ) : (
                catalogExercises.map((exercise) => (
                  <TouchableOpacity
                    key={exercise.id}
                    style={styles.modalExerciseRow}
                    activeOpacity={0.88}
                    onPress={() => addExercise(exercise)}
                  >
                    <View style={styles.modalExerciseTextWrap}>
                      <Text style={styles.modalExerciseName}>{exercise.name}</Text>
                      <Text style={styles.modalExerciseMeta}>
                        {exercise.muscle_group ?? 'General'} - {exercise.equipment ?? 'Bodyweight'}
                      </Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={22} color={palette.accent} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={createExerciseVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateExerciseVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setCreateExerciseVisible(false)} />

          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Create Exercise</Text>

            <TextInput
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              style={styles.modalInput}
              placeholder="Name"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
            />
            <TextInput
              value={newExerciseMuscleGroup}
              onChangeText={setNewExerciseMuscleGroup}
              style={styles.modalInput}
              placeholder="Muscle Group"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
            />
            <TextInput
              value={newExerciseEquipment}
              onChangeText={setNewExerciseEquipment}
              style={styles.modalInput}
              placeholder="Equipment"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setCreateExerciseVisible(false)}
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
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bgPrimary,
  },
  container: {
    flex: 1,
    backgroundColor: palette.bgPrimary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
  },
  timerText: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  finishButton: {
    backgroundColor: palette.accent,
    minHeight: 38,
    minWidth: 78,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  finishButtonDisabled: {
    opacity: 0.7,
  },
  finishButtonText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 150,
    gap: 12,
  },
  emptyWorkoutCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 18,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWorkoutTitle: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyWorkoutSubtitle: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  exerciseCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 12,
  },
  exerciseTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    columnGap: 4,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  tableHeaderRow: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 12,
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  headerLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  completedRow: {
    backgroundColor: '#10263F',
    borderRadius: 10,
  },
  cellSet: {
    width: 30,
    textAlign: 'center',
  },
  setNumberText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  cellType: {
    width: 80,
  },
  typePill: {
    width: 80,
    minHeight: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    backgroundColor: palette.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  typePillCompleted: {
    borderColor: palette.accent,
    backgroundColor: '#17345C',
  },
  typePillText: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  cellKg: {
    width: 48,
  },
  cellReps: {
    width: 48,
  },
  cellRir: {
    width: 44,
  },
  numericInput: {
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    backgroundColor: palette.inputBackground,
    color: palette.textPrimary,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 6,
  },
  numericInputCompleted: {
    borderColor: palette.accent,
    backgroundColor: '#17345C',
  },
  cellCheck: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButton: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 6,
  },
  checkButtonCompleted: {
    backgroundColor: '#17345C',
  },
  addSetButton: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 6,
  },
  addSetText: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  bottomActionArea: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  addExerciseButton: {
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
    shadowColor: palette.accent,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  addExerciseText: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: palette.overlay,
  },
  modalDismissArea: {
    flex: 1,
  },
  modalSheet: {
    maxHeight: '76%',
    backgroundColor: palette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: palette.border,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: palette.borderStrong,
    marginBottom: 12,
  },
  modalTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  modalCustomButton: {
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: palette.accent,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 4,
  },
  modalCustomButtonText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalList: {
    flexGrow: 0,
  },
  modalStatusContainer: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalStatusTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalStatusText: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    textAlign: 'center',
  },
  modalRetryButton: {
    marginTop: 12,
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  modalRetryButtonText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  modalExerciseRow: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalExerciseTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  modalExerciseName: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  modalExerciseMeta: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  modalInput: {
    backgroundColor: palette.inputBackground,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    color: palette.textPrimary,
    borderRadius: 12,
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
    borderRadius: 12,
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
    borderRadius: 12,
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
