import type { User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';

const pendingUserRequests = new Map<string, Promise<User>>();

export async function getSessionUserOrThrow(): Promise<User> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Unable to load authenticated session: ${error.message}`);
  }
  if (!data.session?.user) {
    throw new Error('Authenticated session not found. Please log in again.');
  }
  return data.session.user;
}

async function validateUser(accessToken: string): Promise<User> {
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error) {
    throw new Error(`Unable to fetch authenticated user: ${error.message}`);
  }
  if (!data.user) {
    throw new Error('Authenticated user not found. Please log in again.');
  }
  return data.user;
}

export async function getAuthenticatedUserOrThrow(): Promise<User> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Unable to load authenticated session: ${error.message}`);
  }
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error('Authenticated session not found. Please log in again.');
  }

  let pending = pendingUserRequests.get(accessToken);
  if (!pending) {
    pending = validateUser(accessToken);
    pendingUserRequests.set(accessToken, pending);
  }

  try {
    const user = await pending;
    const current = await supabase.auth.getSession();
    if (current.error || current.data.session?.user.id !== user.id) {
      throw new Error('Session changed while validating user. Please try again.');
    }
    return user;
  } finally {
    if (pendingUserRequests.get(accessToken) === pending) {
      pendingUserRequests.delete(accessToken);
    }
  }
}
