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
import { Colors } from '@/constants/theme';
import {
  getTemplates,
  saveTemplate,
  startWorkoutFromTemplate,
  type TemplateExerciseSaveInput,
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

const palette = Colors.dark;
const CARD_BG = '#111827';

type ExerciseRow = Tables<'exercises'>;
type SelectedTemplateExercise = {
  exerciseId: string;
  restSecondsInput: string;
};

type WorkoutMode = 'start' | 'templates' | 'exercises';

function sanitizeIntegerInput(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

function normalizeRestSecondsForSave(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 90;
  }

  const truncated = Math.trunc(parsed);
  return Math.max(15, Math.min(900, truncated));
}

function summarizeExercises(exerciseNames: string[]): string {
  if (exerciseNames.length === 0) {
    return 'No exercises.';
  }

  const preview = exerciseNames.slice(0, 3).join(', ');
  return exerciseNames.length > 3 ? `${preview}...` : preview;
}

export default function WorkoutScreen() {
  const [activeMode, setActiveMode] = useState<WorkoutMode>('start');

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null);

  const [isCreateTemplateModalVisible, setIsCreateTemplateModalVisible] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [selectedTemplateExercises, setSelectedTemplateExercises] = useState<SelectedTemplateExercise[]>([]);

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
  const [muscleGroupInput, setMuscleGroupInput] = useState('');
  const [equipmentInput, setEquipmentInput] = useState('');

  const selectionOrder = useMemo(() => {
    return new Map(selectedTemplateExercises.map((entry, index) => [entry.exerciseId, index + 1]));
  }, [selectedTemplateExercises]);

  const routineSelectionOrder = useMemo(() => {
    return new Map(selectedRoutineExerciseIds.map((exerciseId, index) => [exerciseId, index + 1]));
  }, [selectedRoutineExerciseIds]);

  const groupedExercises = useMemo(() => {
    const normalizedQuery = exerciseQuery.trim().toLowerCase();

    const filtered = normalizedQuery
      ? catalogExercises.filter((exercise) => {
          const byName = exercise.name.toLowerCase().includes(normalizedQuery);
          const byMuscle = (exercise.muscle_group ?? '').toLowerCase().includes(normalizedQuery);
          return byName || byMuscle;
        })
      : catalogExercises;

    const groups = filtered.reduce<Record<string, ExerciseRow[]>>((acc, exercise) => {
      const groupKey = exercise.muscle_group ?? 'Other';

      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }

      acc[groupKey].push(exercise);
      return acc;
    }, {});

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [catalogExercises, exerciseQuery]);

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
      Alert.alert('Unable to start template', getErrorMessage(error));
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
      if (currentValue.some((entry) => entry.exerciseId === exerciseId)) {
        return currentValue.filter((entry) => entry.exerciseId !== exerciseId);
      }

      return [
        ...currentValue,
        {
          exerciseId,
          restSecondsInput: '90',
        },
      ];
    });
  }

  function updateExerciseRestSeconds(exerciseId: string, value: string) {
    const sanitizedValue = sanitizeIntegerInput(value);

    setSelectedTemplateExercises((currentValue) =>
      currentValue.map((entry) =>
        entry.exerciseId === exerciseId
          ? {
              ...entry,
              restSecondsInput: sanitizedValue,
            }
          : entry
      )
    );
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
    setMuscleGroupInput('');
    setEquipmentInput('');
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
      Alert.alert('Validation', 'Routine name is required.');
      return;
    }

    if (selectedRoutineExerciseIds.length === 0) {
      Alert.alert('Validation', 'Select at least one exercise for this routine.');
      return;
    }

    setIsCreatingRoutine(true);

    try {
      await createRoutine(normalizedName, normalizedNotes, selectedRoutineExerciseIds);
      setIsCreateRoutineModalVisible(false);
      resetRoutineForm();
      setHasLoadedRoutines(false);
      await loadRoutines();
    } catch (error) {
      Alert.alert('Unable to create routine', getErrorMessage(error));
    } finally {
      setIsCreatingRoutine(false);
    }
  }

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

      setIsCreateExerciseModalVisible(false);
      resetExerciseForm();
      setHasLoadedCatalog(false);
      await loadCatalogExercises();
    } catch (error) {
      Alert.alert('Unable to create exercise', getErrorMessage(error));
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
      Alert.alert('Validation', 'Template name is required.');
      return;
    }

    if (selectedTemplateExercises.length === 0) {
      Alert.alert('Validation', 'Select at least one exercise to create a template.');
      return;
    }

    setIsSavingTemplate(true);

    try {
      const payload: TemplateExerciseSaveInput[] = selectedTemplateExercises.map((entry) => ({
        exerciseId: entry.exerciseId,
        restSeconds: normalizeRestSecondsForSave(entry.restSecondsInput),
      }));

      await saveTemplate(normalizedName, payload);
      setIsCreateTemplateModalVisible(false);
      resetTemplateForm();
      await loadTemplates();
    } catch (error) {
      Alert.alert('Unable to create template', getErrorMessage(error));
    } finally {
      setIsSavingTemplate(false);
    }
  }

  const modeLabelMap: Record<WorkoutMode, string> = {
    start: 'Iniciar Treino',
    templates: 'Meus Templates',
    exercises: 'Exercicios',
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Workout</Text>
      <Text style={styles.subtitle}>Consolide routines, templates and exercise catalog in one flow.</Text>

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
            <Text style={styles.primaryButtonText}>Start Empty Workout</Text>
          </TouchableOpacity>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Quick Start Templates</Text>
            <TouchableOpacity
              style={styles.createTemplateButton}
              activeOpacity={0.88}
              onPress={() => setActiveMode('templates')}
            >
              <Ionicons name="layers-outline" size={16} color="#FFFFFF" />
              <Text style={styles.createTemplateButtonText}>Open Library</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionCaption}>Launch saved templates instantly.</Text>

          <View style={styles.quickStartSection}>
            {isLoadingTemplates ? (
              <View style={styles.statusContainer}>
                <ActivityIndicator size="small" color={palette.accent} />
                <Text style={styles.statusText}>Loading templates...</Text>
              </View>
            ) : templatesError ? (
              <View style={styles.statusContainer}>
                <Text style={styles.statusTitle}>Unable to load templates</Text>
                <Text style={styles.statusText}>{templatesError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => void loadTemplates()} activeOpacity={0.88}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : templates.length === 0 ? (
              <EmptyState
                icon="layers-outline"
                title="Sem templates ainda"
                description="Crie seu primeiro template para iniciar treinos em um toque."
                actionLabel="Criar Primeiro Template"
                onActionPress={openCreateTemplateFlow}
                containerStyle={styles.statusContainer}
                descriptionStyle={styles.statusText}
              />
            ) : (
              templates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.quickStartCard}
                  activeOpacity={0.88}
                  onPress={() => void handleStartTemplate(template.id)}
                  disabled={startingTemplateId !== null}
                >
                  <View style={styles.quickStartCardTextWrap}>
                    <Text style={styles.quickStartTitle}>{template.name}</Text>
                    <Text style={styles.quickStartMeta}>{template.exerciseCount} exercises</Text>
                    <Text style={styles.quickStartSummary}>{summarizeExercises(template.exerciseNames)}</Text>
                  </View>

                  {startingTemplateId === template.id ? (
                    <ActivityIndicator size="small" color={palette.accent} />
                  ) : (
                    <Ionicons name="play-circle-outline" size={20} color={palette.accent} />
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        </>
      ) : null}

      {activeMode === 'templates' ? (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Templates</Text>
            <TouchableOpacity
              style={styles.createTemplateButton}
              activeOpacity={0.88}
              onPress={() => setIsCreateTemplateModalVisible(true)}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.createTemplateButtonText}>Create Template</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionCaption}>Save per-exercise rest and launch in one tap.</Text>

          <View style={styles.quickStartSection}>
            {isLoadingTemplates ? (
              <View style={styles.statusContainer}>
                <ActivityIndicator size="small" color={palette.accent} />
                <Text style={styles.statusText}>Loading templates...</Text>
              </View>
            ) : templatesError ? (
              <View style={styles.statusContainer}>
                <Text style={styles.statusTitle}>Unable to load templates</Text>
                <Text style={styles.statusText}>{templatesError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => void loadTemplates()} activeOpacity={0.88}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : templates.length === 0 ? (
              <EmptyState
                icon="layers-outline"
                title="Sem templates ainda"
                description="Crie seu primeiro template para iniciar treinos em um toque."
                actionLabel="Criar Primeiro Template"
                onActionPress={openCreateTemplateFlow}
                containerStyle={styles.statusContainer}
                descriptionStyle={styles.statusText}
              />
            ) : (
              templates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.quickStartCard}
                  activeOpacity={0.88}
                  onPress={() => void handleStartTemplate(template.id)}
                  disabled={startingTemplateId !== null}
                >
                  <View style={styles.quickStartCardTextWrap}>
                    <Text style={styles.quickStartTitle}>{template.name}</Text>
                    <Text style={styles.quickStartMeta}>{template.exerciseCount} exercises</Text>
                    <Text style={styles.quickStartSummary}>{summarizeExercises(template.exerciseNames)}</Text>
                  </View>

                  {startingTemplateId === template.id ? (
                    <ActivityIndicator size="small" color={palette.accent} />
                  ) : (
                    <Ionicons name="play-circle-outline" size={20} color={palette.accent} />
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Routines</Text>
            <TouchableOpacity
              style={styles.createTemplateButton}
              activeOpacity={0.88}
              onPress={() => setIsCreateRoutineModalVisible(true)}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.createTemplateButtonText}>New Routine</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionCaption}>Legacy routine flow is grouped here for migration continuity.</Text>

          <View style={styles.quickStartSection}>
            {isLoadingRoutines ? (
              <View style={styles.statusContainer}>
                <ActivityIndicator size="small" color={palette.accent} />
                <Text style={styles.statusText}>Loading routines...</Text>
              </View>
            ) : routinesError ? (
              <View style={styles.statusContainer}>
                <Text style={styles.statusTitle}>Unable to load routines</Text>
                <Text style={styles.statusText}>{routinesError}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    setHasLoadedRoutines(false);
                    void loadRoutines();
                  }}
                  activeOpacity={0.88}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : routines.length === 0 ? (
              <View style={styles.statusContainer}>
                <Text style={styles.statusTitle}>No routines yet</Text>
                <Text style={styles.statusText}>Create your first routine to speed up workout starts.</Text>
              </View>
            ) : (
              routines.map((routine) => (
                <View key={routine.id} style={styles.routineCard}>
                  <View style={styles.cardHead}>
                    <Text style={styles.routineName}>{routine.name}</Text>
                    <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
                  </View>
                  <Text style={styles.routineMeta}>{routine.exerciseCount} exercises</Text>
                  <Text style={styles.routineNotes}>{routine.notes ?? 'No notes available.'}</Text>

                  <TouchableOpacity
                    style={styles.startRoutineButton}
                    activeOpacity={0.88}
                    onPress={() => handleStartRoutine(routine.id)}
                  >
                    <Ionicons name="play" size={15} color="#FFFFFF" />
                    <Text style={styles.startRoutineButtonText}>Start Routine</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}

      {activeMode === 'exercises' ? (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Exercise Library</Text>
            <TouchableOpacity
              style={styles.createTemplateButton}
              onPress={() => setIsCreateExerciseModalVisible(true)}
              activeOpacity={0.88}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.createTemplateButtonText}>Custom</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionCaption}>Search by exercise name or muscle group.</Text>

          <View style={styles.toolbarRow}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={palette.textMuted} />
              <TextInput
                value={exerciseQuery}
                onChangeText={setExerciseQuery}
                placeholder="Search exercises"
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
              <Text style={styles.statusText}>Loading exercises...</Text>
            </View>
          ) : catalogError ? (
            <View style={styles.statusContainer}>
              <Text style={styles.statusTitle}>Unable to load exercises</Text>
              <Text style={styles.statusText}>{catalogError}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setHasLoadedCatalog(false);
                  void loadCatalogExercises();
                }}
                activeOpacity={0.88}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : groupedExercises.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No exercises found</Text>
              <Text style={styles.emptySubtitle}>Try another keyword or create a custom movement.</Text>
            </View>
          ) : (
            groupedExercises.map(([muscle, groupedItems]) => (
              <View key={muscle} style={styles.groupSection}>
                <Text style={styles.groupTitle}>{muscle}</Text>
                {groupedItems.map((exercise) => (
                  <View key={exercise.id} style={styles.exerciseRow}>
                    <View style={styles.exerciseTextWrap}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.exerciseMeta}>{exercise.equipment ?? 'Bodyweight'}</Text>
                    </View>
                    <Text style={styles.exerciseMuscle}>{exercise.muscle_group ?? 'General'}</Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </>
      ) : null}

      <Modal
        visible={isCreateTemplateModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCreateTemplateModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setIsCreateTemplateModalVisible(false)} />

          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Create Template</Text>

            <TextInput
              value={templateNameInput}
              onChangeText={(value) => setTemplateNameInput(value.substring(0, INPUT_LIMITS.nameMax))}
              style={styles.modalInput}
              placeholder="Template Name"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
              maxLength={INPUT_LIMITS.nameMax}
            />

            <Text style={styles.modalSectionTitle}>Exercises ({selectedTemplateExercises.length})</Text>

            {isLoadingCatalog ? (
              <View style={styles.modalStatusContainer}>
                <ActivityIndicator size="small" color={palette.accent} />
                <Text style={styles.modalStatusText}>Loading exercise catalog...</Text>
              </View>
            ) : catalogError ? (
              <View style={styles.modalStatusContainer}>
                <Text style={styles.modalStatusTitle}>Unable to load exercises</Text>
                <Text style={styles.modalStatusText}>{catalogError}</Text>
                <TouchableOpacity
                  style={styles.modalRetryButton}
                  onPress={() => void loadCatalogExercises()}
                  activeOpacity={0.88}
                >
                  <Text style={styles.modalRetryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : catalogExercises.length === 0 ? (
              <View style={styles.modalStatusContainer}>
                <Text style={styles.modalStatusTitle}>No exercises available</Text>
                <Text style={styles.modalStatusText}>Create exercises first, then build templates.</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {catalogExercises.map((exercise) => {
                  const selectedOrder = selectionOrder.get(exercise.id);
                  const selectedEntry = selectedTemplateExercises.find((entry) => entry.exerciseId === exercise.id);
                  const isSelected = selectedEntry !== undefined;

                  if (isSelected) {
                    return (
                      <View key={exercise.id} style={[styles.modalExerciseRow, styles.modalExerciseRowSelected]}>
                        <View style={styles.modalExerciseTextWrap}>
                          <Text style={styles.modalExerciseName}>{exercise.name}</Text>
                          <Text style={styles.modalExerciseMeta}>
                            {exercise.muscle_group ?? 'General'} - {exercise.equipment ?? 'Bodyweight'}
                          </Text>

                          <View style={styles.restInputRow}>
                            <Text style={styles.restInputLabel}>Rest (s)</Text>
                            <TextInput
                              value={selectedEntry.restSecondsInput}
                              onChangeText={(value) => updateExerciseRestSeconds(exercise.id, value)}
                              style={styles.restInput}
                              keyboardType="numeric"
                              placeholder="90"
                              placeholderTextColor={palette.textMuted}
                              maxLength={3}
                            />
                          </View>
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
                        <Text style={styles.modalExerciseName}>{exercise.name}</Text>
                        <Text style={styles.modalExerciseMeta}>
                          {exercise.muscle_group ?? 'General'} - {exercise.equipment ?? 'Bodyweight'}
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
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
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
                  <Text style={styles.modalCreateButtonText}>Save Template</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isCreateRoutineModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCreateRoutineModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setIsCreateRoutineModalVisible(false)} />

          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Create Routine</Text>

            <TextInput
              value={routineNameInput}
              onChangeText={(value) => setRoutineNameInput(value.substring(0, INPUT_LIMITS.nameMax))}
              style={styles.modalInput}
              placeholder="Routine Name"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
              maxLength={INPUT_LIMITS.nameMax}
            />
            <TextInput
              value={routineNotesInput}
              onChangeText={(value) => setRoutineNotesInput(value.substring(0, INPUT_LIMITS.notesMax))}
              style={[styles.modalInput, styles.modalNotesInput]}
              placeholder="Notes (optional)"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="sentences"
              multiline
              textAlignVertical="top"
              maxLength={INPUT_LIMITS.notesMax}
            />

            <Text style={styles.modalSectionTitle}>Exercises ({selectedRoutineExerciseIds.length})</Text>

            {isLoadingCatalog ? (
              <View style={styles.modalStatusContainer}>
                <ActivityIndicator size="small" color={palette.accent} />
                <Text style={styles.modalStatusText}>Loading exercise catalog...</Text>
              </View>
            ) : catalogError ? (
              <View style={styles.modalStatusContainer}>
                <Text style={styles.modalStatusTitle}>Unable to load exercises</Text>
                <Text style={styles.modalStatusText}>{catalogError}</Text>
                <TouchableOpacity
                  style={styles.modalRetryButton}
                  onPress={() => {
                    setHasLoadedCatalog(false);
                    void loadCatalogExercises();
                  }}
                  activeOpacity={0.88}
                >
                  <Text style={styles.modalRetryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : catalogExercises.length === 0 ? (
              <View style={styles.modalStatusContainer}>
                <Text style={styles.modalStatusTitle}>No exercises available</Text>
                <Text style={styles.modalStatusText}>Create exercises first, then build routines.</Text>
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
                        <Text style={styles.modalExerciseName}>{exercise.name}</Text>
                        <Text style={styles.modalExerciseMeta}>
                          {exercise.muscle_group ?? 'General'} - {exercise.equipment ?? 'Bodyweight'}
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
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
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
                  <Text style={styles.modalCreateButtonText}>Create Routine</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isCreateExerciseModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCreateExerciseModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setIsCreateExerciseModalVisible(false)} />

          <View style={styles.modalSheet}>
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
            <TextInput
              value={muscleGroupInput}
              onChangeText={(value) => setMuscleGroupInput(value.substring(0, INPUT_LIMITS.nameMax))}
              placeholder="Muscle Group"
              placeholderTextColor={palette.textMuted}
              style={styles.modalInput}
              autoCapitalize="words"
              maxLength={INPUT_LIMITS.nameMax}
            />
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
                onPress={() => setIsCreateExerciseModalVisible(false)}
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
    borderRadius: 14,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalExerciseRowSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
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
  },
  restInputRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  restInputLabel: {
    color: '#B8C6DB',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  restInput: {
    minWidth: 68,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#122744',
    color: '#E5EDFF',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 8,
    fontVariant: ['tabular-nums'],
  },
  selectedActionsWrap: {
    alignItems: 'center',
    rowGap: 8,
  },
  orderBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  orderBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  removeSelectedButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
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