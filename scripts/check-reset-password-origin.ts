import assert from 'node:assert/strict';
import {
  RESET_PASSWORD_EDIT_PROFILE_FROM,
  RESET_PASSWORD_EDIT_PROFILE_ROUTE,
  RESET_PASSWORD_SIGN_IN_ROUTE,
  resetPasswordCameFromKnownOrigin,
  resolveResetPasswordBackRoute,
} from '../app/src/utils/resetPasswordOrigin.ts';

assert.equal(resolveResetPasswordBackRoute(undefined), RESET_PASSWORD_SIGN_IN_ROUTE);
assert.equal(resolveResetPasswordBackRoute(''), RESET_PASSWORD_SIGN_IN_ROUTE);
assert.equal(resolveResetPasswordBackRoute('not-a-real-origin'), RESET_PASSWORD_SIGN_IN_ROUTE);
assert.equal(
  resolveResetPasswordBackRoute(RESET_PASSWORD_EDIT_PROFILE_FROM),
  RESET_PASSWORD_EDIT_PROFILE_ROUTE,
);

assert.equal(resetPasswordCameFromKnownOrigin(undefined), false);
assert.equal(resetPasswordCameFromKnownOrigin('not-a-real-origin'), false);
assert.equal(resetPasswordCameFromKnownOrigin(RESET_PASSWORD_EDIT_PROFILE_FROM), true);
