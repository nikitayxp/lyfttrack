import { Redirect } from 'expo-router';

// Canonical root target: auth state is enforced in app/_layout.tsx.
export default function Index() {
  return <Redirect href="/(tabs)" />;
}