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
import {
  EXERCISE_EQUIPMENT_OPTIONS,
  EXERCISE_EQUIPMENT_TRANSLATION_KEY,
  EXERCISE_MUSCLE_OPTIONS,
  EXERCISE_MUSCLE_TRANSLATION_KEY,
  type ExerciseEquipmentKey,
  type ExerciseMuscleKey,
  getEquipmentTranslationKey,
  getMuscleTranslationKey,
} from '@/constants/exerciseCatalog';
import { usePreferences } from '@/context/PreferencesContext';
import {
  getTemplates,
  saveTemplate,
  startWorkoutFromTemplate,
  type TemplateSummary,
} from '@/services/templateService';
import {
  createExercise,
  createRoutine,
  getErrorMessage,
  getExercisesCatalog,
  getRoutines,
  type RoutineSummary,
} from '@/services/workoutService';
import type { Tables } from '@/types/database';
import { EmptyState } from '@/components/common/EmptyState';
import { INPUT_LIMITS, sanitizeText } from '@/utils/inputValidation';
import { getLocalizedExerciseMuscle, getLocalizedExerciseName } from '@/utils/exerciseLocalization';

const palette = Colors.dark;
const CARD_BG = '#111827';
const cardLayoutTransition = LinearTransition.springify().damping(16).stiffness(180);

type ExerciseRow = Tables<'exercises'>;

type WorkoutMode = 'start' | 'templates' | 'exercises';

function summarizeExercises(exerciseNames: string[], emptyLabel: string): string {
  if (exerciseNames.length === 0) {
    return emptyLabel;
  }

  const preview = exerciseNames.slice(0, 3).join(', ');
  return exerciseNames.length > 3 ? `${preview}...` : preview;
}

export default function WorkoutScreen() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const isWeb = Platform.OS === 'web';
  const modalAnimationType: 'fade' | 'slide' = isWeb ? 'fade' : 'slide';
  const [activeMode, setActiveMode] = useState<WorkoutMode>('start');

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null);

  const [isCreateTemplateModalVisible, setIsCreateTemplateModalVisible] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [selectedTemplateExercises, setSelectedTemplateExercises] = useState<string[]>([]);

  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [isLoadingRoutines, setIsLoadingRoutines] = useState(false);
  const [hasLoadedRoutines, setHasLoadedRoutines] = useState(false);
  const [routinesError, setRoutinesError] = useState<string | null>(null);
  const [isCreateRoutineModalVisible, setIsCreateRoutineModalVisible] = useState(false);
  const [isCreatingRoutine, setIsCreatingRoutine] = useState(false);
  const [routineNameInput, setRoutineNameInput] = useState('');
  const [routineNotesInput, setRoutineNotesInput] = useState('');
  const [selectedRoutineExerciseIds, setSelectedRoutineExerciseIds] = useState<string[]>([]);

  const [catalogExercises, setCatalogExercises] = useState<ExerciseRow[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [hasLoadedCatalog, setHasLoadedCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [exerciseQuery, setExerciseQuery] = useState('');
  const [isCreateExerciseModalVisible, setIsCreateExerciseModalVisible] = useState(false);
  const [isCreatingExercise, setIsCreatingExercise] = useState(false);
  const [exerciseNameInput, setExerciseNameInput] = useState('');
  const [selectedMuscleKey, setSelectedMuscleKey] = useState<ExerciseMuscleKey | null>(null);
  const [selectedEquipmentKey, setSelectedEquipmentKey] = useState<ExerciseEquipmentKey | null>(null);
  const [animationEpoch, setAnimationEpoch] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAnimationEpoch((currentValue) => currentValue + 1);
    }, [])
  );

  const selectionOrder = useMemo(() => {
    return new Map(selectedTemplateExercises.map((exerciseId, index) => [exerciseId, index + 1]));
  }, [selectedTemplateExercises]);

  const routineSelectionOrder = useMemo(() => {
    return new Map(selectedRoutineExerciseIds.map((exerciseId, index) => [exerciseId, index + 1]));
  }, [selectedRoutineExerciseIds]);

  const getDisplayExerciseName = useCallback((exercise: ExerciseRow) => {
    return getLocalizedExerciseName(exercise, language);
  }, [language]);

  const getDisplayMuscle = useCallback((exercise: ExerciseRow) => {
    const translatedKey = getMuscleTranslationKey(exercise.muscle_group);

    if (translatedKey) {
      return t(translatedKey);
    }

    return getLocalizedExerciseMuscle(exercise, language) ?? t('exercise.general');
  }, [language, t]);

  const getDisplayEquipment = useCallback((exercise: ExerciseRow) => {
    const translatedKey = getEquipmentTranslationKey(exercise.equipment);

    if (translatedKey) {
      return t(translatedKey);
    }

    return exercise.equipment ?? t('exercise.bodyweight');
  }, [t]);

  const groupedExercises = useMemo(() => {
    const normalizedQuery = exerciseQuery.trim().toLowerCase();

    const filtered = normalizedQuery
      ? catalogExercises.filter((exercise) => {
          const byName = getDisplayExerciseName(exercise).toLowerCase().includes(normalizedQuery);
          const byMuscle = getDisplayMuscle(exercise).toLowerCase().includes(normalizedQuery);
          return byName || byMuscle;
        })
      : catalogExercises;

    const groups = filtered.reduce<Record<string, ExerciseRow[]>>((acc, exercise) => {
      const groupKey = getDisplayMuscle(exercise);

      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }

      acc[groupKey].push(exercise);
      return acc;
    }, {});

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [catalogExercises, exerciseQuery, getDisplayExerciseName, getDisplayMuscle]);

  const shouldLoadCatalog = useMemo(() => {
    return (
      activeMode === 'exercises' ||
      isCreateTemplateModalVisible ||
      isCreateRoutineModalVisible ||
      isCreateExerciseModalVisible
    );
  }, [activeMode, isCreateExerciseModalVisible, isCreateRoutineModalVisible, isCreateTemplateModalVisible]);

  const loadTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    setTemplatesError(null);

    try {
      const templateList = await getTemplates();
      setTemplates(templateList);
    } catch (error) {
      setTemplatesError(getErrorMessage(error));
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  const loadRoutines = useCallback(async () => {
    setIsLoadingRoutines(true);
    setRoutinesError(null);

    try {
      const routineList = await getRoutines();
      setRoutines(routineList);
      setHasLoadedRoutines(true);
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
      setHasLoadedCatalog(true);
    } catch (error) {
      setCatalogError(getErrorMessage(error));
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (activeMode !== 'templates' || hasLoadedRoutines || isLoadingRoutines) {
      return;
    }

    void loadRoutines();
  }, [activeMode, hasLoadedRoutines, isLoadingRoutines, loadRoutines]);

  useEffect(() => {
    if (!shouldLoadCatalog) {
      return;
    }

    if (catalogExercises.length > 0 || hasLoadedCatalog || catalogError || isLoadingCatalog) {
      return;
    }

    void loadCatalogExercises();
  }, [
    catalogError,
    catalogExercises.length,
    hasLoadedCatalog,
    isLoadingCatalog,
    loadCatalogExercises,
    shouldLoadCatalog,
  ]);

  function handleStartEmptyWorkout() {
    router.push('/workout/active' as any);
  }

  async function handleStartTemplate(templateId: string) {
    setStartingTemplateId(templateId);

    try {
      await startWorkoutFromTemplate(templateId);
    } catch (error) {
      Alert.alert(t('workout.unableToStartTemplate'), getErrorMessage(error));
    } finally {
      setStartingTemplateId(null);
    }
  }

  function handleStartRoutine(routineId: string) {
    router.push({ pathname: '/workout/active', params: { routineId } } as any);
  }

  const openCreateTemplateFlow = useCallback(() => {
    setActiveMode('templates');
    setIsCreateTemplateModalVisible(true);
  }, []);

  function toggleExerciseSelection(exerciseId: string) {
    setSelectedTemplateExercises((currentValue) => {
      if (currentValue.includes(exerciseId)) {
        return currentValue.filter((id) => id !== exerciseId);
      }

      return [...currentValue, exerciseId];
    });
  }

  function toggleRoutineExerciseSelection(exerciseId: string) {
    setSelectedRoutineExerciseIds((currentValue) => {
      if (currentValue.includes(exerciseId)) {
        return currentValue.filter((id) => id !== exerciseId);
      }

      return [...currentValue, exerciseId];
    });
  }

  function resetTemplateForm() {
    setTemplateNameInput('');
    setSelectedTemplateExercises([]);
  }

  function resetRoutineForm() {
    setRoutineNameInput('');
    setRoutineNotesInput('');
    setSelectedRoutineExerciseIds([]);
  }

  function resetExerciseForm() {
    setExerciseNameInput('');
    setSelectedMuscleKey(null);
    setSelectedEquipmentKey(null);
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

    if (selectedRoutineExerciseIds.length === 0) {
      Alert.alert(t('validation.title'), t('validation.routineExerciseRequired'));
      return;
    }

    setIsCreatingRoutine(true);

    try {
      await createRoutine(normalizedName, normalizedNotes, selectedRoutineExerciseIds);
      setIsCreateRoutineModalVisible(false);
      resetRoutineForm();
      setHasLoadedRoutines(false);
      await loadRoutines();
      Alert.alert(t('routines.createRoutineSuccessTitle'), t('routines.createRoutineSuccessDescription'));
    } catch (error) {
      Alert.alert(t('routines.createRoutineError'), getErrorMessage(error));
    } finally {
      setIsCreatingRoutine(false);
    }
  }

  async function handleCreateExercise() {
    const normalizedName = sanitizeText(exerciseNameInput, {
      maxLength: INPUT_LIMITS.nameMax,
      allowEmpty: false,
    });

    if (!normalizedName) {
      Alert.alert(t('validation.title'), t('validation.exerciseNameRequired'));
      return;
    }

    if (!selectedMuscleKey) {
      Alert.alert(t('validation.title'), t('validation.selectMuscleGroup'));
      return;
    }

    if (!selectedEquipmentKey) {
      Alert.alert(t('validation.title'), t('validation.selectEquipment'));
      return;
    }

    setIsCreatingExercise(true);

    try {
      await createExercise({
        name: normalizedName,
        muscleGroup: selectedMuscleKey,
        equipment: selectedEquipmentKey,
      });

      setIsCreateExerciseModalVisible(false);
      resetExerciseForm();
      setHasLoadedCatalog(false);
      await loadCatalogExercises();
      Alert.alert(t('exercise.success.createdTitle'), t('exercise.success.createdDescription'));
    } catch (error) {
      Alert.alert(t('exercise.errors.create'), getErrorMessage(error));
    } finally {
      setIsCreatingExercise(false);
    }
  }

  async function handleCreateTemplate() {
    const normalizedName = sanitizeText(templateNameInput, {
      maxLength: INPUT_LIMITS.nameMax,
      allowEmpty: false,
    });

    if (!normalizedName) {
      Alert.alert(t('validation.title'), t('validation.templateNameRequired'));
      return;
    }

    if (selectedTemplateExercises.length === 0) {
      Alert.alert(t('validation.title'), t('validation.templateExerciseRequired'));
      return;
    }

    setIsSavingTemplate(true);

    try {
      await saveTemplate(normalizedName, selectedTemplateExercises);
      setIsCreateTemplateModalVisible(false);
      resetTemplateForm();
      await loadTemplates();
      Alert.alert(t('workout.templateSavedTitle'), t('workout.templateSavedDescription'));
    } catch (error) {
      Alert.alert(t('workout.unableToCreateTemplate'), getErrorMessage(error));
    } finally {
      setIsSavingTemplate(false);
    }
  }

  const modeLabelMap: Record<WorkoutMode, string> = {
    start: t('workout.startModeLabel'),
    templates: t('workout.templatesModeLabel'),
    exercises: t('workout.exercisesModeLabel'),
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('workout.title')}</Text>
      <Text style={styles.subtitle}>{t('workout.subtitle')}</Text>

      <View style={styles.modeSwitchRow}>
        {(Object.keys(modeLabelMap) as WorkoutMode[]).map((mode) => {
          const isActive = activeMode === mode;

          return (
            <TouchableOpacity
              key={mode}
              style={[styles.modeChip, isActive && styles.modeChipActive]}
              activeOpacity={0.9}
              onPress={() => setActiveMode(mode)}
            >
              <Text style={[styles.modeChipText, isActive && styles.modeChipTextActive]}>{modeLabelMap[mode]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeMode === 'start' ? (
        <>
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.9} onPress={handleStartEmptyWorkout}>
            <Ionicons name="play" size={22} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>{t('workout.startEmptyWorkout')}</Text>
          </TouchableOpacity>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('workout.quickStartTemplates')}</Text>
            <TouchableOpacity
              style={styles.createTemplateButton}
              activeOpacity={0.88}
              onPress={() => setActiveMode('templates')}
            >
              <Ionicons name="layers-outline" size={16} color="#FFFFFF" />
              <Text style={styles.createTemplateButtonText}>{t('workout.openLibrary')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionCaption}>{t('workout.templatesCaption')}</Text>

          <View style={styles.quickStartSection}>
            {isLoadingTemplates ? (
              <View style={styles.statusContainer}>
                <ActivityIndicator size="small" color={palette.accent} />
                <Text style={styles.statusText}>{t('workout.loadingTemplates')}</Text>
              </View>
            ) : templatesError ? (
              <View style={styles.statusContainer}>
                <Text style={styles.statusTitle}>{t('workout.unableToLoadTemplates')}</Text>
                <Text style={styles.statusText}>{templatesError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => void loadTemplates()} activeOpacity={0.88}>
                  <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : templates.length === 0 ? (
              <EmptyState
                icon="layers-outline"
                title={t('workout.noTemplatesTitle')}
                description={t('workout.noTemplatesDescription')}
                actionLabel={t('workout.createTemplate')}
                onActionPress={openCreateTemplateFlow}
                containerStyle={styles.statusContainer}
                descriptionStyle={styles.statusText}
              />
            ) : (
              templates.map((template, index) => (
                <Animated.View
                  key={`${template.id}-${animationEpoch}`}
                  entering={FadeInDown.delay(Math.min(index * 45, 260)).duration(320)}
                  layout={cardLayoutTransition}
                >
                  <TouchableOpacity
                    style={styles.quickStartCard}
                    activeOpacity={0.88}
                    onPress={() => void handleStartTemplate(template.id)}
                    disabled={startingTemplateId !== null}
                  >
                    <View style={styles.quickStartCardTextWrap}>
                      <Text style={styles.quickStartTitle}>{template.name}</Text>
                      <Text style={styles.quickStartMeta}>{`${template.exerciseCount} ${t('workout.templateExercises').toLowerCase()}`}</Text>
                      <Text style={styles.quickStartSummary}>{summarizeExercises(template.exerciseNames, t('workout.noExercisesSummary'))}</Text>
                    </View>

                    {startingTemplateId === template.id ? (
                      <ActivityIndicator size="small" color={palette.accent} />
                    ) : (
                      <Ionicons name="play-circle-outline" size={20} color={palette.accent} />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              ))
            )}
          </View>
        </>
      ) : null}

      {activeMode === 'templates' ? (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('workout.templates')}</Text>
            <TouchableOpacity
              style={styles.createTemplateButton}
              activeOpacity={0.88}
              onPress={() => setIsCreateTemplateModalVisible(true)}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.createTemplateButtonText}>{t('workout.createTemplate')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionCaption}>{t('workout.templatesCaption')}</Text>

          <View style={styles.quickStartSection}>
            {isLoadingTemplates ? (
              <View style={styles.statusContainer}>
                <ActivityIndicator size="small" color={palette.accent} />
                <Text style={styles.statusText}>{t('workout.loadingTemplates')}</Text>
              </View>
            ) : templatesError ? (
              <View style={styles.statusContainer}>
                <Text style={styles.statusTitle}>{t('workout.unableToLoadTemplates')}</Text>
                <Text style={styles.statusText}>{templatesError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => void loadTemplates()} activeOpacity={0.88}>
                  <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : templates.length === 0 ? (
              <EmptyState
                icon="layers-outline"
                title={t('workout.noTemplatesTitle')}
                description={t('workout.noTemplatesDescription')}
                actionLabel={t('workout.createTemplate')}
                onActionPress={openCreateTemplateFlow}
                containerStyle={styles.statusContainer}
                descriptionStyle={styles.statusText}
              />
            ) : (
              templates.map((template, index) => (
                <Animated.View
                  key={`${template.id}-${animationEpoch}`}
                  entering={FadeInDown.delay(Math.min(index * 45, 260)).duration(320)}
                  layout={cardLayoutTransition}
                >
                  <TouchableOpacity
                    style={styles.quickStartCard}
                    activeOpacity={0.88}
                    onPress={() => void handleStartTemplate(template.id)}
                    disabled={startingTemplateId !== null}
                  >
                    <View style={styles.quickStartCardTextWrap}>
                      <Text style={styles.quickStartTitle}>{template.name}</Text>
                      <Text style={styles.quickStartMeta}>{`${template.exerciseCount} ${t('workout.templateExercises').toLowerCase()}`}</Text>
                      <Text style={styles.quickStartSummary}>{summarizeExercises(template.exerciseNames, t('workout.noExercisesSummary'))}</Text>
                    </View>

                    {startingTemplateId === template.id ? (
                      <ActivityIndicator size="small" color={palette.accent} />
                    ) : (
                      <Ionicons name="play-circle-outline" size={20} color={palette.accent} />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              ))
            )}
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('workout.createRoutine')}</Text>
            <TouchableOpacity
              style={styles.createTemplateButton}
              activeOpacity={0.88}
              onPress={() => setIsCreateRoutineModalVisible(true)}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.createTemplateButtonText}>{t('workout.newRoutine')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionCaption}>{t('workout.routinesCaption')}</Text>

          <View style={styles.quickStartSection}>
            {isLoadingRoutines ? (
              <View style={styles.statusContainer}>
                <ActivityIndicator size="small" color={palette.accent} />
                <Text style={styles.statusText}>{t('workout.loadingRoutines')}</Text>
              </View>
            ) : routinesError ? (
              <View style={styles.statusContainer}>
                <Text style={styles.statusTitle}>{t('workout.unableToLoadRoutines')}</Text>
                <Text style={styles.statusText}>{routinesError}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    setHasLoadedRoutines(false);
                    void loadRoutines();
                  }}
                  activeOpacity={0.88}
                >
                  <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : routines.length === 0 ? (
              <View style={styles.statusContainer}>
                <Text style={styles.statusTitle}>{t('workout.noRoutinesTitle')}</Text>
                <Text style={styles.statusText}>{t('workout.noRoutinesDescription')}</Text>
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
                    <Text style={styles.routineMeta}>{`${routine.exerciseCount} ${t('workout.templateExercises').toLowerCase()}`}</Text>
                    <Text style={styles.routineNotes}>{routine.notes ?? t('workout.noRoutineNotes')}</Text>

                    <TouchableOpacity
                      style={styles.startRoutineButton}
                      activeOpacity={0.88}
                      onPress={() => handleStartRoutine(routine.id)}
                    >
                      <Ionicons name="play" size={15} color="#FFFFFF" />
                      <Text style={styles.startRoutineButtonText}>{t('workout.startRoutine')}</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              ))
            )}
          </View>
        </>
      ) : null}

      {activeMode === 'exercises' ? (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('workout.exerciseLibrary')}</Text>
          </View>

          <Text style={styles.sectionCaption}>{t('workout.exerciseLibraryCaption')}</Text>

          <TouchableOpacity
            style={styles.exercisePickerTrigger}
            activeOpacity={0.88}
            onPress={() => setIsCreateExerciseModalVisible(true)}
          >
            <View style={styles.exercisePickerTriggerIconWrap}>
              <Ionicons name="add-circle-outline" size={16} color={palette.accent} />
            </View>
            <View style={styles.exercisePickerTriggerTextWrap}>
              <Text style={styles.exercisePickerTriggerTitle}>{t('exercise.createTrigger')}</Text>
              <Text style={styles.exercisePickerTriggerSubtitle}>{t('workout.createExercisesHint')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
          </TouchableOpacity>

          <View style={styles.toolbarRow}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={palette.textMuted} />
              <TextInput
                value={exerciseQuery}
                onChangeText={setExerciseQuery}
                placeholder={t('workout.searchExercisesPlaceholder')}
                placeholderTextColor={palette.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          </View>

          {isLoadingCatalog ? (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color={palette.accent} />
              <Text style={styles.statusText}>{t('exercise.loadingCatalog')}</Text>
            </View>
          ) : catalogError ? (
            <View style={styles.statusContainer}>
              <Text style={styles.statusTitle}>{t('workout.unableToLoadExercises')}</Text>
              <Text style={styles.statusText}>{catalogError}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setHasLoadedCatalog(false);
                  void loadCatalogExercises();
                }}
                activeOpacity={0.88}
              >
                <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : groupedExercises.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('exercise.emptySearchTitle')}</Text>
              <Text style={styles.emptySubtitle}>{t('exercise.emptySearchSubtitle')}</Text>
            </View>
          ) : (
            groupedExercises.map(([muscle, groupedItems], muscleIndex) => (
              <Animated.View
                key={`${muscle}-${animationEpoch}`}
                entering={FadeInUp.delay(Math.min(muscleIndex * 55, 260)).duration(340)}
                layout={cardLayoutTransition}
              >
                <View style={styles.groupSection}>
                  <Text style={styles.groupTitle}>{muscle}</Text>
                  {groupedItems.map((exercise, exerciseIndex) => (
                    <Animated.View
                      key={`${exercise.id}-${animationEpoch}`}
                      entering={FadeInDown.delay(Math.min(exerciseIndex * 35, 180)).duration(280)}
                      layout={cardLayoutTransition}
                    >
                      <View style={styles.exerciseRow}>
                        <View style={styles.exerciseTextWrap}>
                            <Text style={styles.exerciseName}>{getDisplayExerciseName(exercise)}</Text>
                            <Text style={styles.exerciseMeta}>{getDisplayEquipment(exercise)}</Text>
                        </View>
                          <Text style={styles.exerciseMuscle}>{getDisplayMuscle(exercise)}</Text>
                      </View>
                    </Animated.View>
                  ))}
                </View>
              </Animated.View>
            ))
          )}
        </>
      ) : null}

      <Modal
        visible={isCreateTemplateModalVisible}
        transparent
        animationType={modalAnimationType}
        onRequestClose={() => setIsCreateTemplateModalVisible(false)}
      >
        <View style={[styles.modalBackdrop, isWeb && styles.modalBackdropWeb]}>
          <Pressable style={styles.modalDismissArea} onPress={() => setIsCreateTemplateModalVisible(false)} />

          <View style={[styles.modalSheet, isWeb && styles.modalSheetWeb]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('workout.createTemplate')}</Text>

            <TextInput
              value={templateNameInput}
              onChangeText={(value) => setTemplateNameInput(value.substring(0, INPUT_LIMITS.nameMax))}
              style={styles.modalInput}
              placeholder={t('workout.templateName')}
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
              maxLength={INPUT_LIMITS.nameMax}
            />

            <Text style={styles.modalSectionTitle}>{`${t('workout.templateExercises')} (${selectedTemplateExercises.length})`}</Text>

            {isLoadingCatalog ? (
              <View style={styles.modalStatusContainer}>
                <ActivityIndicator size="small" color={palette.accent} />
                <Text style={styles.modalStatusText}>{t('workout.loadingExerciseCatalog')}</Text>
              </View>
            ) : catalogError ? (
              <View style={styles.modalStatusContainer}>
                <Text style={styles.modalStatusTitle}>{t('workout.unableToLoadExercises')}</Text>
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
                <Text style={styles.modalStatusTitle}>{t('workout.noExercisesAvailable')}</Text>
                <Text style={styles.modalStatusText}>{t('workout.createExercisesHint')}</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {catalogExercises.map((exercise) => {
                  const selectedOrder = selectionOrder.get(exercise.id);
                  const isSelected = selectedOrder !== undefined;

                  if (isSelected) {
                    return (
                      <View key={exercise.id} style={[styles.modalExerciseRow, styles.modalExerciseRowSelected]}>
                        <View style={styles.modalExerciseTextWrap}>
                          <Text style={styles.modalExerciseName}>{getDisplayExerciseName(exercise)}</Text>
                          <Text style={styles.modalExerciseMeta}>
                            {getDisplayMuscle(exercise)} - {getDisplayEquipment(exercise)}
                          </Text>
                        </View>

                        <View style={styles.selectedActionsWrap}>
                          <View style={styles.orderBadge}>
                            <Text style={styles.orderBadgeText}>{selectedOrder}</Text>
                          </View>

                          <TouchableOpacity
                            style={styles.removeSelectedButton}
                            activeOpacity={0.88}
                            onPress={() => toggleExerciseSelection(exercise.id)}
                          >
                            <Ionicons name="remove" size={14} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={exercise.id}
                      style={styles.modalExerciseRow}
                      activeOpacity={0.88}
                      onPress={() => toggleExerciseSelection(exercise.id)}
                    >
                      <View style={styles.modalExerciseTextWrap}>
                        <Text style={styles.modalExerciseName}>{getDisplayExerciseName(exercise)}</Text>
                        <Text style={styles.modalExerciseMeta}>
                          {getDisplayMuscle(exercise)} - {getDisplayEquipment(exercise)}
                        </Text>
                      </View>

                      {isSelected ? (
                        <View style={styles.orderBadge}>
                          <Text style={styles.orderBadgeText}>{selectedOrder}</Text>
                        </View>
                      ) : (
                        <View style={styles.addActionButton}>
                          <Ionicons name="add" size={16} color={palette.accent} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsCreateTemplateModalVisible(false)}
                activeOpacity={0.88}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalCreateButton, isSavingTemplate && styles.modalCreateButtonDisabled]}
                onPress={() => void handleCreateTemplate()}
                activeOpacity={0.88}
                disabled={isSavingTemplate}
              >
                {isSavingTemplate ? (
                  <ActivityIndicator size="small" color={palette.textPrimary} />
                ) : (
                  <Text style={styles.modalCreateButtonText}>{t('workout.saveTemplate')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isCreateRoutineModalVisible}
        transparent
        animationType={modalAnimationType}
        onRequestClose={() => setIsCreateRoutineModalVisible(false)}
      >
        <View style={[styles.modalBackdrop, isWeb && styles.modalBackdropWeb]}>
          <Pressable style={styles.modalDismissArea} onPress={() => setIsCreateRoutineModalVisible(false)} />

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

            <Text style={styles.modalSectionTitle}>{`${t('routines.exercises')} (${selectedRoutineExerciseIds.length})`}</Text>

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
                  onPress={() => {
                    setHasLoadedCatalog(false);
                    void loadCatalogExercises();
                  }}
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
                {catalogExercises.map((exercise) => {
                  const selectedOrder = routineSelectionOrder.get(exercise.id);
                  const isSelected = selectedOrder !== undefined;

                  return (
                    <TouchableOpacity
                      key={exercise.id}
                      style={[styles.modalExerciseRow, isSelected && styles.modalExerciseRowSelected]}
                      activeOpacity={0.88}
                      onPress={() => toggleRoutineExerciseSelection(exercise.id)}
                    >
                      <View style={styles.modalExerciseTextWrap}>
                        <Text style={styles.modalExerciseName}>{getDisplayExerciseName(exercise)}</Text>
                        <Text style={styles.modalExerciseMeta}>
                          {getDisplayMuscle(exercise)} - {getDisplayEquipment(exercise)}
                        </Text>
                      </View>

                      {isSelected ? (
                        <View style={styles.orderBadge}>
                          <Text style={styles.orderBadgeText}>{selectedOrder}</Text>
                        </View>
                      ) : (
                        <View style={styles.addActionButton}>
                          <Ionicons name="add" size={16} color={palette.accent} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsCreateRoutineModalVisible(false)}
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

      <Modal
        visible={isCreateExerciseModalVisible}
        transparent
        animationType={modalAnimationType}
        onRequestClose={() => setIsCreateExerciseModalVisible(false)}
      >
        <View style={[styles.modalBackdrop, isWeb && styles.modalBackdropWeb]}>
          <Pressable style={styles.modalDismissArea} onPress={() => setIsCreateExerciseModalVisible(false)} />

          <View style={[styles.modalSheet, isWeb && styles.modalSheetWeb]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('workout.createExercise')}</Text>

            <TextInput
              value={exerciseNameInput}
              onChangeText={(value) => setExerciseNameInput(value.substring(0, INPUT_LIMITS.nameMax))}
              placeholder={t('workout.name')}
              placeholderTextColor={palette.textMuted}
              style={styles.modalInput}
              autoCapitalize="words"
              maxLength={INPUT_LIMITS.nameMax}
            />

            <Text style={styles.optionSectionLabel}>{t('workout.muscleGroup')}</Text>
            <View style={styles.optionChipGrid}>
              {EXERCISE_MUSCLE_OPTIONS.map((muscleKey) => {
                const isSelected = selectedMuscleKey === muscleKey;

                return (
                  <TouchableOpacity
                    key={muscleKey}
                    style={[styles.optionChip, isSelected && styles.optionChipSelected]}
                    activeOpacity={0.88}
                    onPress={() => setSelectedMuscleKey(muscleKey)}
                  >
                    <Text style={[styles.optionChipText, isSelected && styles.optionChipTextSelected]}>
                      {t(EXERCISE_MUSCLE_TRANSLATION_KEY[muscleKey])}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.optionSectionLabel}>{t('workout.equipment')}</Text>
            <View style={styles.optionChipGrid}>
              {EXERCISE_EQUIPMENT_OPTIONS.map((equipmentKey) => {
                const isSelected = selectedEquipmentKey === equipmentKey;

                return (
                  <TouchableOpacity
                    key={equipmentKey}
                    style={[styles.optionChip, isSelected && styles.optionChipSelected]}
                    activeOpacity={0.88}
                    onPress={() => setSelectedEquipmentKey(equipmentKey)}
                  >
                    <Text style={[styles.optionChipText, isSelected && styles.optionChipTextSelected]}>
                      {t(EXERCISE_EQUIPMENT_TRANSLATION_KEY[equipmentKey])}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsCreateExerciseModalVisible(false)}
                activeOpacity={0.88}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
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
                  <Text style={styles.modalCreateButtonText}>{t('common.create')}</Text>
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
    flexGrow: 1,
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
    marginBottom: 16,
  },
  modeSwitchRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginBottom: 14,
  },
  modeChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modeChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#1D4ED8',
  },
  modeChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  modeChipTextActive: {
    color: '#FFFFFF',
  },
  primaryButton: {
    backgroundColor: palette.accent,
    minHeight: 76,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },
  quickStartSection: {
    marginTop: 8,
  },
  sectionHeaderRow: {
    marginTop: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCaption: {
    marginTop: 6,
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  createTemplateButton: {
    minHeight: 36,
    borderRadius: 12,
    backgroundColor: palette.accent,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  createTemplateButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  statusContainer: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    minHeight: 130,
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
  quickStartCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickStartCardTextWrap: {
    flex: 1,
    paddingRight: 14,
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
  quickStartSummary: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  routineCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: CARD_BG,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  routineName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    paddingRight: 10,
  },
  routineMeta: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  routineNotes: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  startRoutineButton: {
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2563EB',
    backgroundColor: '#1D4ED8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
  },
  startRoutineButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  toolbarRow: {
    marginTop: 10,
    marginBottom: 14,
  },
  exercisePickerTrigger: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0D1624',
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  exercisePickerTriggerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E3A5F',
    backgroundColor: '#0A1A2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exercisePickerTriggerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  exercisePickerTriggerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  exercisePickerTriggerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
  },
  searchBar: {
    backgroundColor: palette.inputBackground,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
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
    textAlign: 'center',
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#273247',
    backgroundColor: '#0E1726',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exerciseTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  exerciseMeta: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  exerciseMuscle: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
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
    minHeight: 92,
  },
  modalSectionTitle: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 2,
  },
  optionSectionLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    marginBottom: 6,
    marginTop: 2,
  },
  optionChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 8,
    marginBottom: 10,
  },
  optionChip: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0D1624',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  optionChipSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#122744',
  },
  optionChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  optionChipTextSelected: {
    color: '#EAF1FF',
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
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalExerciseRowSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  modalExerciseTextWrap: {
    flex: 1,
    paddingRight: 14,
  },
  modalExerciseName: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    lineHeight: 22,
  },
  modalExerciseMeta: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  selectedActionsWrap: {
    alignItems: 'center',
    rowGap: 8,
  },
  orderBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  orderBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  addActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0D1624',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeSelectedButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EF4444',
    backgroundColor: '#7F1D1D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonRow: {
    flexDirection: 'row',
    columnGap: 10,
    marginTop: 14,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButtonText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  modalCreateButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCreateButtonDisabled: {
    opacity: 0.7,
  },
  modalCreateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});