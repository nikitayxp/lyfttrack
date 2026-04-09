import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import {
  getErrorMessage,
  getWorkoutDetails,
  type WorkoutDetails,
  type WorkoutSetType,
} from '@/services/workoutService';
import { formatRelativeTime } from '@/utils/dateUtils';

const palette = Colors.dark;
const SCREEN_BG = '#050A12';
const CARD_BG = '#111827';
const ROOT_SCREEN_BG = SCREEN_BG;

function resolveRouteWorkoutId(rawValue: string | string[] | undefined): string | null {
  if (!rawValue) {
    return null;
  }

  if (Array.isArray(rawValue)) {
    return rawValue[0]?.trim() || null;
  }

  return rawValue.trim() || null;
}

function formatDurationFromSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.trunc(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
  }

  return [minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
}

function formatNumericValue(value: number | null, mode: 'decimal' | 'integer'): string {
  if (value === null || !Number.isFinite(value)) {
    return '-';
  }

  if (mode === 'integer') {
    return `${Math.trunc(value)}`;
  }

  if (Number.isInteger(value)) {
    return `${value}`;
  }

  return value.toFixed(1);
}

function formatSetType(setType: WorkoutSetType): string {
  if (setType === 'warmup') return 'Aquecimento';
  if (setType === 'drop') return 'Dropset';
  if (setType === 'failure') return 'Falha';
  return 'Trabalho';
}

function profileDisplayName(details: WorkoutDetails): string {
  const fullName = details.profile?.full_name?.trim();
  const username = details.profile?.username?.trim();

  return fullName || username || 'Atleta';
}

function initialsFromName(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function WorkoutDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const workoutId = useMemo(() => resolveRouteWorkoutId(params.id), [params.id]);

  const [details, setDetails] = useState<WorkoutDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    if (!workoutId) {
      setLoadError('ID do treino em falta na rota.');
      setDetails(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await getWorkoutDetails(workoutId);
      setDetails(result);
    } catch (error) {
      setDetails(null);
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [workoutId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const topDisplayName = useMemo(() => {
    if (!details) {
      return 'Atleta';
    }

    return profileDisplayName(details);
  }, [details]);

  const topInitials = useMemo(() => initialsFromName(topDisplayName), [topDisplayName]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.86} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={palette.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Detalhes do treino</Text>

        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.statusWrap}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.statusText}>A carregar detalhes do treino...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.statusWrap}>
          <Text style={styles.statusTitle}>Nao foi possivel carregar o treino</Text>
          <Text style={styles.statusText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryButton} activeOpacity={0.88} onPress={() => void loadDetails()}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : !details ? (
        <View style={styles.statusWrap}>
          <Text style={styles.statusTitle}>Treino indisponivel</Text>
          <Text style={styles.statusText}>Este treino nao existe ou nao esta acessivel.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.profileRow}>
              {details.profile?.avatar_url ? (
                <Image source={{ uri: details.profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{topInitials}</Text>
                </View>
              )}

              <View style={styles.profileTextWrap}>
                <Text style={styles.profileName}>{topDisplayName}</Text>
                <Text style={styles.profileMeta}>{formatRelativeTime(details.start_time)}</Text>
              </View>
            </View>

            <Text style={styles.workoutName}>{details.name}</Text>
            {details.notes ? <Text style={styles.workoutNotes}>{details.notes}</Text> : null}

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Tempo</Text>
                <Text style={styles.statValue}>{formatDurationFromSeconds(details.durationSeconds)}</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Series</Text>
                <Text style={styles.statValue}>{details.totalSets}</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Recordes</Text>
                <Text style={styles.statValue}>{details.prCount}</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>PR 1RM</Text>
                <Text style={styles.statValue}>
                  {details.bestEstimated1RM !== null ? `${formatNumericValue(details.bestEstimated1RM, 'decimal')} kg` : '--'}
                </Text>
              </View>
            </View>

            {details.heaviestWeight !== null ? (
              <View style={styles.topSetPill}>
                <Ionicons name="trophy-outline" size={13} color="#F59E0B" />
                <Text style={styles.topSetPillText}>Melhor set: {formatNumericValue(details.heaviestWeight, 'decimal')} kg</Text>
              </View>
            ) : null}
          </View>

          {details.exercises.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Sem sets registados</Text>
              <Text style={styles.emptyText}>Este treino nao contem sets registados.</Text>
            </View>
          ) : (
            details.exercises.map((exercise) => (
              <View key={`${exercise.id ?? exercise.exercise_id}-${exercise.order}`} style={styles.exerciseCard}>
                <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
                <Text style={styles.exerciseMeta}>
                  {(exercise.muscle_group ?? 'Geral') + ' - ' + (exercise.equipment ?? 'Peso corporal')}
                </Text>

                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text style={[styles.headerCell, styles.cellSet]}>Serie</Text>
                  <Text style={[styles.headerCell, styles.cellKg]}>kg</Text>
                  <Text style={[styles.headerCell, styles.cellReps]}>Reps</Text>
                  <Text style={[styles.headerCell, styles.cellRir]}>RIR</Text>
                  <Text style={[styles.headerCell, styles.cellType]}>Tipo</Text>
                </View>

                {exercise.sets.map((setItem) => (
                  <View key={setItem.id} style={styles.tableRow}>
                    <Text style={[styles.valueCell, styles.cellSet]}>{setItem.set_number ?? '-'}</Text>
                    <Text style={[styles.valueCell, styles.cellKg]}>{formatNumericValue(setItem.weight, 'decimal')}</Text>
                    <Text style={[styles.valueCell, styles.cellReps]}>{formatNumericValue(setItem.reps, 'integer')}</Text>
                    <Text style={[styles.valueCell, styles.cellRir]}>{formatNumericValue(setItem.rir, 'decimal')}</Text>
                    <Text style={[styles.valueCell, styles.cellType]}>{formatSetType(setItem.set_type)}</Text>
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
    backgroundColor: ROOT_SCREEN_BG,
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
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  scroll: {
    flex: 1,
    backgroundColor: ROOT_SCREEN_BG,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 34,
  },
  statusWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  statusTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  retryButton: {
    marginTop: 14,
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: CARD_BG,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 10,
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12335E',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  profileTextWrap: {
    flex: 1,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  profileMeta: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  workoutName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  workoutNotes: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    marginTop: 4,
  },
  statCard: {
    width: '48.5%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0D1624',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  topSetPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#78350F',
    backgroundColor: '#2A1E10',
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  topSetPillText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: CARD_BG,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  exerciseCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#253041',
    backgroundColor: CARD_BG,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 3,
  },
  exerciseMeta: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  tableHeaderRow: {
    borderRadius: 11,
    backgroundColor: '#0D1624',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
    columnGap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  headerCell: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
  },
  valueCell: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  cellSet: {
    width: 34,
  },
  cellKg: {
    width: 64,
  },
  cellReps: {
    width: 64,
  },
  cellRir: {
    width: 64,
  },
  cellType: {
    flex: 1,
    textAlign: 'right',
  },
});
