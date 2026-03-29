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
import { getErrorMessage, getExercisesCatalog } from '@/services/workoutService';
import type { Tables } from '@/types/database';

const palette = Colors.dark;
const CARD_BG = '#111827';

type ExerciseRow = Tables<'exercises'>;
type SelectedTemplateExercise = {
  exerciseId: string;
  restSecondsInput: string;
};

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
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null);

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [selectedTemplateExercises, setSelectedTemplateExercises] = useState<SelectedTemplateExercise[]>([]);

  const [catalogExercises, setCatalogExercises] = useState<ExerciseRow[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const selectionOrder = useMemo(() => {
    return new Map(selectedTemplateExercises.map((entry, index) => [entry.exerciseId, index + 1]));
  }, [selectedTemplateExercises]);

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
      const exercises = await getExercisesCatalog();
      setCatalogExercises(exercises);
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
    if (!isCreateModalVisible) {
      return;
    }

    if (catalogExercises.length > 0 && !catalogError) {
      return;
    }

    void loadCatalogExercises();
  }, [catalogError, catalogExercises.length, isCreateModalVisible, loadCatalogExercises]);

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

  function resetTemplateForm() {
    setTemplateNameInput('');
    setSelectedTemplateExercises([]);
  }

  async function handleCreateTemplate() {
    const normalizedName = templateNameInput.trim();

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
      setIsCreateModalVisible(false);
      resetTemplateForm();
      await loadTemplates();
    } catch (error) {
      Alert.alert('Unable to create template', getErrorMessage(error));
    } finally {
      setIsSavingTemplate(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Workout</Text>
      <Text style={styles.subtitle}>Start from scratch or launch a routine template instantly.</Text>

      <TouchableOpacity style={styles.primaryButton} activeOpacity={0.9} onPress={handleStartEmptyWorkout}>
        <Ionicons name="play" size={22} color="#FFFFFF" />
        <Text style={styles.primaryButtonText}>Start Empty Workout</Text>
      </TouchableOpacity>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>My Routines</Text>
        <TouchableOpacity
          style={styles.createTemplateButton}
          activeOpacity={0.88}
          onPress={() => setIsCreateModalVisible(true)}
        >
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={styles.createTemplateButtonText}>Create Template</Text>
        </TouchableOpacity>
      </View>

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
          <View style={styles.statusContainer}>
            <Text style={styles.statusTitle}>No templates yet</Text>
            <Text style={styles.statusText}>Create your first template and launch workouts in one tap.</Text>
          </View>
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

      <Modal
        visible={isCreateModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setIsCreateModalVisible(false)} />

          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Create Template</Text>

            <TextInput
              value={templateNameInput}
              onChangeText={setTemplateNameInput}
              style={styles.modalInput}
              placeholder="Template Name"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
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
                onPress={() => setIsCreateModalVisible(false)}
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