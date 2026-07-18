import { memo, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { getExerciseImageUrl } from '@/utils/exerciseImage';
import type { Tables } from '@/types/database';

const palette = Colors.dark;

type ExerciseImageSource = Pick<Tables<'exercises'>, 'name' | 'name_en' | 'name_pt' | 'image_url'>;

type ExerciseThumbnailProps = {
  exercise: ExerciseImageSource;
  size?: number;
};

function ExerciseThumbnailComponent({ exercise, size = 40 }: ExerciseThumbnailProps) {
  const imageUrl = useMemo(() => getExerciseImageUrl(exercise), [
    exercise.image_url,
    exercise.name,
    exercise.name_en,
    exercise.name_pt,
  ]);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !failed;
  const radius = Math.max(6, size / 5);

  if (!showImage) {
    return (
      <View style={[styles.placeholder, { width: size, height: size, borderRadius: radius }]}>
        <Ionicons name="barbell-outline" size={Math.max(14, Math.round(size * 0.42))} color="#475569" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl! }}
      style={[styles.image, { width: size, height: size, borderRadius: radius }]}
      resizeMode="cover"
      // Avoid decoding every off-screen catalog image at once when switching to "All".
      fadeDuration={0}
      onError={() => setFailed(true)}
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
