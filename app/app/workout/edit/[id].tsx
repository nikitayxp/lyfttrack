import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import {
  getErrorMessage,
  getWorkoutDetails,
  type WorkoutDetails,
  type WorkoutSetType,
} from '@/services/workoutService';
import { updateWorkoutSets } from '@/services/sessionRepository';
import { formatRelativeTime } from '@/utils/dateUtils';
import {
  INPUT_LIMITS,
  sanitizeDecimalText,
  sanitizeIntegerText,
  sanitizeText,
  toSafeInteger,
  toSafeNumber,
} from '@/utils/inputValidation';

const palette = Colors.dark;
const SCREEN_BG = '#050A12';
const CARD_BG = '#111827';
const INPUT_BG = '#0F172A';

function resolveRouteWorkoutId(rawValue: string | string[] | undefined): string | null {
  if (!rawValue) {
    return null;
  }

  if (Array.isArray(rawValue)) {
    return rawValue[0]?.trim() || null;
  }

  return rawValue.trim() || null;
}

function formatSetType(setType: WorkoutSetType, t: (key: string) => unknown): string {
  if (setType === 'warmup') return String(t('workoutDetails.setTypeWarmup'));
  if (setType === 'drop') return String(t('workoutDetails.setTypeDrop'));
  if (setType === 'failure') return String(t('workoutDetails.setTypeFailure'));
  return String(t('workoutDetails.setTypeWork'));
}

type EditableSetDraft = {
  setId: string;
  setNumber: number | null;
  weightInput: string;
  repsInput: string;
  rirInput: string;
  setType: WorkoutSetType;
};

type EditableExerciseDraft = {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string | null;
  equipment: string | null;
  sets: EditableSetDraft[];
};

function buildExerciseDrafts(details: WorkoutDetails): EditableExerciseDraft[] {
  return details.exercises.map((exercise) => ({
    exerciseId: exercise.exercise_id,
    exerciseName: exercise.exercise_name,
    muscleGroup: exercise.muscle_group,
    equipment: exercise.equipment,
    sets: exercise.sets.map((setItem) => ({
      setId: setItem.id,
      setNumber: setItem.set_number,
      weightInput: setItem.weight === null ? '' : String(setItem.weight),
      repsInput: setItem.reps === null ? '' : String(setItem.reps),
      rirInput: setItem.rir === null ? '' : String(setItem.rir),
      setType: setItem.set_type,
    })),
  }));
}

export default function WorkoutEditScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const workoutId = useMemo(() => resolveRouteWorkoutId(params.id), [params.id]);

  const [details, setDetails] = useState<WorkoutDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [exerciseDrafts, setExerciseDrafts] = useState<EditableExerciseDraft[]>([]);
  const [feedback, setFeedback] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const loadDetails = useCallback(async () => {
    if (!workoutId) {
      setLoadError(t('workoutDetails.missingRouteId'));
      setDetails(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await getWorkoutDetails(workoutId);
      setDetails(result);
      setWorkoutName(result.name ?? 'Workout');
      setWorkoutNotes(result.notes ?? '');
      setExerciseDrafts(buildExerciseDrafts(result));
    } catch (error) {
      setDetails(null);
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [t, workoutId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const updateSetInput = useCallback(
    (exerciseId: string, setId: string, field: 'weightInput' | 'repsInput' | 'rirInput', value: string) => {
      const sanitizedValue = field === 'weightInput' ? sanitizeDecimalText(value) : sanitizeIntegerText(value);

      setExerciseDrafts((currentValue) =>
        currentValue.map((exercise) => {
          if (exercise.exerciseId !== exerciseId) {
            return exercise;
          }

          return {
            ...exercise,
            sets: exercise.sets.map((setItem) =>
              setItem.setId === setId
                ? {
                    ...setItem,
                    [field]: sanitizedValue,
                  }
                : setItem
            ),
          };
        })
      );
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!workoutId || !details || isSaving) {
      return;
    }

    const normalizedWorkoutName =
      sanitizeText(workoutName, {
        maxLength: INPUT_LIMITS.nameMax,
        allowEmpty: true,
      }) ?? 'Workout';

    const normalizedWorkoutNotes = sanitizeText(workoutNotes, {
      maxLength: INPUT_LIMITS.notesMax,
      allowEmpty: true,
    });

    const setPatches = exerciseDrafts.flatMap((exercise) =>
      exercise.sets.map((setItem) => ({
        setId: setItem.setId,
        weight: toSafeNumber(setItem.weightInput, {
          min: 0,
          max: INPUT_LIMITS.weightMax,
          decimals: 2,
        }),
        reps: toSafeInteger(setItem.repsInput, {
          min: 0,
          max: INPUT_LIMITS.repsMax,
        }),
        rir: toSafeInteger(setItem.rirInput, {
          min: 0,
          max: INPUT_LIMITS.rirMax,
        }),
      }))
    );

    setIsSaving(true);
    setFeedback(null);

    try {
      await updateWorkoutSets({
        workoutId,
        workoutName: normalizedWorkoutName,
        workoutNotes: normalizedWorkoutNotes,
        setPatches,
      });

      setFeedback({ message: t('workoutDetails.editSaveSuccess'), type: 'success' });
      router.replace(`/workout/${encodeURIComponent(workoutId)}` as any);
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : t('workoutDetails.editSaveError'),
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [details, exerciseDrafts, isSaving, t, workoutId, workoutName, workoutNotes]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.86} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={palette.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{t('workoutDetails.editScreenTitle')}</Text>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          activeOpacity={0.88}
          onPress={() => void handleSave()}
          disabled={isSaving || isLoading || !details}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={palette.textPrimary} />
          ) : (
            <Text style={styles.saveButtonText}>{t('workoutDetails.editSaveAction')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.statusWrap}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.statusText}>{t('workoutDetails.loadingDetails')}</Text>
        </View>
      ) : loadError ? (
        <View style={styles.statusWrap}>
          <Text style={styles.statusTitle}>{t('workoutDetails.loadErrorTitle')}</Text>
          <Text style={styles.statusText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryButton} activeOpacity={0.88} onPress={() => void loadDetails()}>
            <Text style={styles.retryButtonText}>{t('workoutDetails.retryAction')}</Text>
          </TouchableOpacity>
        </View>
      ) : !details ? (
        <View style={styles.statusWrap}>
          <Text style={styles.statusTitle}>{t('workoutDetails.unavailableTitle')}</Text>
          <Text style={styles.statusText}>{t('workoutDetails.unavailableDescription')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {feedback ? (
            <View style={[styles.feedbackBanner, feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>
              <Ionicons
                name={feedback.type === 'error' ? 'alert-circle' : 'checkmark-circle'}
                size={16}
                color={feedback.type === 'error' ? '#EF4444' : '#10B981'}
              />
              <Text style={styles.feedbackText}>{feedback.message}</Text>
            </View>
          ) : null}

          <View style={styles.heroCard}>
            <Text style={styles.sectionTitle}>{t('workoutDetails.editScreenTitle')}</Text>
            <Text style={styles.sectionMeta}>{formatRelativeTime(details.start_time)}</Text>

            <Text style={styles.inputLabel}>{t('workoutDetails.editWorkoutNameLabel')}</Text>
            <TextInput
              value={workoutName}
              onChangeText={(value) => setWorkoutName(value.substring(0, INPUT_LIMITS.nameMax))}
              style={styles.textInput}
              placeholder={t('workoutDetails.editWorkoutNameLabel')}
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
              maxLength={INPUT_LIMITS.nameMax}
            />

            <Text style={styles.inputLabel}>{t('workoutDetails.editWorkoutNotesLabel')}</Text>
            <TextInput
              value={workoutNotes}
              onChangeText={(value) => setWorkoutNotes(value.substring(0, INPUT_LIMITS.notesMax))}
              style={[styles.textInput, styles.notesInput]}
              placeholder={t('workoutDetails.editWorkoutNotesPlaceholder')}
              placeholderTextColor={palette.textMuted}
              multiline
              textAlignVertical="top"
              maxLength={INPUT_LIMITS.notesMax}
            />
          </View>

          {exerciseDrafts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('workoutDetails.noSetsTitle')}</Text>
              <Text style={styles.emptyText}>{t('workoutDetails.noSetsDescription')}</Text>
            </View>
          ) : (
            exerciseDrafts.map((exercise) => (
              <View key={exercise.exerciseId} style={styles.exerciseCard}>
                <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                <Text style={styles.exerciseMeta}>
                  {(exercise.muscleGroup ?? t('exercise.general')) + ' - ' + (exercise.equipment ?? t('exercise.bodyweight'))}
                </Text>

                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text style={[styles.headerCell, styles.cellSet]}>{t('workoutDetails.tableSet')}</Text>
                  <Text style={[styles.headerCell, styles.cellKg]}>kg</Text>
                  <Text style={[styles.headerCell, styles.cellReps]}>{t('workoutDetails.tableReps')}</Text>
                  <Text style={[styles.headerCell, styles.cellRir]}>{t('workoutDetails.tableRir')}</Text>
                  <Text style={[styles.headerCell, styles.cellType]}>{t('workoutDetails.tableType')}</Text>
                </View>

                {exercise.sets.map((setItem) => (
                  <View key={setItem.setId} style={styles.tableRow}>
                    <Text style={[styles.valueCell, styles.cellSet]}>{setItem.setNumber ?? '-'}</Text>
                    <TextInput
                      value={setItem.weightInput}
                      onChangeText={(value) => updateSetInput(exercise.exerciseId, setItem.setId, 'weightInput', value)}
                      style={[styles.numericInput, styles.cellKg]}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={palette.textMuted}
                    />
                    <TextInput
                      value={setItem.repsInput}
                      onChangeText={(value) => updateSetInput(exercise.exerciseId, setItem.setId, 'repsInput', value)}
                      style={[styles.numericInput, styles.cellReps]}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={palette.textMuted}
                    />
                    <TextInput
                      value={setItem.rirInput}
                      onChangeText={(value) => updateSetInput(exercise.exerciseId, setItem.setId, 'rirInput', value)}
                      style={[styles.numericInput, styles.cellRir]}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={palette.textMuted}
                    />
                    <Text style={[styles.valueCell, styles.cellType]}>{formatSetType(setItem.setType, t)}</Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    backgroundColor: SCREEN_BG,
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  saveButton: {
    minHeight: 36,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.72,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 36,
    rowGap: 12,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: CARD_BG,
    padding: 14,
    rowGap: 10,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionMeta: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  textInput: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: INPUT_BG,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  notesInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    columnGap: 8,
  },
  feedbackError: {
    backgroundColor: '#EF444415',
    borderColor: '#EF444430',
  },
  feedbackSuccess: {
    backgroundColor: '#10B98115',
    borderColor: '#10B98130',
  },
  feedbackText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  exerciseCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: CARD_BG,
    padding: 14,
    rowGap: 10,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  exerciseMeta: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tableHeaderRow: {
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#253041',
    marginTop: 2,
  },
  headerCell: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  valueCell: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  numericInput: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: INPUT_BG,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  cellSet: {
    width: 44,
    flexShrink: 0,
  },
  cellKg: {
    width: 66,
    flexShrink: 0,
  },
  cellReps: {
    width: 66,
    flexShrink: 0,
  },
  cellRir: {
    width: 66,
    flexShrink: 0,
  },
  cellType: {
    flex: 1,
    minWidth: 72,
    textAlign: 'right',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: CARD_BG,
    padding: 14,
    rowGap: 6,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  statusWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    rowGap: 10,
  },
  statusTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
