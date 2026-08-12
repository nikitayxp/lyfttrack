export const RESET_PASSWORD_SIGN_IN_ROUTE = '/(auth)/sign-in';
export const RESET_PASSWORD_EDIT_PROFILE_ROUTE = '/(tabs)/profile/edit';
export const RESET_PASSWORD_EDIT_PROFILE_FROM = 'edit-profile';

const ORIGINS: Record<string, string> = {
  [RESET_PASSWORD_EDIT_PROFILE_FROM]: RESET_PASSWORD_EDIT_PROFILE_ROUTE,
};

export function resolveResetPasswordBackRoute(from?: string): string {
  if (!from) {
    return RESET_PASSWORD_SIGN_IN_ROUTE;
  }

  return ORIGINS[from] ?? RESET_PASSWORD_SIGN_IN_ROUTE;
}

export function resetPasswordCameFromKnownOrigin(from?: string): boolean {
  return Boolean(from && ORIGINS[from]);
}
