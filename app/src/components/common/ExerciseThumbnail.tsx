import { memo, useMemo, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { getExerciseImageUrl, getExerciseThumbnailUrl } from '@/utils/exerciseImage';
import type { Tables } from '@/types/database';

const palette = Colors.dark;

type ExerciseImageSource = Pick<Tables<'exercises'>, 'name' | 'name_en' | 'name_pt' | 'image_url'>;

type ExerciseThumbnailProps = {
  exercise: ExerciseImageSource;
  size?: number;
};

function ExerciseThumbnailComponent({ exercise, size = 40 }: ExerciseThumbnailProps) {
  const { image_url, name, name_en, name_pt } = exercise;
  const imageUrl = useMemo(
    () => getExerciseImageUrl({ image_url, name, name_en, name_pt }),
    [image_url, name, name_en, name_pt],
  );
  const thumbnailUrl = Platform.OS === 'web' && imageUrl ? getExerciseThumbnailUrl(imageUrl) : null;
  const [failed, setFailed] = useState<{ imageUrl: string | null; source: string } | null>(null);
  const source = failed && failed.imageUrl === imageUrl
    ? (failed.source === imageUrl ? null : imageUrl)
    : thumbnailUrl ?? imageUrl;
  const radius = Math.max(6, size / 5);

  if (!source) {
    return (
      <View style={[styles.placeholder, { width: size, height: size, borderRadius: radius }]}>
        <Ionicons name="barbell-outline" size={Math.max(14, Math.round(size * 0.42))} color="#475569" />
      </View>
    );
  }

  return (
    <Image
      key={source}
      source={{ uri: source }}
      style={[styles.image, { width: size, height: size, borderRadius: radius }]}
      resizeMode="cover"
      // Avoid decoding every off-screen catalog image at once when switching to "All".
      fadeDuration={0}
      onError={() => setFailed({ imageUrl, source })}
    />
  );
}

export const ExerciseThumbnail = memo(ExerciseThumbnailComponent);

const styles = StyleSheet.create({
  image: {
    marginRight: 12,
    backgroundColor: palette.surfaceAlt,
  },
  placeholder: {
    marginRight: 12,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.inputFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
