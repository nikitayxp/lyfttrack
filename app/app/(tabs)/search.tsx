import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { searchUsers, type SocialSearchResult } from '@/services/socialService';

const palette = Colors.dark;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Erro desconhecido.';
}

function displayNameOf(profile: SocialSearchResult): string {
  return profile.full_name?.trim() || profile.username;
}

function initialsOf(profile: SocialSearchResult): string {
  return displayNameOf(profile)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SocialSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasQuery = useMemo(() => query.trim().length >= 2, [query]);

  const runSearch = useCallback(async (value: string) => {
    const normalizedValue = value.trim();

    if (normalizedValue.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const users = await searchUsers(normalizedValue);
      setResults(users);
    } catch (searchError) {
      setError(toErrorMessage(searchError));
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void runSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, runSearch]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>PESQUISAR ATLETAS</Text>
      <Text style={styles.subtitle}>Procura por nome ou username.</Text>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={palette.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Escreve pelo menos 2 caracteres"
          placeholderTextColor={palette.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
      </View>

      {isSearching ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={palette.accent} />
          <Text style={styles.statusText}>A pesquisar...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.statusRow}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, results.length === 0 && styles.listContentEmpty]}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.resultCard}
            activeOpacity={0.86}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/profile/[id]' as any,
                params: { id: item.id },
              })
            }
          >
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{initialsOf(item)}</Text>
              </View>
            )}

            <View style={styles.metaWrap}>
              <Text style={styles.name}>{displayNameOf(item)}</Text>
              <Text style={styles.username}>@{item.username}</Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="search-outline" size={24} color={palette.textMuted} />
            <Text style={styles.emptyTitle}>{hasQuery ? 'Sem resultados' : 'Comeca por pesquisar'}</Text>
            <Text style={styles.emptyDescription}>
              {hasQuery
                ? 'Nao encontrámos perfis com esse texto.'
                : 'A lista aparece aqui assim que escreveres no campo acima.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 4,
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  searchBox: {
    marginTop: 18,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#111111',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  searchInput: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 12,
  },
  statusRow: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: '#111111',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  statusText: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: palette.error,
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 24,
    rowGap: 10,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  resultCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#111111',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: palette.accent,
    fontSize: 16,
    fontWeight: '900',
  },
  metaWrap: {
    flex: 1,
  },
  name: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  username: {
    marginTop: 2,
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 8,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyDescription: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
