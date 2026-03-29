import { useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { supabase } from '@/services/supabase';

type AuthMode = 'login' | 'register' | 'verify';

const palette = Colors.dark;

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleAuth() {
    setLoading(true);

    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          Alert.alert('Error', error.message);
        } else {
          setMode('verify');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          Alert.alert('Error', error.message);
        } else {
          router.replace('/(tabs)/workout' as any);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setLoading(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup',
      });

      if (error) {
        Alert.alert('Error', 'Invalid or expired code.');
      } else {
        Alert.alert('Success', 'Account verified.');
        router.replace('/(tabs)/workout' as any);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      Alert.alert('Forgot Password', 'Please enter your email first.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      Alert.alert('Forgot Password', 'Check your email to reset your password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.innerContainer}>
        <Image source={require('../../assets/images/logo.jpg')} style={styles.logoImage} resizeMode="contain" />
        <Text style={styles.subtitle}>
          {mode === 'verify' ? 'Verify your email address.' : 'Your progress starts now.'}
        </Text>

        <View style={styles.form}>
          {mode === 'verify' ? (
            <>
              <Text style={styles.label}>Verification code</Text>
              <TextInput
                style={styles.input}
                placeholder="12345678"
                placeholderTextColor={palette.textMuted}
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="numeric"
                maxLength={8}
              />
              <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Confirm'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMode('register')} style={styles.switchContainer}>
                <Text style={styles.switchText}>Wrong email? Go back</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="exemplo@email.com"
                placeholderTextColor={palette.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="********"
                  placeholderTextColor={palette.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color={palette.icon} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
                <Text style={styles.buttonText}>
                  {loading ? 'Loading...' : mode === 'register' ? 'Create Account' : 'Sign In'}
                </Text>
              </TouchableOpacity>

              {mode === 'login' ? (
                <TouchableOpacity
                  onPress={() => void handleForgotPassword()}
                  style={styles.forgotPasswordContainer}
                  disabled={loading}
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
                style={styles.switchContainer}
              >
                <Text style={styles.switchText}>
                  {mode === 'login' ? 'No account yet? Register' : 'Already have an account? Sign in'}
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
  container: { flex: 1, backgroundColor: palette.bgPrimary },
  innerContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  logoImage: {
    width: 220,
    height: 72,
    alignSelf: 'center',
    marginBottom: 14,
  },
  subtitle: {
    color: palette.textSecondary,
    textAlign: 'center',
    marginBottom: 34,
    fontSize: 16,
  },
  form: { width: '100%' },
  label: {
    color: palette.textPrimary,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: palette.inputBackground,
    color: palette.textPrimary,
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    fontSize: 16,
    borderWidth: 1,
    borderColor: palette.inputBorder,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    color: palette.textPrimary,
    padding: 15,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 15,
  },
  button: {
    backgroundColor: palette.accent,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  forgotPasswordContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '700',
  },
  switchContainer: { marginTop: 25, alignItems: 'center' },
  switchText: { color: palette.textSecondary, fontSize: 14 },
});