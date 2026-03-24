import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { supabase } from '../../lib/supabase'; // Confirma se este caminho continua certo para ti
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // Importamos os ícones para o olhinho!

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [mode, setMode] = useState('login'); 
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Estado para controlar o olhinho

  async function handleAuth() {
    setLoading(true);
    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) Alert.alert('Erro', error.message);
      else setMode('verify');
    } else if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) Alert.alert('Erro', error.message);
      else router.replace('/(tabs)' as any); 
    }
    setLoading(false);
  }

  async function handleVerify() {
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' });
    if (error) Alert.alert('Erro', "Código inválido ou expirado.");
    else {
      Alert.alert('Sucesso!', 'Conta verificada. Bem-vindo!');
      router.replace('/(tabs)' as any); 
    }
    setLoading(false);
  }

  return (
    // Mudámos o behavior no Android para "undefined" para evitar o ecrã branco!
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.innerContainer}>
        <Text style={styles.logoText}>LYFT<Text style={{color: '#3b82f6'}}>TRACK</Text></Text>
        <Text style={styles.subtitle}>
          {mode === 'verify' ? 'Verifica o teu e-mail' : 'O teu progresso começa aqui.'}
        </Text>

        <View style={styles.form}>
          {mode === 'verify' ? (
            <>
              <Text style={styles.label}>Código de verificação</Text>
              <TextInput 
                style={styles.input}
                placeholder="12345678"
                placeholderTextColor="#666"
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="numeric"
                maxLength={8}
              />
              <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'A verificar...' : 'Confirmar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMode('register')} style={styles.switchContainer}>
                <Text style={styles.switchText}>Enganei-me no email. Voltar atrás</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>E-mail</Text>
              <TextInput 
                style={styles.input}
                placeholder="exemplo@email.com"
                placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.label}>Palavra-passe</Text>
              <View style={styles.passwordContainer}>
                <TextInput 
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword} // Aqui a magia acontece
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
                <Text style={styles.buttonText}>
                  {loading ? 'A carregar...' : (mode === 'register' ? 'Criar Conta' : 'Entrar')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
                style={styles.switchContainer}
              >
                <Text style={styles.switchText}>
                  {mode === 'login' ? 'Ainda não tens conta? Regista-te' : 'Já tens conta? Entra aqui'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  innerContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  logoText: { fontSize: 42, fontWeight: 'bold', color: '#fff', textAlign: 'center', letterSpacing: 2 },
  subtitle: { color: '#94a3b8', textAlign: 'center', marginBottom: 40, fontSize: 16 },
  form: { width: '100%' },
  label: { color: '#f8fafc', marginBottom: 8, fontSize: 14, fontWeight: '500' },
  input: { backgroundColor: '#1e293b', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 20, fontSize: 16, borderWidth: 1, borderColor: '#334155' },
  
  /* Novos estilos para agrupar o input e o olhinho na mesma linha */
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    color: '#fff',
    padding: 15,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 15,
  },
  
  button: { backgroundColor: '#3b82f6', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  switchContainer: { marginTop: 25, alignItems: 'center' },
  switchText: { color: '#94a3b8', fontSize: 14 },
});