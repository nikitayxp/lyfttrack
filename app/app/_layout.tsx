import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';

export default function RootLayout() {
  useEffect(() => {
    // Verificar sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)' as any);
      }
    });

    // Ouvir mudanças de auth em tempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => { 
       if (session) {
          router.replace('/(tabs)' as any);
        } else {
          router.replace('/(auth)' as any);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}