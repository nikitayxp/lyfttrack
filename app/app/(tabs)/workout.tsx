import { useCallback, useEffect, useMemo, useState, useDeferredValue, useTransition } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/theme';
import { ACTIVE_OPACITY, HIT_SLOP, Radius, Spacing } from '@/constants/Styles';
import {
  EXERCISE_EQUIPMENT_OPTIONS,
  EXERCISE_EQUIPMENT_TRANSLATION_KEY,
  EXERCISE_MUSCLE_OPTIONS,
  EXERCISE_MUSCLE_TRANSLATION_KEY,
  type ExerciseEquipmentKey,
  type ExerciseMuscleKey,
  getExerciseMuscleTranslationKey,
  getEquipmentTranslationKey,
  normalizeEquipmentKey,
  resolveExerciseMuscleKey,
} from '@/constants/exerciseCatalog';
import { useAppToast } from '@/context/ToastContext';
import { usePreferences } from '@/context/PreferencesContext';
import {
  deleteTemplate,
  getTemplateById,
  getTemplates,
  saveTemplate,
  startWorkoutFromTemplate,
  updateTemplate,
  type TemplateSummary,
} from '@/services/templateService';
import { Chip } from '@/components/ui/Chip';
import { DismissibleBottomSheet } from '@/components/common/DismissibleBottomSheet';
import { EmptyState } from '@/components/common/EmptyState';
import { ExerciseThumbnail } from '@/components/common/ExerciseThumbnail';
import { INPUT_LIMITS, sanitizeText } from '@/utils/inputValidation';
import {
  getLocalizedExerciseMuscle,
  getLocalizedExerciseName,
  type ExerciseNameSource,
} from '@/utils/exerciseLocalization';
import type { AppLanguage } from '@/i18n/resources';
import { matchesExerciseSearch } from '@/utils/exerciseSearch';
import {
  createExercise,
  getErrorMessage,
  getExercisesCatalog,
  getRecentExerciseIds,
  orderExercisesByIds,
  type ExerciseLibraryEquipmentFilter,
  type ExerciseLibraryMuscleFilter,
} from '@/services/workoutService';
import type { Tables } from '@/types/database';
import { confirmAction } from '@/utils/confirmAction';
import { showAlert } from '@/utils/showAlert';

const palette = Colors.dark;
const CARD_BG = palette.surface;
const isWeb = Platform.OS === 'web';
const cardLayoutTransition = LinearTransition.springify().damping(16).stiffness(180);

const MUSCLE_FILTER_CHIP_KEYS: readonly (ExerciseLibraryMuscleFilter | 'recent' | 'custom')[] = [
  'all',
  'recent',
  'custom',
  ...EXERCISE_MUSCLE_OPTIONS,
];
const EQUIPMENT_FILTER_CHIP_KEYS: readonly ExerciseLibraryEquipmentFilter[] = [
  'all',
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
];

type ExerciseRow = Tables<'exercises'>;

type WorkoutMode = 'start' | 'templates' | 'exercises';

function summarizeExercises(
  exerciseNames: ExerciseNameSource[],
  emptyLabel: string,
  language: AppLanguage
): string {
  if (exerciseNames.length === 0) {
    return emptyLabel;
  }

  const preview = exerciseNames
    .slice(0, 3)
    .map((exercise) => getLocalizedExerciseName(exercise, language))
    .join(', ');

  return exerciseNames.length > 3 ? `${preview}...` : preview;
}

export default function WorkoutScreen() {
  const { t } = useTranslation();
  const { showToast } = useAppToast();
  const { language } = usePreferences();
  const [activeMode, setActiveMode] = useState<WorkoutMode>('start');

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [restSecondsByExerciseId, setRestSecondsByExerciseId] = useState<Record<string, number>>({});

  const [isCreateTemplateModalVisible, setIsCreateTemplateModalVisible] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [selectedTemplateExercises, setSelectedTemplateExercises] = useState<string[]>([]);

  const [catalogExercises, setCatalogExercises] = useState<ExerciseRow[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [hasLoadedCatalog, setHasLoadedCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [exerciseQuery, setExerciseQuery] = useState('');
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState<ExerciseLibraryMuscleFilter | 'recent' | 'custom'>('all');
  const [selectedEquipmentFilter, setSelectedEquipmentFilter] = useState<ExerciseLibraryEquipmentFilter>('all');
  const [, startFilterTransition] = useTransition();
  const deferredMuscleFilter = useDeferredValue(selectedMuscleFilter);
  const deferredEquipmentFilter = useDeferredValue(selectedEquipmentFilter);
  const deferredExerciseQuery = useDeferredValue(exerciseQuery);
  const [recentExerciseIds, setRecentExerciseIds] = useState<string[]>([]);
  const [visibleGroupCount, setVisibleGroupCount] = useState(Number.POSITIVE_INFINITY);
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

  const getDisplayExerciseName = useCallback((exercise: ExerciseRow) => {
    return getLocalizedExerciseName(exercise, language);
  }, [language]);

  const getDisplayMuscle = useCallback((exercise: ExerciseRow) => {
    const translatedKey = getExerciseMuscleTranslationKey({
      muscleGroup: exercise.muscle_group,
      muscleEn: exercise.muscle_en,
      musclePt: exercise.muscle_pt,
      name: exercise.name,
      nameEn: exercise.name_en,
      namePt: exercise.name_pt,
    });

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
    const recentSet = new Set(recentExerciseIds);

    const filtered = catalogExercises.filter((exercise) => {
      if (deferredMuscleFilter === 'recent') {
        if (!recentSet.has(exercise.id)) {
          return false;
        }
      } else if (deferredMuscleFilter === 'custom') {
        if (!exercise.is_custom) {
          return false;
        }
      } else if (deferredMuscleFilter !== 'all') {
        const muscleKey = resolveExerciseMuscleKey({
          muscleGroup: exercise.muscle_group,
          muscleEn: exercise.muscle_en,
          musclePt: exercise.muscle_pt,
          name: exercise.name,
          nameEn: exercise.name_en,
          namePt: exercise.name_pt,
        });
        if (muscleKey !== deferredMuscleFilter) {
          return false;
        }
      }

      if (deferredEquipmentFilter !== 'all') {
        if (normalizeEquipmentKey(exercise.equipment) !== deferredEquipmentFilter) {
          return false;
        }
      }

      return matchesExerciseSearch(
        exercise,
        deferredExerciseQuery,
        getDisplayExerciseName(exercise),
        getDisplayMuscle(exercise)
      );
    });

    if (deferredMuscleFilter === 'recent') {
      return [[t('exercise.filterRecent'), orderExercisesByIds(filtered, recentExerciseIds)] as const];
    }

    if (deferredMuscleFilter === 'custom') {
      return [[t('exercise.filterMyExercises'), filtered] as const];
    }

    const groups = filtered.reduce<Record<string, ExerciseRow[]>>((acc, exercise) => {
      const groupKey = getDisplayMuscle(exercise);

      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }

      acc[groupKey].push(exercise);
      return acc;
    }, {});

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [
    catalogExercises,
    deferredEquipmentFilter,
    deferredExerciseQuery,
    deferredMuscleFilter,
    getDisplayExerciseName,
    getDisplayMuscle,
    recentExerciseIds,
    t,
  ]);

  useEffect(() => {
    const isExercisePickerOpen = activeMode === 'exercises' || isCreateTemplateModalVisible;
    if (!isExercisePickerOpen || deferredMuscleFilter === 'recent' || deferredMuscleFilter === 'custom') {
      setVisibleGroupCount(Number.POSITIVE_INFINITY);
      return;
    }

    // Reveal "All" groups in small batches so Recents → All does not mount every image at once.
    setVisibleGroupCount(2);
    let shown = 2;
    const timer = setInterval(() => {
      shown += 3;
      if (shown >= groupedExercises.length) {
        setVisibleGroupCount(Number.POSITIVE_INFINITY);
        clearInterval(timer);
        return;
      }
      setVisibleGroupCount(shown);
    }, 24);

    return () => clearInterval(timer);
  }, [activeMode, deferredMuscleFilter, groupedExercises.length, isCreateTemplateModalVisible]);

  const visibleGroupedExercises = useMemo(
    () =>
      Number.isFinite(visibleGroupCount)
        ? groupedExercises.slice(0, visibleGroupCount)
        : groupedExercises,
    [groupedExercises, visibleGroupCount]
  );

  const shouldLoadCatalog = useMemo(() => {
    return (
      activeMode === 'exercises' ||
      isCreateTemplateModalVisible ||
      isCreateExerciseModalVisible
    );
  }, [activeMode, isCreateExerciseModalVisible, isCreateTemplateModalVisible]);

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

  const loadCatalogExercises = useCallback(async () => {
    setIsLoadingCatalog(true);
    setCatalogError(null);

    try {
      const [exercises, recentIds] = await Promise.all([getExercisesCatalog(), getRecentExerciseIds()]);
      setCatalogExercises(exercises);
      setRecentExerciseIds(recentIds);
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
      showAlert(showToast, t('workout.unableToStartTemplate'), getErrorMessage(error), 'error');
    } finally {
      setStartingTemplateId(null);
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    if (deletingTemplateId || startingTemplateId) {
      return;
    }

    const confirmed = await confirmAction({
      title: t('workout.deleteTemplateTitle'),
      description: t('workout.deleteTemplateDescription'),
      confirmLabel: t('workout.deleteTemplateConfirm'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    setDeletingTemplateId(templateId);

    try {
      await deleteTemplate(templateId);
      setTemplates((current) => current.filter((item) => item.id !== templateId));
      showAlert(showToast, t('workout.deleteTemplateSuccess'));
    } catch (error) {
      showAlert(showToast, t('workout.unableToDeleteTemplate'), getErrorMessage(error), 'error');
    } finally {
      setDeletingTemplateId(null);
    }
  }

  const openCreateTemplateFlow = useCallback(() => {
    setActiveMode('templates');
    setTemplateNameInput('');
    setSelectedTemplateExercises([]);
    setEditingTemplateId(null);
    setRestSecondsByExerciseId({});
    setExerciseQuery('');
    setSelectedMuscleFilter('all');
    setSelectedEquipmentFilter('all');
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

  function resetTemplateForm() {
    setTemplateNameInput('');
    setSelectedTemplateExercises([]);
    setEditingTemplateId(null);
    setRestSecondsByExerciseId({});
    setExerciseQuery('');
    setSelectedMuscleFilter('all');
    setSelectedEquipmentFilter('all');
  }

  function resetExerciseForm() {
    setExerciseNameInput('');
    setSelectedMuscleKey(null);
    setSelectedEquipmentKey(null);
  }

  async function handleCreateExercise() {
    const normalizedName = sanitizeText(exerciseNameInput, {
      maxLength: INPUT_LIMITS.nameMax,
      allowEmpty: false,
    });

    if (!normalizedName) {
      showAlert(showToast, t('validation.title'), t('validation.exerciseNameRequired'), 'error');
      return;
    }

    if (!selectedMuscleKey) {
      showAlert(showToast, t('validation.title'), t('validation.selectMuscleGroup'), 'error');
      return;
    }

    if (!selectedEquipmentKey) {
      showAlert(showToast, t('validation.title'), t('validation.selectEquipment'), 'error');
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
      showAlert(showToast, t('exercise.success.createdTitle'), t('exercise.success.createdDescription'));
    } catch (error) {
      showAlert(showToast, t('exercise.errors.create'), getErrorMessage(error), 'error');
    } finally {
      setIsCreatingExercise(false);
    }
  }

  async function handleSaveTemplate() {
    const normalizedName = sanitizeText(templateNameInput, {
      maxLength: INPUT_LIMITS.nameMax,
      allowEmpty: false,
    });

    if (!normalizedName) {
      showAlert(showToast, t('validation.title'), t('validation.templateNameRequired'), 'error');
      return;
    }

    if (selectedTemplateExercises.length === 0) {
      showAlert(showToast, t('validation.title'), t('validation.templateExerciseRequired'), 'error');
      return;
    }

    setIsSavingTemplate(true);

    try {
      if (editingTemplateId) {
        await updateTemplate(
          editingTemplateId,
          normalizedName,
          selectedTemplateExercises.map((exerciseId) => ({
            exerciseId,
            restSeconds: restSecondsByExerciseId[exerciseId],
          }))
        );
        showAlert(showToast, t('workout.editTemplateSuccess'));
      } else {
        await saveTemplate(normalizedName, selectedTemplateExercises);
        showAlert(showToast, t('workout.templateSavedTitle'), t('workout.templateSavedDescription'));
      }

      setIsCreateTemplateModalVisible(false);
      resetTemplateForm();
      await loadTemplates();
    } catch (error) {
      showAlert(
        showToast,
        editingTemplateId ? t('workout.unableToUpdateTemplate') : t('workout.unableToCreateTemplate'),
        getErrorMessage(error),
        'error'
      );
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function handleEditTemplate(templateId: string) {
    if (deletingTemplateId || startingTemplateId || isSavingTemplate) {
      return;
    }

    try {
      const detail = await getTemplateById(templateId);
      const restById: Record<string, number> = {};
      const exerciseIds = detail.exercises.map((entry) => {
        restById[entry.exercise.id] = entry.rest_seconds;
        return entry.exercise.id;
      });

      setEditingTemplateId(detail.id);
      setTemplateNameInput(detail.name);
      setSelectedTemplateExercises(exerciseIds);
      setRestSecondsByExerciseId(restById);
      setExerciseQuery('');
      setSelectedMuscleFilter('all');
      setSelectedEquipmentFilter('all');
      setIsCreateTemplateModalVisible(true);
    } catch (error) {
      showAlert(showToast, t('workout.unableToLoadTemplate'), getErrorMessage(error), 'error');
    }
  }

  const modeLabelMap: Record<WorkoutMode, string> = {
    start: t('workout.startModeLabel'),
    templates: t('workout.templatesModeLabel'),
    exercises: t('workout.exercisesModeLabel'),
  };

  const getMuscleFilterLabel = (filterKey: ExerciseLibraryMuscleFilter | 'recent' | 'custom'): string => {
    if (filterKey === 'all') {
      return t('exercise.filterAll');
    }
    if (filterKey === 'recent') {
      return t('exercise.filterRecent');
    }
    if (filterKey === 'custom') {
      return t('exercise.filterMyExercises');
    }
    return t(EXERCISE_MUSCLE_TRANSLATION_KEY[filterKey]);
  };

  const getEquipmentFilterLabel = (filterKey: ExerciseLibraryEquipmentFilter): string => {
    if (filterKey === 'all') {
      return language === 'pt' ? 'Todo equipamento' : 'All equipment';
    }
    return t(EXERCISE_EQUIPMENT_TRANSLATION_KEY[filterKey]);
  };

  const selectedExerciseRows = useMemo(() => {
    const catalogById = new Map(catalogExercises.map((exercise) => [exercise.id, exercise]));
    return selectedTemplateExercises
      .map((exerciseId) => catalogById.get(exerciseId))
      .filter((exercise): exercise is ExerciseRow => Boolean(exercise));
  }, [catalogExercises, selectedTemplateExercises]);

  const exerciseLibraryFilters = (
    <>
      <View style={styles.toolbarRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={palette.textMuted} />
          <TextInput
            accessibilityLabel={t('accessibility.searchExercises', { defaultValue: 'Search exercises' })}
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

      <Text style={styles.filterChipsSectionLabel}>{t('workout.muscleGroup')}</Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={[styles.filterChipsScroll, isWeb && styles.filterChipsScrollWeb]}
        contentContainerStyle={styles.filterChipsContent}
      >
        {MUSCLE_FILTER_CHIP_KEYS.map((filterKey) => (
          <Chip
            key={filterKey}
            label={getMuscleFilterLabel(filterKey)}
            selected={filterKey === selectedMuscleFilter}
            onPress={() => startFilterTransition(() => setSelectedMuscleFilter(filterKey))}
          />
        ))}
      </ScrollView>

      <Text style={styles.filterChipsSectionLabel}>{t('workout.equipment')}</Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={[styles.filterChipsScroll, isWeb && styles.filterChipsScrollWeb]}
        contentContainerStyle={styles.filterChipsContent}
      >
        {EQUIPMENT_FILTER_CHIP_KEYS.map((filterKey) => (
          <Chip
            key={filterKey}
            label={getEquipmentFilterLabel(filterKey)}
            selected={filterKey === selectedEquipmentFilter}
            onPress={() => startFilterTransition(() => setSelectedEquipmentFilter(filterKey))}
          />
        ))}
      </ScrollView>
    </>
  );

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
              activeOpacity={ACTIVE_OPACITY}
              onPress={() => setActiveMode(mode)}
              accessibilityRole="button"
              accessibilityLabel={modeLabelMap[mode]}
            >
              <Text style={[styles.modeChipText, isActive && styles.modeChipTextActive]}>{modeLabelMap[mode]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeMode === 'start' ? (
        <>
          <TouchableOpacity 
            style={styles.primaryButton} 
            activeOpacity={ACTIVE_OPACITY} 
            onPress={handleStartEmptyWorkout}
            accessibilityRole="button"
            accessibilityLabel={t('workout.startEmptyWorkout')}
          >
            <Ionicons name="play" size={22} color={palette.textPrimary} />
            <Text style={styles.primaryButtonText}>{t('workout.startEmptyWorkout')}</Text>
          </TouchableOpacity>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('workout.quickStartTemplates')}</Text>
            <TouchableOpacity
              style={styles.createTemplateButton}
              activeOpacity={ACTIVE_OPACITY}
              onPress={() => setActiveMode('templates')}
              accessibilityRole="button"
              accessibilityLabel={t('workout.openLibrary')}
            >
              <Ionicons name="layers-outline" size={16} color={palette.textPrimary} />
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
                <TouchableOpacity 
                  style={styles.retryButton} 
                  onPress={() => void loadTemplates()} 
                  activeOpacity={ACTIVE_OPACITY}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.retry')}
                >
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
                    activeOpacity={ACTIVE_OPACITY}
                    onPress={() => void handleStartTemplate(template.id)}
                    disabled={startingTemplateId !== null}
                    accessibilityRole="button"
                    accessibilityLabel={template.name}
                  >
                    <View style={styles.quickStartCardTextWrap}>
                      <Text style={styles.quickStartTitle}>{template.name}</Text>
                      <Text style={styles.quickStartMeta}>{`${template.exerciseCount} ${t('workout.templateExercises').toLowerCase()}`}</Text>
                      <Text style={styles.quickStartSummary}>{summarizeExercises(template.exerciseNames, t('workout.noExercisesSummary'), language)}</Text>
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
              activeOpacity={ACTIVE_OPACITY}
              onPress={() => {
                resetTemplateForm();
                setIsCreateTemplateModalVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('workout.createTemplate')}
            >
              <Ionicons name="add" size={16} color={palette.textPrimary} />
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
                <TouchableOpacity 
                  style={styles.retryButton} 
                  onPress={() => void loadTemplates()} 
                  activeOpacity={ACTIVE_OPACITY}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.retry')}
                >
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
                  <View style={styles.quickStartCard}>
                    <TouchableOpacity
                      style={styles.quickStartCardMain}
                      activeOpacity={ACTIVE_OPACITY}
                      onPress={() => void handleStartTemplate(template.id)}
                      disabled={startingTemplateId !== null || deletingTemplateId !== null}
                      accessibilityRole="button"
                      accessibilityLabel={template.name}
                    >
                      <View style={styles.quickStartCardTextWrap}>
                        <Text style={styles.quickStartTitle}>{template.name}</Text>
                        <Text style={styles.quickStartMeta}>{`${template.exerciseCount} ${t('workout.templateExercises').toLowerCase()}`}</Text>
                        <Text style={styles.quickStartSummary}>{summarizeExercises(template.exerciseNames, t('workout.noExercisesSummary'), language)}</Text>
                      </View>

                      {startingTemplateId === template.id ? (
                        <ActivityIndicator size="small" color={palette.accent} />
                      ) : (
                        <Ionicons name="play-circle-outline" size={20} color={palette.accent} />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.templateDeleteButton}
                      activeOpacity={ACTIVE_OPACITY}
                      onPress={() => void handleEditTemplate(template.id)}
                      disabled={startingTemplateId !== null || deletingTemplateId !== null}
                      hitSlop={HIT_SLOP}
                      accessibilityRole="button"
                      accessibilityLabel={t('workout.editTemplateA11y', { name: template.name })}
                    >
                      <Ionicons name="create-outline" size={18} color={palette.textPrimary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.templateDeleteButton}
                      activeOpacity={ACTIVE_OPACITY}
                      onPress={() => void handleDeleteTemplate(template.id)}
                      disabled={startingTemplateId !== null || deletingTemplateId !== null}
                      hitSlop={HIT_SLOP}
                      accessibilityRole="button"
                      accessibilityLabel={t('workout.deleteTemplateA11y', { name: template.name })}
                    >
                      {deletingTemplateId === template.id ? (
                        <ActivityIndicator size="small" color={palette.error} />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color={palette.error} />
                      )}
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
            activeOpacity={ACTIVE_OPACITY}
            onPress={() => setIsCreateExerciseModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('exercise.createTrigger')}
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

          {exerciseLibraryFilters}

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
                activeOpacity={ACTIVE_OPACITY}
                accessibilityRole="button"
                accessibilityLabel={t('common.retry')}
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
            <View>
              {visibleGroupedExercises.map(([muscle, groupedItems]) => (
                <View key={muscle} style={styles.groupSection}>
                  <Text style={styles.groupTitle}>{muscle}</Text>
                  {groupedItems.map((exercise) => {
                    const exerciseLabel = getDisplayExerciseName(exercise);
                    return (
                      <TouchableOpacity
                        key={exercise.id}
                        style={styles.libraryExerciseRow}
                        activeOpacity={ACTIVE_OPACITY}
                        onPress={() => router.push(`/exercise/${exercise.id}` as any)}
                        accessibilityRole="button"
                        accessibilityLabel={t('accessibility.viewExerciseDetails', {
                          name: exerciseLabel,
                          defaultValue: 'View exercise details',
                        })}
                      >
                        <ExerciseThumbnail exercise={exercise} size={34} />
                        <View style={styles.libraryExerciseTextWrap}>
                          <Text style={styles.libraryExerciseName}>{exerciseLabel}</Text>
                          <Text style={styles.libraryExerciseMeta}>
                            {getDisplayMuscle(exercise)} - {getDisplayEquipment(exercise)}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}

      <DismissibleBottomSheet
        visible={isCreateTemplateModalVisible}
        onClose={() => {
          setIsCreateTemplateModalVisible(false);
          resetTemplateForm();
        }}
        scrollable
        sheetStyle={styles.templatePickerSheet}
      >
        <SafeAreaView edges={['bottom']} style={styles.templateSheetBody}>
            <Text style={styles.modalTitle}>
              {editingTemplateId ? t('workout.editTemplate') : t('workout.createTemplate')}
            </Text>

            <TextInput
              accessibilityLabel={t('accessibility.templateName', { defaultValue: 'Template name' })}
              value={templateNameInput}
              onChangeText={(value) => setTemplateNameInput(value.substring(0, INPUT_LIMITS.nameMax))}
              style={styles.modalInput}
              placeholder={t('workout.templateName')}
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
              maxLength={INPUT_LIMITS.nameMax}
            />

            <Text style={styles.modalSectionTitle}>{`${t('workout.templateExercises')} (${selectedTemplateExercises.length})`}</Text>

            {selectedExerciseRows.length > 0 ? (
              <ScrollView
                style={styles.templateSelectedList}
                contentContainerStyle={styles.templateSelectedListContent}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {selectedExerciseRows.map((exercise) => {
                  const selectedOrder = selectionOrder.get(exercise.id);
                  return (
                    <View key={exercise.id} style={[styles.libraryExerciseRow, styles.modalExerciseRowSelected]}>
                      <ExerciseThumbnail exercise={exercise} size={34} />
                      <View style={styles.libraryExerciseTextWrap}>
                        <Text style={styles.libraryExerciseName} numberOfLines={1}>
                          {getDisplayExerciseName(exercise)}
                        </Text>
                        <Text style={styles.libraryExerciseMeta} numberOfLines={1}>
                          {getDisplayMuscle(exercise)} - {getDisplayEquipment(exercise)}
                        </Text>
                      </View>
                      <View style={styles.selectedActionsWrap}>
                        <View style={styles.orderBadge}>
                          <Text style={styles.orderBadgeText}>{selectedOrder}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.removeSelectedButton}
                          activeOpacity={ACTIVE_OPACITY}
                          hitSlop={HIT_SLOP}
                          onPress={() => toggleExerciseSelection(exercise.id)}
                          accessibilityRole="button"
                          accessibilityLabel={t('accessibility.removeSelectedExercise', { defaultValue: 'Remove exercise' })}
                        >
                          <Ionicons name="remove" size={14} color={palette.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            ) : null}

            {exerciseLibraryFilters}

            <ScrollView
              style={styles.templateCatalogList}
              contentContainerStyle={styles.templateCatalogListContent}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
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
                    activeOpacity={ACTIVE_OPACITY}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.retry')}
                  >
                    <Text style={styles.modalRetryButtonText}>{t('common.retry')}</Text>
                  </TouchableOpacity>
                </View>
              ) : catalogExercises.length === 0 ? (
                <View style={styles.modalStatusContainer}>
                  <Text style={styles.modalStatusTitle}>{t('workout.noExercisesAvailable')}</Text>
                  <Text style={styles.modalStatusText}>{t('workout.createExercisesHint')}</Text>
                </View>
              ) : groupedExercises.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>{t('exercise.emptySearchTitle')}</Text>
                  <Text style={styles.emptySubtitle}>{t('exercise.emptySearchSubtitle')}</Text>
                </View>
              ) : (
                visibleGroupedExercises.map(([muscle, groupedItems]) => {
                  const unselected = groupedItems.filter((exercise) => !selectionOrder.has(exercise.id));
                  if (unselected.length === 0) {
                    return null;
                  }

                  return (
                    <View key={muscle} style={styles.groupSection}>
                      <Text style={styles.groupTitle}>{muscle}</Text>
                      {unselected.map((exercise) => {
                        const exerciseLabel = getDisplayExerciseName(exercise);

                        return (
                          <TouchableOpacity
                            key={exercise.id}
                            style={styles.libraryExerciseRow}
                            activeOpacity={ACTIVE_OPACITY}
                            onPress={() => toggleExerciseSelection(exercise.id)}
                            accessibilityRole="button"
                            accessibilityLabel={t('accessibility.addSpecificExercise', { name: exerciseLabel, defaultValue: 'Add exercise' })}
                          >
                            <ExerciseThumbnail exercise={exercise} size={34} />
                            <View style={styles.libraryExerciseTextWrap}>
                              <Text style={styles.libraryExerciseName} numberOfLines={1}>
                                {exerciseLabel}
                              </Text>
                              <Text style={styles.libraryExerciseMeta} numberOfLines={1}>
                                {getDisplayMuscle(exercise)} - {getDisplayEquipment(exercise)}
                              </Text>
                            </View>
                            <View style={styles.addActionButton}>
                              <Ionicons name="add" size={16} color={palette.accent} />
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setIsCreateTemplateModalVisible(false);
                  resetTemplateForm();
                }}
                activeOpacity={ACTIVE_OPACITY}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalCreateButton, isSavingTemplate && styles.modalCreateButtonDisabled]}
                onPress={() => void handleSaveTemplate()}
                activeOpacity={ACTIVE_OPACITY}
                disabled={isSavingTemplate}
                accessibilityRole="button"
                accessibilityLabel={editingTemplateId ? t('workout.editTemplate') : t('workout.saveTemplate')}
              >
                {isSavingTemplate ? (
                  <ActivityIndicator size="small" color={palette.textPrimary} />
                ) : (
                  <Text style={styles.modalCreateButtonText}>
                    {editingTemplateId ? t('workout.editTemplate') : t('workout.saveTemplate')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
        </SafeAreaView>
      </DismissibleBottomSheet>

      <DismissibleBottomSheet
        visible={isCreateExerciseModalVisible}
        onClose={() => setIsCreateExerciseModalVisible(false)}
      >
            <Text style={styles.modalTitle}>{t('workout.createExercise')}</Text>

            <TextInput
              accessibilityLabel={t('accessibility.exerciseName', { defaultValue: 'Exercise name' })}
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
                    activeOpacity={ACTIVE_OPACITY}
                    onPress={() => setSelectedMuscleKey(muscleKey)}
                    accessibilityRole="button"
                    accessibilityLabel={t(EXERCISE_MUSCLE_TRANSLATION_KEY[muscleKey])}
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
                    activeOpacity={ACTIVE_OPACITY}
                    onPress={() => setSelectedEquipmentKey(equipmentKey)}
                    accessibilityRole="button"
                    accessibilityLabel={t(EXERCISE_EQUIPMENT_TRANSLATION_KEY[equipmentKey])}
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
                activeOpacity={ACTIVE_OPACITY}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalCreateButton, isCreatingExercise && styles.modalCreateButtonDisabled]}
                onPress={() => void handleCreateExercise()}
                activeOpacity={ACTIVE_OPACITY}
                disabled={isCreatingExercise}
                accessibilityRole="button"
                accessibilityLabel={t('common.create')}
              >
                {isCreatingExercise ? (
                  <ActivityIndicator size="small" color={palette.textPrimary} />
                ) : (
                  <Text style={styles.modalCreateButtonText}>{t('common.create')}</Text>
                )}
              </TouchableOpacity>
            </View>
      </DismissibleBottomSheet>
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
    paddingHorizontal: 16,
    paddingTop: 20,
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
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.chipModeInactiveBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modeChipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentStrong,
  },
  modeChipText: {
    color: palette.chipText,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  modeChipTextActive: {
    color: palette.textPrimary,
  },
  primaryButton: {
    backgroundColor: palette.accent,
    minHeight: 76,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryButtonText: {
    color: palette.textPrimary,
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
    color: palette.labelMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  createTemplateButton: {
    minHeight: 40,
    borderRadius: Radius.button,
    backgroundColor: palette.accent,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  createTemplateButtonText: {
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  statusContainer: {
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
  },
  retryButtonText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  quickStartCard: {
    backgroundColor: CARD_BG,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.inputFill,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickStartCardMain: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  templateDeleteButton: {
    width: 30,
    height: 30,
    marginLeft: 8,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
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
  toolbarRow: {
    marginTop: 10,
    marginBottom: 14,
  },
  exercisePickerTrigger: {
    marginTop: 10,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.surfaceAlt,
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
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.accentSoft,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exercisePickerTriggerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  exercisePickerTriggerTitle: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  exercisePickerTriggerSubtitle: {
    color: palette.labelMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  searchBar: {
    backgroundColor: palette.inputBackground,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.exerciseRowBorder,
    backgroundColor: palette.exerciseRowBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  filterChipsSectionLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  filterChipsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 38,
    marginBottom: 10,
  },
  filterChipsScrollWeb: {
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  } as object,
  filterChipsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    paddingRight: 16,
    paddingVertical: 4,
  },
  libraryExerciseRow: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Radius.card,
    backgroundColor: palette.surfaceAlt,
    paddingLeft: 10,
    paddingRight: 10,
    paddingVertical: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  libraryExerciseTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  libraryExerciseName: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  libraryExerciseMeta: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  exerciseTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  exerciseName: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  exerciseMeta: {
    color: palette.labelMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  exerciseMuscle: {
    color: palette.chipText,
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
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
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
    borderRadius: Radius.pill,
    backgroundColor: palette.borderStrong,
    marginBottom: 12,
  },
  modalTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  templatePickerSheet: {
    minHeight: '78%',
    maxHeight: '92%',
    paddingBottom: Spacing.md,
  },
  templateSheetBody: {
    flexGrow: 1,
    minHeight: 0,
    maxHeight: '100%',
  },
  templateSelectedList: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 128,
    marginBottom: 4,
  },
  templateSelectedListContent: {
    paddingBottom: 2,
  },
  templateCatalogList: {
    flex: 1,
    minHeight: 140,
    marginTop: 2,
  },
  templateCatalogListContent: {
    paddingBottom: 8,
  },
  modalInput: {
    backgroundColor: palette.inputBackground,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    color: palette.textPrimary,
    borderRadius: Radius.card,
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
    color: palette.labelMuted,
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
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  optionChipSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.chipFillSelected,
  },
  optionChipText: {
    color: palette.chipText,
    fontSize: 12,
    fontWeight: '700',
  },
  optionChipTextSelected: {
    color: palette.chipTextSelected,
  },
  modalStatusContainer: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  modalRetryButtonText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  modalExerciseRowSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  selectedActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    flexShrink: 0,
  },
  orderBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: Radius.card,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  orderBadgeText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  addActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeSelectedButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.dangerRemoveBorder,
    backgroundColor: palette.dangerRemoveBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonRow: {
    flexDirection: 'row',
    columnGap: 10,
    marginTop: 10,
    paddingTop: 4,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCreateButtonDisabled: {
    opacity: 0.7,
  },
  modalCreateButtonText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
});