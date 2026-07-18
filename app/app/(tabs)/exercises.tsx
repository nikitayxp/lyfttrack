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
import { Colors } from '@/constants/Colors';
import { ACTIVE_OPACITY, Radius } from '@/constants/Styles';
import {
  EXERCISE_EQUIPMENT_OPTIONS,
  EXERCISE_EQUIPMENT_TRANSLATION_KEY,
  EXERCISE_MUSCLE_OPTIONS,
  EXERCISE_MUSCLE_TRANSLATION_KEY,
  type ExerciseEquipmentKey,
  type ExerciseMuscleKey,
  getExerciseMuscleTranslationKey,
  getEquipmentTranslationKey,
} from '@/constants/exerciseCatalog';
import { usePreferences } from '@/context/PreferencesContext';
import type { Tables } from '@/types/database';
import { createExercise, getErrorMessage, getExercisesCatalog } from '@/services/workoutService';
import { INPUT_LIMITS, sanitizeText } from '@/utils/inputValidation';
import { getLocalizedExerciseMuscle, getLocalizedExerciseName } from '@/utils/exerciseLocalization';
import { ExerciseThumbnail } from '@/components/common/ExerciseThumbnail';

type ExerciseRow = Tables<'exercises'>;
const palette = Colors.dark;
const cardLayoutTransition = LinearTransition.springify().damping(16).stiffness(180);

export default function ExercisesScreen() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const isWeb = Platform.OS === 'web';
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
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

      setExerciseNameInput('');
      setSelectedMuscleKey(null);
      setSelectedEquipmentKey(null);
      setIsCreateModalVisible(false);
      await loadExercises();
      Alert.alert(t('exercise.success.createdTitle'), t('exercise.success.createdDescription'));
    } catch (error) {
      Alert.alert(t('exercise.errors.create'), getErrorMessage(error));
    } finally {
      setIsCreatingExercise(false);
    }
  }

  const groupedExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const getDisplayName = (exercise: ExerciseRow) => getLocalizedExerciseName(exercise, language);
    const getDisplayMuscle = (exercise: ExerciseRow) => {
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
    };

    const filtered = normalizedQuery
      ? exercises.filter((exercise) => {
          const byName = getDisplayName(exercise).toLowerCase().includes(normalizedQuery);
          const byMuscle = getDisplayMuscle(exercise).toLowerCase().includes(normalizedQuery);
          return byName || byMuscle;
        })
      : exercises;

    const groups = filtered.reduce<Record<string, ExerciseRow[]>>((acc, exercise) => {
      const groupKey = getDisplayMuscle(exercise);
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(exercise);
      return acc;
    }, {});

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [language, query, exercises, t]);

  const ModalWrapper = isWeb ? View : Modal;
  const modalProps = isWeb 
    ? { style: [StyleSheet.absoluteFill, { zIndex: 9999 }] }
    : {
        visible: isCreateModalVisible,
        transparent: true,
        animationType: 'slide' as const,
        onRequestClose: () => setIsCreateModalVisible(false),
      };

  const getExerciseEquipmentLabel = (exercise: ExerciseRow) => {
    const equipmentKey = getEquipmentTranslationKey(exercise.equipment);
    return equipmentKey ? t(equipmentKey) : exercise.equipment ?? t('exercise.equipment.bodyweight');
  };

  const getExerciseMuscleLabel = (exercise: ExerciseRow) => {
    const muscleKey = getExerciseMuscleTranslationKey({
      muscleGroup: exercise.muscle_group,
      muscleEn: exercise.muscle_en,
      musclePt: exercise.muscle_pt,
      name: exercise.name,
      nameEn: exercise.name_en,
      namePt: exercise.name_pt,
    });

    return muscleKey ? t(muscleKey) : getLocalizedExerciseMuscle(exercise, language) ?? t('exercise.general');
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
              accessibilityLabel={t('accessibility.searchExercises', { defaultValue: 'Search exercises' })}
              value={query}
              onChangeText={setQuery}
              placeholder={t('exercise.searchPlaceholder')}
              placeholderTextColor={palette.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity 
            style={styles.customButton} 
            onPress={() => setIsCreateModalVisible(true)} 
            activeOpacity={ACTIVE_OPACITY}
            accessibilityRole="button"
            accessibilityLabel={t('exercise.createTrigger')}
          >
            <Ionicons name="add-circle-outline" size={16} color={palette.accent} />
            <Text style={styles.customButtonText}>{t('exercise.createTrigger')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {isLoading ? (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.statusText}>{t('exercise.loadingCatalog')}</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.statusContainer}>
          <Text style={styles.statusTitle}>{t('exercise.errors.loadCatalog')}</Text>
          <Text style={styles.statusText}>{errorMessage}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => void loadExercises()} 
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
                  <TouchableOpacity
                    style={styles.exerciseRow}
                    activeOpacity={ACTIVE_OPACITY}
                    onPress={() => router.push(`/exercise/${exercise.id}` as any)}
                    accessibilityRole="button"
                    accessibilityLabel={t('accessibility.viewExerciseDetails', { name: getLocalizedExerciseName(exercise, language), defaultValue: 'View exercise details' })}
                  >
                    <ExerciseThumbnail exercise={exercise} size={40} />
                    <View style={styles.exerciseTextWrap}>
                      <Text style={styles.exerciseName}>{getLocalizedExerciseName(exercise, language)}</Text>
                      <Text style={styles.exerciseMeta}>{getExerciseEquipmentLabel(exercise)}</Text>
                    </View>
                    <Text style={styles.exerciseMuscle}>{getExerciseMuscleLabel(exercise)}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        ))
      )}

      {(!isCreateModalVisible && isWeb) ? null : (
      <ModalWrapper {...modalProps}>
        <View style={[styles.modalBackdrop, isWeb && styles.modalBackdropWeb]}>
          <Pressable 
            style={styles.modalDismissArea} 
            onPress={() => setIsCreateModalVisible(false)} 
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.closeModal', { defaultValue: 'Close modal' })}
          />

          <View style={[styles.modalSheet, isWeb && styles.modalSheetWeb]}>
            <View style={styles.modalHandle} />
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
            <Text style={styles.modalSectionTitle}>{t('workout.muscleGroup')}</Text>
            <View style={styles.muscleGrid}>
              {EXERCISE_MUSCLE_OPTIONS.map((muscleKey) => {
                const isSelected = selectedMuscleKey === muscleKey;
                return (
                  <TouchableOpacity
                    key={muscleKey}
                    style={[styles.muscleChip, isSelected && styles.muscleChipSelected]}
                    onPress={() => setSelectedMuscleKey(muscleKey)}
                    activeOpacity={ACTIVE_OPACITY}
                    accessibilityRole="button"
                    accessibilityLabel={t(EXERCISE_MUSCLE_TRANSLATION_KEY[muscleKey])}
                  >
                    <Text style={[styles.muscleChipText, isSelected && styles.muscleChipTextSelected]}>
                      {t(EXERCISE_MUSCLE_TRANSLATION_KEY[muscleKey])}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.modalSectionTitle}>{t('workout.equipment')}</Text>
            <View style={styles.muscleGrid}>
              {EXERCISE_EQUIPMENT_OPTIONS.map((equipmentKey) => {
                const isSelected = selectedEquipmentKey === equipmentKey;
                return (
                  <TouchableOpacity
                    key={equipmentKey}
                    style={[styles.muscleChip, isSelected && styles.muscleChipSelected]}
                    onPress={() => setSelectedEquipmentKey(equipmentKey)}
                    activeOpacity={ACTIVE_OPACITY}
                    accessibilityRole="button"
                    accessibilityLabel={t(EXERCISE_EQUIPMENT_TRANSLATION_KEY[equipmentKey])}
                  >
                    <Text style={[styles.muscleChipText, isSelected && styles.muscleChipTextSelected]}>
                      {t(EXERCISE_EQUIPMENT_TRANSLATION_KEY[equipmentKey])}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsCreateModalVisible(false)}
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
    borderRadius: Radius.card,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  customButton: {
    minHeight: 48,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.inputStroke,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: 6,
  },
  customButtonText: {
    color: palette.chipTextSelected,
    fontSize: 13,
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
  },
  retryButtonText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseThumbnail: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    marginRight: 12,
    backgroundColor: palette.surfaceAlt,
  },
  exerciseThumbnailPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    marginRight: 12,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.inputFill,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
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
    borderRadius: Radius.pill,
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
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    backgroundColor: palette.inputBackground,
  },
  muscleChipSelected: {
    borderColor: palette.accent,
    backgroundColor: `${palette.accent}1F`,
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
  muscleChipTextSelected: {
    color: palette.accent,
    fontWeight: '700',
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
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 10,
    marginTop: 6,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
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