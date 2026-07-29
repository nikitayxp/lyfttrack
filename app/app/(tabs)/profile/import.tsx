import { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File as FileSystemFile } from 'expo-file-system';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/theme';
import { ACTIVE_OPACITY, Radius, Spacing } from '@/constants/Styles';
import {
  buildImportPlan,
  runImport,
  type ImportPlan,
  type ImportSummary,
} from '@/services/import/importService';
import { notifyWorkoutsImported } from '@/services/import/importEvents';

const palette = Colors.dark;

/** Reading a picked file differs by platform, and only in how you get the text. */
async function readPickedFile(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web') {
    const webFile = (asset as { file?: { text: () => Promise<string> } }).file;
    if (webFile?.text) {
      return webFile.text();
    }
    const response = await fetch(asset.uri);
    return response.text();
  }

  return new FileSystemFile(asset.uri).text();
}

type Stage =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'preview'; plan: ImportPlan; fileName: string }
  | { kind: 'importing'; done: number; total: number }
  | { kind: 'done'; summary: ImportSummary };

export default function ImportDataScreen() {
  const { t, i18n } = useTranslation();
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language === 'pt' ? 'pt-PT' : 'en-GB', { dateStyle: 'medium' }),
    [i18n.language]
  );

  const formatDate = useCallback(
    (iso: string) => {
      const parsed = new Date(iso);
      return Number.isNaN(parsed.getTime()) ? iso : dateFormatter.format(parsed);
    },
    [dateFormatter]
  );

  const pickFile = useCallback(async () => {
    setError(null);

    try {
      const picked = await DocumentPicker.getDocumentAsync({
        // Some Android file providers report a CSV as plain text or as an
        // unknown binary, so the filter stays wide rather than hiding the file
        // the user came here to choose.
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (picked.canceled || !picked.assets?.[0]) {
        return;
      }

      const asset = picked.assets[0];
      setStage({ kind: 'reading' });

      const text = await readPickedFile(asset);
      const plan = await buildImportPlan(text);

      if (plan.parse.workouts.length === 0) {
        setStage({ kind: 'idle' });
        setError(t('importData.errorNoWorkouts'));
        return;
      }

      setStage({ kind: 'preview', plan, fileName: asset.name ?? 'workout_data.csv' });
    } catch (err) {
      setStage({ kind: 'idle' });
      setError(err instanceof Error ? err.message : t('common.unknownError'));
    }
  }, [t]);

  const confirmImport = useCallback(async () => {
    if (stage.kind !== 'preview') return;

    const { plan } = stage;
    setError(null);
    setStage({ kind: 'importing', done: 0, total: plan.importableWorkouts });

    try {
      const summary = await runImport(plan, {
        onProgress: ({ done, total }) => setStage({ kind: 'importing', done, total }),
      });
      if (summary.importedWorkouts > 0) {
        notifyWorkoutsImported();
      }
      setStage({ kind: 'done', summary });
    } catch (err) {
      setStage({ kind: 'idle' });
      setError(err instanceof Error ? err.message : t('common.unknownError'));
    }
  }, [stage, t]);

  const renderIdle = () => (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('importData.sourceTitle')}</Text>
        <Text style={styles.cardSubtitle}>{t('importData.sourceSubtitle')}</Text>

        <View style={styles.sourceRow}>
          <View style={styles.sourceIconWrap}>
            <Ionicons name="barbell-outline" size={18} color={palette.accent} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Hevy</Text>
            <Text style={styles.rowSubtitle}>{t('importData.hevySubtitle')}</Text>
          </View>
          <Ionicons name="checkmark-circle" size={20} color={palette.success} />
        </View>

        <Text style={styles.hint}>{t('importData.moreAppsLater')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('importData.howTitle')}</Text>
        <Text style={styles.step}>{t('importData.step1')}</Text>
        <Text style={styles.step}>{t('importData.step2')}</Text>
        <Text style={styles.step}>{t('importData.step3')}</Text>
        <Text style={styles.hint}>{t('importData.measurementsNote')}</Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} activeOpacity={ACTIVE_OPACITY} onPress={() => void pickFile()}>
        <Ionicons name="document-attach-outline" size={18} color={palette.textPrimary} />
        <Text style={styles.primaryButtonText}>{t('importData.pickFile')}</Text>
      </TouchableOpacity>
    </>
  );

  const renderPreview = (plan: ImportPlan, fileName: string) => {
    const { stats, workouts } = plan.parse;
    const first = workouts[0];
    const last = workouts[workouts.length - 1];

    return (
      <>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('importData.previewTitle')}</Text>
          <Text style={styles.cardSubtitle}>{fileName}</Text>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{t('importData.statWorkouts')}</Text>
            <Text style={styles.statValue}>{stats.workouts}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{t('importData.statSets')}</Text>
            <Text style={styles.statValue}>{stats.sets}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{t('importData.statExercises')}</Text>
            <Text style={styles.statValue}>{plan.matches.length}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{t('importData.statRange')}</Text>
            <Text style={styles.statValue}>
              {first && last ? `${formatDate(first.startTime)} – ${formatDate(last.startTime)}` : '—'}
            </Text>
          </View>
        </View>

        {plan.duplicateStartTimes.length > 0 ? (
          <View style={[styles.card, styles.noticeCard]}>
            <Text style={styles.noticeTitle}>
              {t('importData.duplicatesTitle', { count: plan.duplicateStartTimes.length })}
            </Text>
            <Text style={styles.noticeText}>{t('importData.duplicatesText')}</Text>
          </View>
        ) : null}

        {plan.unmatchedTitles.length > 0 ? (
          <View style={[styles.card, styles.noticeCard]}>
            <Text style={styles.noticeTitle}>
              {t('importData.unmatchedTitle', { count: plan.unmatchedTitles.length })}
            </Text>
            <Text style={styles.noticeText}>{t('importData.unmatchedText')}</Text>
            <Text style={styles.noticeList}>{plan.unmatchedTitles.slice(0, 8).join(', ')}</Text>
          </View>
        ) : null}

        {stats.skippedRows > 0 || stats.droppedCardioFields > 0 ? (
          <View style={[styles.card, styles.noticeCard]}>
            <Text style={styles.noticeTitle}>{t('importData.warningsTitle')}</Text>
            {stats.skippedRows > 0 ? (
              <Text style={styles.noticeText}>{t('importData.skippedRows', { count: stats.skippedRows })}</Text>
            ) : null}
            {stats.droppedCardioFields > 0 ? (
              <Text style={styles.noticeText}>
                {t('importData.cardioDropped', { count: stats.droppedCardioFields })}
              </Text>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryButton, plan.importableWorkouts === 0 && styles.buttonDisabled]}
          activeOpacity={ACTIVE_OPACITY}
          disabled={plan.importableWorkouts === 0}
          onPress={() => void confirmImport()}
        >
          <Ionicons name="cloud-download-outline" size={18} color={palette.textPrimary} />
          <Text style={styles.primaryButtonText}>
            {t('importData.confirm', { count: plan.importableWorkouts })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={ACTIVE_OPACITY}
          onPress={() => setStage({ kind: 'idle' })}
        >
          <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </>
    );
  };

  const renderDone = (summary: ImportSummary) => (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('importData.doneTitle')}</Text>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>{t('importData.statImported')}</Text>
          <Text style={styles.statValue}>{summary.importedWorkouts}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>{t('importData.statSets')}</Text>
          <Text style={styles.statValue}>{summary.importedSets}</Text>
        </View>
        {summary.createdExercises > 0 ? (
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{t('importData.statCreatedExercises')}</Text>
            <Text style={styles.statValue}>{summary.createdExercises}</Text>
          </View>
        ) : null}
        {summary.skippedDuplicates > 0 ? (
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{t('importData.statSkipped')}</Text>
            <Text style={styles.statValue}>{summary.skippedDuplicates}</Text>
          </View>
        ) : null}
      </View>

      {summary.failedWorkouts.length > 0 ? (
        <View style={[styles.card, styles.noticeCard]}>
          <Text style={styles.noticeTitle}>
            {t('importData.failedTitle', { count: summary.failedWorkouts.length })}
          </Text>
          <Text style={styles.noticeText}>{t('importData.failedText')}</Text>
          <Text style={styles.noticeList}>
            {summary.failedWorkouts.slice(0, 5).map((item) => `${item.title} (${formatDate(item.startTime)})`).join(', ')}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.primaryButton}
        activeOpacity={ACTIVE_OPACITY}
        onPress={() => {
          notifyWorkoutsImported();
          router.replace('/(tabs)' as any);
        }}
      >
        <Text style={styles.primaryButtonText}>{t('importData.seeWorkouts')}</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={ACTIVE_OPACITY}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('settings.back')}
          >
            <Ionicons name="chevron-back" size={18} color={palette.textPrimary} />
            <Text style={styles.backButtonText}>{t('settings.back')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>{t('importData.title')}</Text>
        <Text style={styles.subtitle}>{t('importData.subtitle')}</Text>

        {error ? (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {stage.kind === 'idle' ? renderIdle() : null}

        {stage.kind === 'reading' ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.loadingText}>{t('importData.reading')}</Text>
          </View>
        ) : null}

        {stage.kind === 'preview' ? renderPreview(stage.plan, stage.fileName) : null}

        {stage.kind === 'importing' ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.loadingText}>
              {t('importData.importing', { done: stage.done, total: stage.total })}
            </Text>
            <Text style={styles.hint}>{t('importData.importingHint')}</Text>
          </View>
        ) : null}

        {stage.kind === 'done' ? renderDone(stage.summary) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bgPrimary },
  content: { padding: Spacing.lg, paddingBottom: Spacing.section, rowGap: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backButton: { flexDirection: 'row', alignItems: 'center', columnGap: Spacing.xs },
  backButtonText: { color: palette.textPrimary, fontSize: 15 },
  title: { color: palette.textPrimary, fontSize: 24, fontWeight: '700' },
  subtitle: { color: palette.textSecondary, fontSize: 13, lineHeight: 19 },
  card: {
    backgroundColor: palette.cardBg,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: Spacing.lg,
    rowGap: Spacing.sm,
  },
  cardTitle: { color: palette.textPrimary, fontSize: 15, fontWeight: '700' },
  cardSubtitle: { color: palette.textSecondary, fontSize: 12 },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  sourceIconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.button,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: { flex: 1, rowGap: 2 },
  rowTitle: { color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
  rowSubtitle: { color: palette.textMuted, fontSize: 12 },
  hint: { color: palette.textMuted, fontSize: 12, lineHeight: 18 },
  step: { color: palette.textSecondary, fontSize: 13, lineHeight: 20 },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statLabel: { color: palette.textSecondary, fontSize: 13, flex: 1 },
  statValue: { color: palette.textPrimary, fontSize: 14, fontWeight: '700' },
  noticeCard: { borderColor: palette.borderStrong, backgroundColor: palette.surfaceAlt },
  noticeTitle: { color: palette.textPrimary, fontSize: 13, fontWeight: '700' },
  noticeText: { color: palette.textSecondary, fontSize: 12, lineHeight: 18 },
  noticeList: { color: palette.textMuted, fontSize: 12, lineHeight: 18 },
  errorCard: { borderColor: palette.dangerBorder, backgroundColor: palette.dangerBg },
  errorText: { color: palette.errorText, fontSize: 13, lineHeight: 19 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: Spacing.sm,
    backgroundColor: palette.accent,
    borderRadius: Radius.button,
    paddingVertical: Spacing.md,
  },
  primaryButtonText: { color: palette.textPrimary, fontSize: 15, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
  secondaryButton: { alignItems: 'center', paddingVertical: Spacing.sm },
  secondaryButtonText: { color: palette.textSecondary, fontSize: 14 },
  centered: { alignItems: 'center', rowGap: Spacing.sm, paddingVertical: Spacing.xxl },
  loadingText: { color: palette.textSecondary, fontSize: 13 },
});
