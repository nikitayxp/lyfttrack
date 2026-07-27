import AsyncStorage from '@react-native-async-storage/async-storage';

const SIGN_UP_DRAFT_KEY = 'lyfttrack_signup_draft';

/**
 * What is safe to keep between the sign-up form and the verify screen.
 *
 * Deliberately no password: restoring one would mean writing credentials to
 * device storage in clear text to save a user two seconds of typing. Terms
 * acceptance is left out for the same kind of reason — consent is recorded as
 * proof, so it has to be given deliberately, not restored from a cache.
 */
export type SignUpDraft = {
  displayName: string;
  username: string;
  email: string;
};

export async function saveSignUpDraft(draft: SignUpDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(SIGN_UP_DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn('[signUpDraft] Unable to save draft:', error);
  }
}

export async function loadSignUpDraft(): Promise<SignUpDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(SIGN_UP_DRAFT_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<SignUpDraft>;

    return {
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
      username: typeof parsed.username === 'string' ? parsed.username : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
    };
  } catch (error) {
    console.warn('[signUpDraft] Unable to read draft:', error);
    return null;
  }
}

export async function clearSignUpDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SIGN_UP_DRAFT_KEY);
  } catch {
    // noop
  }
}
