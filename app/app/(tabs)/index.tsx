import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';

export default function Home() {
  
  // Função para fazer logout e voltar à página inicial
  async function handleLogout() {
    await supabase.auth.signOut();
    // Volta para o ecrã de Login (que é o teu ficheiro index.tsx)
    router.replace('/' as any); 
  }

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <Text style={styles.title}>LYFT<Text style={{color: '#3b82f6'}}>TRACK</Text></Text>
      <Text style={styles.subtitle}>Bem-vindo aawo teu Dashboard! 🏋️‍♂️</Text>

      {/* Cartão de Estatísticas (Fictícias por agora) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resumo da Semana</Text>
        <Text style={styles.cardText}>💪 Treinos concluídos: 0</Text>
        <Text style={styles.cardText}>⚖️ Volume total: 0 kg</Text>
      </View>

      {/* Botão de Terminar Sessão */}
      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Terminar Sessão</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // O fundo escuro do LyftTrack
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 18,
    color: '#94a3b8',
    marginBottom: 40,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 15,
    width: '100%',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  cardText: {
    color: '#94a3b8',
    fontSize: 16,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#ef4444', // Vermelho para indicar "Sair"
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});