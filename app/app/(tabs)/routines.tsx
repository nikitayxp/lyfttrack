import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
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
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/theme';
import { getEquipmentTranslationKey, getMuscleTranslationKey } from '@/constants/exerciseCatalog';
import {
  createRoutine,
  getErrorMessage,
  getExercisesCatalog,
  getRoutines,
  type RoutineSummary,
} from '@/services/workoutService';
import type { Tables } from '@/types/database';
import { INPUT_LIMITS, sanitizeText } from '@/utils/inputValidation';

const palette = Colors.dark;
const cardLayoutTransition = LinearTransition.springify().damping(16).stiffness(180);

type ExerciseRow = Tables<'exercises'>;

export default function RoutinesScreen() {
  const { t } = useTranslation();
  const isWeb = Platform.OS === 'web';
  const modalAnimationType: 'fade' | 'slide' = isWeb ? 'fade' : 'slide';
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [isLoadingRoutines, setIsLoadingRoutines] = useState(true);
  const [routinesError, setRoutinesError] = useState<string | null>(null);

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isCreatingRoutine, setIsCreatingRoutine] = useState(false);
  const [routineNameInput, setRoutineNameInput] = useState('');
  const [routineNotesInput, setRoutineNotesInput] = useState('');
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);

  const [catalogExercises, setCatalogExercises] = useState<ExerciseRow[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [animationEpoch, setAnimationEpoch] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAnimationEpoch((currentValue) => currentValue + 1);
    }, [])
  );

  const loadRoutines = useCallback(async () => {
    setIsLoadingRoutines(true);
    setRoutinesError(null);

    try {
      const routineList = await getRoutines();
      setRoutines(routineList);
    } catch (error) {
      setRoutinesError(getErrorMessage(error));
    } finally {
      setIsLoadingRoutines(false);
    }
  }, []);

  const loadCatalogExercises = useCallback(async () => {
    setIsLoadingCatalog(true);
    setCatalogError(null);

    try {
      const exercises = await getExercisesCatalog();
      setCatalogExercises(exercises);
    } catch (error) {
      setCatalogError(getErrorMessage(error));
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    void loadRoutines();
  }, [loadRoutines]);

  useEffect(() => {
    if (!isCreateModalVisible) {
      return;
    }

    if (catalogExercises.length > 0 && !catalogError) {
      return;
    }

    void loadCatalogExercises();
  }, [isCreateModalVisible, catalogExercises.length, catalogError, loadCatalogExercises]);

  const selectionOrder = useMemo(() => {
    return new Map(selectedExerciseIds.map((exerciseId, index) => [exerciseId, index + 1]));
  }, [selectedExerciseIds]);

  const getExerciseMuscleLabel = useCallback((exercise: ExerciseRow) => {
    const muscleKey = getMuscleTranslationKey(exercise.muscle_group);
    return muscleKey ? t(muscleKey) : t('exercise.general');
  }, [t]);

  const getExerciseEquipmentLabel = useCallback((exercise: ExerciseRow) => {
    const equipmentKey = getEquipmentTranslationKey(exercise.equipment);
    return equipmentKey ? t(equipmentKey) : t('exercise.equipment.bodyweight');
  }, [t]);

  function handleStartRoutine(routineId: string) {
    router.push({ pathname: '/workout/active', params: { routineId } } as any);
  }

  function toggleExerciseSelection(exerciseId: string) {
    setSelectedExerciseIds((currentValue) => {
      if (currentValue.includes(exerciseId)) {
        return currentValue.filter((id) => id !== exerciseId);
      }

      return [...currentValue, exerciseId];
    });
  }

  function resetRoutineForm() {
    setRoutineNameInput('');
    setRoutineNotesInput('');
    setSelectedExerciseIds([]);
  }

  async function handleCreateRoutine() {
    const normalizedName = sanitizeText(routineNameInput, {
      maxLength: INPUT_LIMITS.nameMax,
      allowEmpty: false,
    });
    const normalizedNotes = sanitizeText(routineNotesInput, {
      maxLength: INPUT_LIMITS.notesMax,
      allowEmpty: true,
    });

    if (!normalizedName) {
      Alert.alert(t('validation.title'), t('validation.routineNameRequired'));
      return;
    }

    if (selectedExerciseIds.length === 0) {
      Alert.alert(t('validation.title'), t('validation.routineExerciseRequired'));
      return;
    }

    setIsCreatingRoutine(true);

    try {
      await createRoutine(normalizedName, normalizedNotes, selectedExerciseIds);
      setIsCreateModalVisible(false);
      resetRoutineForm();
      await loadRoutines();
      Alert.alert(t('routines.createRoutineSuccessTitle'), t('routines.createRoutineSuccessDescription'));
    } catch (error) {
      Alert.alert(t('routines.createRoutineError'), getErrorMessage(error));
    } finally {
      setIsCreatingRoutine(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Animated.View
        key={`new-routine-${animationEpoch}`}
        entering={FadeInUp.duration(320)}
        layout={cardLayoutTransition}
      >
        <TouchableOpacity
          style={styles.newRoutineButton}
          activeOpacity={0.9}
          onPress={() => setIsCreateModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.newRoutineButtonText}>{t('routines.newRoutine')}</Text>
        </TouchableOpacity>
      </Animated.View>

      <Text style={styles.sectionTitle}>{t('routines.yourRoutines')}</Text>
      {isLoadingRoutines ? (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.statusText}>{t('routines.loadingRoutines')}</Text>
        </View>
      ) : routinesError ? (
        <View style={styles.statusContainer}>
          <Text style={styles.statusTitle}>{t('routines.unableToLoadRoutines')}</Text>
          <Text style={styles.statusText}>{routinesError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadRoutines()} activeOpacity={0.88}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : routines.length === 0 ? (
        <View style={styles.statusContainer}>
          <Text style={styles.statusTitle}>{t('routines.noRoutinesTitle')}</Text>
          <Text style={styles.statusText}>{t('routines.noRoutinesDescription')}</Text>
        </View>
      ) : (
        routines.map((routine, index) => (
          <Animated.View
            key={`${routine.id}-${animationEpoch}`}
            entering={FadeInDown.delay(Math.min(index * 45, 280)).duration(320)}
            layout={cardLayoutTransition}
          >
            <View style={styles.routineCard}>
              <View style={styles.cardHead}>
                <Text style={styles.routineName}>{routine.name}</Text>
                <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
              </View>
              <Text style={styles.routineMeta}>{`${routine.exerciseCount} ${t('routines.exercises').toLowerCase()}`}</Text>
              <Text style={styles.routineNotes}>{routine.notes ?? t('routines.noNotes')}</Text>

              <TouchableOpacity
                style={styles.startRoutineButton}
                activeOpacity={0.88}
                onPress={() => handleStartRoutine(routine.id)}
              >
                <Ionicons name="play" size={15} color="#FFFFFF" />
                <Text style={styles.startRoutineButtonText}>{t('routines.startRoutine')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ))
      )}

      <Modal
        visible={isCreateModalVisible}
        transparent
        animationType={modalAnimationType}
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <View style={[styles.modalBackdrop, isWeb && styles.modalBackdropWeb]}>
          <Pressable style={styles.modalDismissArea} onPress={() => setIsCreateModalVisible(false)} />

          <View style={[styles.modalSheet, isWeb && styles.modalSheetWeb]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('routines.createRoutine')}</Text>

            <TextInput
              value={routineNameInput}
              onChangeText={(value) => setRoutineNameInput(value.substring(0, INPUT_LIMITS.nameMax))}
              style={styles.modalInput}
              placeholder={t('routines.routineName')}
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
              maxLength={INPUT_LIMITS.nameMax}
            />
            <TextInput
              value={routineNotesInput}
              onChangeText={(value) => setRoutineNotesInput(value.substring(0, INPUT_LIMITS.notesMax))}
              style={[styles.modalInput, styles.modalNotesInput]}
              placeholder={t('routines.notesOptional')}
              placeholderTextColor={palette.textMuted}
              autoCapitalize="sentences"
              multiline
              textAlignVertical="top"
              maxLength={INPUT_LIMITS.notesMax}
            />

            <Text style={styles.modalSectionTitle}>{`${t('routines.exercises')} (${selectedExerciseIds.length})`}</Text>

            {isLoadingCatalog ? (
              <View style={styles.modalStatusContainer}>
                <ActivityIndicator size="small" color={palette.accent} />
                <Text style={styles.modalStatusText}>{t('routines.loadingCatalog')}</Text>
              </View>
            ) : catalogError ? (
              <View style={styles.modalStatusContainer}>
                <Text style={styles.modalStatusTitle}>{t('routines.unableToLoadExercises')}</Text>
                <Text style={styles.modalStatusText}>{catalogError}</Text>
                <TouchableOpacity
                  style={styles.modalRetryButton}
                  onPress={() => void loadCatalogExercises()}
                  activeOpacity={0.88}
                >
                  <Text style={styles.modalRetryButtonText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : catalogExercises.length === 0 ? (
              <View style={styles.modalStatusContainer}>
                <Text style={styles.modalStatusTitle}>{t('routines.noExercisesAvailable')}</Text>
                <Text style={styles.modalStatusText}>{t('routines.noExercisesHint')}</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {catalogExercises.map((exercise, index) => {
                  const selectedOrder = selectionOrder.get(exercise.id);
                  const isSelected = selectedOrder !== undefined;

                  return (
                    <Animated.View
                      key={`${exercise.id}-${animationEpoch}`}
                      entering={FadeInDown.delay(Math.min(index * 25, 180)).duration(260)}
                      layout={cardLayoutTransition}
                    >
                      <TouchableOpacity
                        style={[styles.modalExerciseRow, isSelected && styles.modalExerciseRowSelected]}
                        activeOpacity={0.88}
                        onPress={() => toggleExerciseSelection(exercise.id)}
                      >
                        <View style={styles.modalExerciseTextWrap}>
                          <Text style={styles.modalExerciseName}>{exercise.name}</Text>
                          <Text style={styles.modalExerciseMeta}>
                            {getExerciseMuscleLabel(exercise)} - {getExerciseEquipmentLabel(exercise)}
                          </Text>
                        </View>

                        {isSelected ? (
                          <View style={styles.orderBadge}>
                            <Text style={styles.orderBadgeText}>{selectedOrder}</Text>
                          </View>
                        ) : (
                          <Ionicons name="add-circle-outline" size={22} color={palette.accent} />
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsCreateModalVisible(false)}
                activeOpacity={0.88}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalCreateButton, isCreatingRoutine && styles.modalCreateButtonDisabled]}
                onPress={() => void handleCreateRoutine()}
                activeOpacity={0.88}
                disabled={isCreatingRoutine}
              >
                {isCreatingRoutine ? (
                  <ActivityIndicator size="small" color={palette.textPrimary} />
                ) : (
                  <Text style={styles.modalCreateButtonText}>{t('routines.createRoutine')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    borderRadius: 16,
    backgroundColor: palette.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
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
  startRoutineButton: {
    marginTop: 12,
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
  },
  startRoutineButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
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
    backgroundColor: 'rgba(0, 0, 0, 0.74)',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalSheet: {
    maxHeight: '82%',
    backgroundColor: palette.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: palette.border,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 20,
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
  modalNotesInput: {
    minHeight: 84,
  },
  modalSectionTitle: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 2,
  },
  modalList: {
    maxHeight: 260,
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
    borderRadius: 16,
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
    borderRadius: 16,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalExerciseRowSelected: {
    borderColor: palette.accent,
    backgroundColor: '#17345C',
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
  orderBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  orderBadgeText: {
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 10,
    marginTop: 10,
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