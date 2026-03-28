import { Tabs } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs 
      screenOptions={{
        // Cores da barra inferior
        tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#334155' },
        tabBarActiveTintColor: '#3b82f6', // Cor do ícone selecionado (Azul)
        tabBarInactiveTintColor: '#94a3b8', // Cor dos ícones inativos (Cinza)
        
        // Cores do cabeçalho no topo do ecrã
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Treino',
          tabBarIcon: ({ color }) => <FontAwesome5 name="dumbbell" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}