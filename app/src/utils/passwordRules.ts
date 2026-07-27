export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRuleKey = 'length' | 'uppercase' | 'number' | 'symbol';

export type PasswordRule = {
  key: PasswordRuleKey;
  met: boolean;
};

const RULE_TESTS: Record<PasswordRuleKey, (password: string) => boolean> = {
  length: (password) => password.length >= PASSWORD_MIN_LENGTH,
  uppercase: (password) => /[A-Z]/.test(password),
  number: (password) => /[0-9]/.test(password),
  // Anything that is not a letter, a digit or whitespace counts as a symbol,
  // so accented and non-latin keyboards are not penalised.
  symbol: (password) => /[^A-Za-z0-9\s]/.test(password),
};

const RULE_ORDER: readonly PasswordRuleKey[] = ['length', 'uppercase', 'number', 'symbol'];

export function evaluatePasswordRules(password: string): PasswordRule[] {
  return RULE_ORDER.map((key) => ({
    key,
    met: RULE_TESTS[key](password),
  }));
}

export function isPasswordStrong(password: string): boolean {
  return RULE_ORDER.every((key) => RULE_TESTS[key](password));
}
