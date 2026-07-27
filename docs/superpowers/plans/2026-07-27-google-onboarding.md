# Plan: onboarding unificado + termos Google (#86 / #87)

> Estou a usar a skill writing-plans.

## Ficheiros

| Ficheiro | Responsabilidade |
|----------|------------------|
| `app/app/(auth)/sign-in.tsx` | Aviso B + `markTermsAcceptedForOAuth` no Google |
| `app/app/(auth)/sign-up.tsx` | Aviso B no Google; pós-verify/sucesso → onboarding novo |
| `app/app/(auth)/complete-profile.tsx` | **Novo** — rever nome/username (Google) |
| `app/app/(auth)/onboarding.tsx` | Reescrever — foto/peso/altura opcionais, só Continuar |
| `app/app/(auth)/_layout.tsx` | Registar rotas |
| `app/app/_layout.tsx` | Gate: incomplete → complete-profile → onboarding → tabs |
| `app/src/services/authService.ts` / profile helpers | Sugestão username; flag `onboarding_completed_at` |
| `app/src/i18n/resources.ts` | Strings PT/EN |
| Migration SQL (se altura não existir) | Coluna altura em profiles / measurements |

## Tasks

### 1. Termos B (#86)
- Texto + links sob Google em sign-in e sign-up.
- Sign-in: `markTermsAcceptedForOAuth()` antes de `startGoogleOAuth()`.

### 2. `complete-profile` (#87)
- Prefill nome/username (Google metadata); check disponibilidade; guardar perfil; ir a onboarding.

### 3. Onboarding opcional
- Substituir ecrã actual: avatar, peso, altura opcionais; um Continuar grava o preenchido e marca flag; vazio ok.

### 4. Auth gate
- Após session: sem username → complete-profile; sem flag onboarding → onboarding; senão tabs.
- Backfill: profiles existentes com username → `onboarding_completed_at` agora (migration ou one-shot no gate para users antigos).

### 5. Verificar
- Email: sign-up → onboarding opcional → feed.
- Google novo: OAuth → rever → onboarding → feed.
- Google existente: OAuth → feed.
- i18n PT/EN.

## Branch

`feature/issues-86-87-google-onboarding` (um PR fecha #86 e #87 — fluxo único).
