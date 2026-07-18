import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { Radius } from '@/constants/Styles';
import { getExerciseImageUrl } from '@/utils/exerciseImage';
import type { Tables } from '@/types/database';

const palette = Colors.dark;

type ExerciseImageSource = Pick<Tables<'exercises'>, 'name' | 'name_en' | 'name_pt' | 'image_url'>;

type ExerciseThumbnailProps = {
  exercise: ExerciseImageSource;
  size?: number;
};

export function ExerciseThumbnail({ exercise, size = 40 }: ExerciseThumbnailProps) {
  const imageUrl = getExerciseImageUrl(exercise);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !failed;

  if (!showImage) {
    return (
      <View style={[styles.placeholder, { width: size, height: size, borderRadius: Math.max(6, size / 5) }]}>
        <Ionicons name="barbell-outline" size={Math.max(14, Math.round(size * 0.42))} color="#475569" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl! }}
      style={[styles.image, { width: size, height: size, borderRadius: Math.max(6, size / 5) }]}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

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
