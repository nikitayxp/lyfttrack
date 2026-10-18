import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/theme';
import { EXERCISE_MUSCLE_LABELS, type ExerciseMuscleKey } from '@/constants/exerciseCatalog';
import type { AllTimePR } from '@/services/statsService';
import { getErrorMessage } from '@/services/workoutService';
import { getLocalizedExerciseName } from '@/utils/exerciseLocalization';
import { formatTrophyDate, selectTrophies, trophyShareText, type TrophySort } from '@/utils/trophyRoom';
import { useAppToast } from '@/context/ToastContext';
import { showAlert } from '@/utils/showAlert';

const palette = Colors.dark;
type Props = { records: AllTimePR[]; language: string; loading: boolean; error: string | null; onRetry: () => void };

function TrophyRow({ record: item, language, onSelect }: { record: AllTimePR; language: string; onSelect: (record: AllTimePR) => void }) {
  const { t } = useTranslation();
  const locale = language.startsWith('pt') ? 'pt-PT' : 'en-GB';
  const nameOf = (record: AllTimePR) => getLocalizedExerciseName(record.exercise, language.startsWith('pt') ? 'pt' : 'en');
  return (
    <Pressable style={({ pressed }) => [styles.record, pressed && styles.pressed]} onPress={() => onSelect(item)}
      accessibilityRole="button" accessibilityLabel={t('profile.openTrophy', { exercise: nameOf(item) })}>
      <View style={styles.recordBody}>
        <Text style={styles.recordName}>{nameOf(item)}</Text>
        <Text style={styles.date}>{formatTrophyDate(item.achievedAt, language)}</Text>
      </View>
      <View style={styles.recordScore}>
        <Text style={styles.rowWeight}>{item.maxWeight.toLocaleString(locale, { maximumFractionDigits: 1 })}<Text style={styles.unit}> kg</Text></Text>
        <Ionicons name="chevron-forward" size={16} color={palette.textMuted} />
      </View>
    </Pressable>
  );
}

export function TrophyRoomPreview({ records, language, loading, error, onRetry, onSelect, onBrowse }: Props & { onSelect: (record: AllTimePR) => void; onBrowse: () => void }) {
  const { t } = useTranslation();
  const recent = useMemo(() => selectTrophies(records, { language, limit: 3 }), [records, language]);
  const nameOf = (record: AllTimePR) => getLocalizedExerciseName(record.exercise, language.startsWith('pt') ? 'pt' : 'en');
  const weightOf = (record: AllTimePR) => record.maxWeight.toLocaleString(language.startsWith('pt') ? 'pt-PT' : 'en-GB', { maximumFractionDigits: 1 });
  return (
    <View style={styles.room}>
      <View style={styles.heading}>
        <View style={styles.emblem}><Ionicons name="trophy-outline" size={23} color={palette.accentLight} /></View>
        <View style={styles.headingText}>
          <Text style={styles.title}>{t('profile.trophiesTitle')}</Text>
          <Text style={styles.description}>{t('profile.trophyDescription')}</Text>
        </View>
      </View>
      {loading ? <View style={styles.status}><ActivityIndicator color={palette.accentLight} /><Text style={styles.description}>{t('profile.trophyLoading')}</Text></View>
        : error ? <View style={styles.status}>
          <Text style={styles.recordName}>{t('profile.performanceSummaryErrorTitle')}</Text>
          <Text style={styles.description}>{error}</Text>
          <Pressable style={styles.secondaryButton} accessibilityRole="button" onPress={onRetry}><Text style={styles.buttonText}>{t('common.retry')}</Text></Pressable>
        </View> : recent.length === 0 ? <View style={styles.status}>
          <Text style={styles.recordName}>{t('profile.noTrophiesTitle')}</Text><Text style={styles.description}>{t('profile.noTrophiesDescription')}</Text>
        </View> : <>
          <View style={styles.summary}><Text style={styles.eyebrow}>{t('profile.trophyRecent')}</Text><Text style={styles.date}>{t('profile.trophyCount', { count: records.length })}</Text></View>
          <Pressable style={({ pressed }) => [styles.featured, pressed && styles.pressed]} onPress={() => onSelect(recent[0])}
            accessibilityRole="button" accessibilityLabel={t('profile.openTrophy', { exercise: nameOf(recent[0]) })}>
            <View style={styles.featuredTop}><Text style={styles.date}>{formatTrophyDate(recent[0].achievedAt, language)}</Text><Ionicons name="arrow-forward" size={19} color={palette.accentLight} /></View>
            <Text style={styles.featuredWeight}>{weightOf(recent[0])}<Text style={styles.featuredUnit}> kg</Text></Text>
            <Text style={styles.featuredName}>{nameOf(recent[0])}</Text>
          </Pressable>
          {recent.slice(1).map(item => <TrophyRow key={item.exerciseId} record={item} language={language} onSelect={onSelect} />)}
          <Pressable style={styles.browseButton} accessibilityRole="button" onPress={onBrowse}>
            <Text style={styles.buttonText}>{t('profile.trophyViewAll', { count: records.length })}</Text><Ionicons name="arrow-forward" size={18} color={palette.textPrimary} />
          </Pressable>
        </>}

    </View>
  );
}

export function TrophyRoom({ records, language, initialSelectedId, onClose }: { records: AllTimePR[]; language: string; initialSelectedId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { showToast } = useAppToast();
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<ExerciseMuscleKey | 'all'>('all');
  const [sort, setSort] = useState<TrophySort>('recent');
  const [sharing, setSharing] = useState(false);
  const captureRef = useRef<ViewShot | null>(null);
  const shareRequestRef = useRef(0);
  const selectedRef = useRef<AllTimePR | undefined>(undefined);
  const isPortuguese = language.startsWith('pt');
  const locale = isPortuguese ? 'pt-PT' : 'en-GB';
  const filtered = useMemo(() => selectTrophies(records, { language, query, muscle, sort }), [records, language, query, muscle, sort]);
  const muscles = useMemo(() => [...new Set(records.map(record => record.muscleKey).filter((key): key is ExerciseMuscleKey => Boolean(key)))]
    .sort((a, b) => EXERCISE_MUSCLE_LABELS[a][isPortuguese ? 'pt' : 'en'].localeCompare(EXERCISE_MUSCLE_LABELS[b][isPortuguese ? 'pt' : 'en'])), [records, isPortuguese]);
  const selected = records.find(record => record.exerciseId === selectedId);
  selectedRef.current = selected;
  useEffect(() => () => { shareRequestRef.current++; }, []);
  const nameOf = useCallback((record: AllTimePR) => getLocalizedExerciseName(record.exercise, language.startsWith('pt') ? 'pt' : 'en'), [language]);
  const weightOf = (record: AllTimePR) => record.maxWeight.toLocaleString(locale, { maximumFractionDigits: 1 });
  const close = () => { shareRequestRef.current++; setSharing(false); setSelectedId(null); onClose(); };
  const openRecord = useCallback((record: AllTimePR) => { shareRequestRef.current++; setSharing(false); setSelectedId(record.exerciseId); }, []);

  const share = async () => {
    if (!selected || sharing) return;
    const request = ++shareRequestRef.current;
    const isCurrent = () => request === shareRequestRef.current && selectedRef.current === selected;
    setSharing(true);
    try {
      if (Platform.OS === 'web') {
        const copied = await Clipboard.setStringAsync(trophyShareText(selected, language));
        if (!isCurrent()) return;
        if (!copied) throw new Error(t('profile.trophyCopyError'));
        showAlert(showToast, t('profile.trophyCopied'), t('profile.trophyCopiedDescription'), 'info');
      } else {
        const available = await Sharing.isAvailableAsync();
        if (!isCurrent()) return;
        if (!available) {
          showAlert(showToast, t('profile.shareUnavailableTitle'), t('profile.shareUnavailableDescription'), 'error');
          return;
        }
        const uri = await captureRef.current?.capture?.();
        if (!isCurrent()) return;
        if (!uri) throw new Error(t('profile.capturePrCardError'));
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `${nameOf(selected)} PR`, UTI: 'public.png' });
      }
    } catch (cause) {
      if (isCurrent()) showAlert(showToast, t('profile.sharePrCardError'), getErrorMessage(cause), 'error');
    } finally {
      if (request === shareRequestRef.current) setSharing(false);
    }
  };

  const renderRecord = useCallback(({ item }: { item: AllTimePR }) => <TrophyRow record={item} language={language} onSelect={openRecord} />, [language, openRecord]);

  return (
      <Modal visible transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <SafeAreaView style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.toolbar}>
              {selected ? <Pressable style={styles.iconButton} accessibilityRole="button" accessibilityLabel={t('profile.trophyBackToCollection')} onPress={() => setSelectedId(null)}><Ionicons name="arrow-back" size={22} color={palette.textPrimary} /></Pressable> : null}
              <Text style={styles.sheetTitle}>{t(selected ? 'profile.trophyDetails' : 'profile.trophiesTitle')}</Text>
              <Pressable style={styles.iconButton} accessibilityRole="button" accessibilityLabel={t('profile.trophyClose')} onPress={close}><Ionicons name="close" size={24} color={palette.textPrimary} /></Pressable>
            </View>
            {selected ? <ScrollView contentContainerStyle={styles.detailContent}>
              <ViewShot ref={captureRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
                <View style={styles.shareCard}>
                  <View style={styles.shareBrand}><Text style={styles.eyebrow}>LYFTTRACK</Text><Ionicons name="trophy" size={28} color={palette.accentLight} /></View>
                  <Text style={styles.detailLabel}>{t('profile.trophyBestWeight')}</Text>
                  <Text style={styles.detailWeight}>{weightOf(selected)}<Text style={styles.featuredUnit}> kg</Text></Text>
                  <Text style={styles.detailName}>{nameOf(selected)}</Text>
                  {selected.muscleKey ? <Text style={styles.muscleName}>{EXERCISE_MUSCLE_LABELS[selected.muscleKey][isPortuguese ? 'pt' : 'en']}</Text> : null}
                  <View style={styles.detailDate}><Text style={styles.date}>{t('profile.trophyAchievedOn')}</Text><Text style={styles.recordName}>{formatTrophyDate(selected.achievedAt, language)}</Text></View>
                </View>
              </ViewShot>
              <Pressable style={styles.browseButton} accessibilityRole="button" disabled={sharing} onPress={() => void share()}>
                {sharing ? <ActivityIndicator color={palette.textPrimary} /> : <Ionicons name={Platform.OS === 'web' ? 'copy-outline' : 'share-social-outline'} size={20} color={palette.textPrimary} />}
                <Text style={styles.buttonText}>{t(Platform.OS === 'web' ? 'profile.trophyCopy' : 'profile.trophyShare')}</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} accessibilityRole="button" onPress={() => { const id = selected.exerciseId; close(); router.push({ pathname: '/exercise/[id]', params: { id } }); }}>
                <Text style={styles.buttonText}>{t('profile.trophyViewProgress')}</Text><Ionicons name="trending-up" size={20} color={palette.accentLight} />
              </Pressable>
            </ScrollView> : <>
              <View style={styles.filters}>
                <View style={styles.search}><Ionicons name="search" size={19} color={palette.textMuted} /><TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder={t('profile.trophySearch')} placeholderTextColor={palette.textMuted} accessibilityLabel={t('profile.trophySearch')} autoCorrect={false} />
                  {query ? <Pressable style={styles.iconButton} accessibilityRole="button" accessibilityLabel={t('profile.trophyClearSearch')} onPress={() => setQuery('')}><Ionicons name="close-circle" size={19} color={palette.textSecondary} /></Pressable> : null}
                </View>
                <View style={styles.sortRow}>{(['recent', 'weight'] as const).map(value => <Pressable key={value} style={[styles.sortButton, sort === value && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: sort === value }} onPress={() => setSort(value)}><Text style={styles.filterText}>{t(value === 'recent' ? 'profile.trophySortRecent' : 'profile.trophySortWeight')}</Text></Pressable>)}</View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  <Pressable style={[styles.chip, muscle === 'all' && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: muscle === 'all' }} onPress={() => setMuscle('all')}><Text style={styles.filterText}>{t('profile.trophyAllMuscles')}</Text></Pressable>
                  {muscles.map(key => <Pressable key={key} style={[styles.chip, muscle === key && styles.chipActive]} accessibilityRole="button" accessibilityState={{ selected: muscle === key }} onPress={() => setMuscle(key)}><Text style={styles.filterText}>{EXERCISE_MUSCLE_LABELS[key][isPortuguese ? 'pt' : 'en']}</Text></Pressable>)}
                </ScrollView>
                <Text style={styles.date} accessibilityLiveRegion="polite">{t('profile.trophyCount', { count: filtered.length })}</Text>
              </View>
              <FlatList data={filtered} renderItem={renderRecord} keyExtractor={item => item.exerciseId} keyboardShouldPersistTaps="handled" style={styles.listViewport} contentContainerStyle={styles.list} initialNumToRender={10} windowSize={5} maxToRenderPerBatch={10}
                ListEmptyComponent={<View style={styles.status}><Ionicons name="search-outline" size={30} color={palette.textMuted} /><Text style={styles.recordName}>{t('profile.trophyNoResults')}</Text><Text style={styles.description}>{t('profile.trophyNoResultsDescription')}</Text></View>} />
            </>}
          </SafeAreaView>
        </View>
      </Modal>
  );
}

const styles = StyleSheet.create({
  room: { borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, borderRadius: 22, padding: 14, gap: 12, marginBottom: 18 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emblem: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.accentSoft, alignItems: 'center', justifyContent: 'center' },
  headingText: { flex: 1, minWidth: 0 },
  title: { color: palette.textPrimary, fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
  description: { color: palette.textMuted, fontSize: 12, lineHeight: 18 },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  eyebrow: { color: palette.accentLight, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  featured: { borderWidth: 1, borderColor: palette.accentStrong, borderRadius: 16, backgroundColor: palette.accentSoft, padding: 16, gap: 4 },
  featuredTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featuredWeight: { color: palette.textPrimary, fontSize: 42, fontWeight: '900', letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  featuredUnit: { fontSize: 20, fontWeight: '600', color: palette.accentLight, letterSpacing: 0 },
  featuredName: { color: palette.textPrimary, fontSize: 15, fontWeight: '700', lineHeight: 21 },
  record: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 76, paddingVertical: 14, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: palette.border },
  recordBody: { flex: 1, minWidth: 0, gap: 5 },
  recordName: { color: palette.textPrimary, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  recordScore: { alignItems: 'flex-end', gap: 5, flexShrink: 0 },
  rowWeight: { color: palette.textPrimary, fontSize: 21, fontWeight: '800', fontVariant: ['tabular-nums'] },
  unit: { color: palette.textMuted, fontSize: 12, fontWeight: '500' },
  date: { color: palette.textMuted, fontSize: 11, lineHeight: 16 },
  browseButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: palette.accentStrong, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  secondaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  buttonText: { color: palette.textPrimary, fontSize: 13, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  pressed: { opacity: 0.75 },
  status: { paddingVertical: 24, gap: 10, alignItems: 'center' },
  overlay: { flex: 1, backgroundColor: palette.overlayLight, alignItems: 'center' },
  sheet: { flex: 1, width: '100%', maxWidth: 520, backgroundColor: palette.bgPrimary },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 64, borderBottomWidth: 1, borderBottomColor: palette.border },
  sheetTitle: { flex: 1, color: palette.textPrimary, fontSize: 19, fontWeight: '800' },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  filters: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderWidth: 1, borderColor: palette.inputStroke, borderRadius: 12, paddingLeft: 12, backgroundColor: palette.surface },
  searchInput: { flex: 1, minWidth: 0, minHeight: 48, color: palette.textPrimary, fontSize: 14 },
  sortRow: { flexDirection: 'row', gap: 8 },
  sortButton: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  chips: { gap: 8, paddingBottom: 4 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chipActive: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
  filterText: { color: palette.textPrimary, fontSize: 12, fontWeight: '600' },
  listViewport: { flex: 1, minHeight: 0 },
  list: { paddingHorizontal: 16, paddingBottom: 28 },
  detailContent: { padding: 16, gap: 12, paddingBottom: 32 },
  shareCard: { backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1, borderColor: palette.borderStrong, padding: 22, gap: 12 },
  shareBrand: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  detailLabel: { color: palette.textSecondary, fontSize: 13 },
  detailWeight: { color: palette.textPrimary, fontSize: 56, fontWeight: '900', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  detailName: { color: palette.textPrimary, fontSize: 23, fontWeight: '800', lineHeight: 30 },
  muscleName: { color: palette.accentLight, fontSize: 13 },
  detailDate: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 18, marginTop: 14, gap: 5 },
});
