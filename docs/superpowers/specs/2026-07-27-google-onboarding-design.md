# Design: onboarding unificado + Google termos (#86 / #87)

Data: 2026-07-27  
Issues: [#86](https://github.com/nikitayxp/lyfttrack/issues/86), [#87](https://github.com/nikitayxp/lyfttrack/issues/87)

## Problema

- Google no **Iniciar sessão** cria conta sem aceitar Termos (checkbox só no sign-up).
- Google salta dados de perfil; email já pede nome + username no form.
- O onboarding actual (nome + peso obrigatórios) não bate com o produto: peso é opcional no perfil; sign-up email já tem nome.

## Objectivo

Fluxo claro, alinhado com apps de mercado:

1. **Email:** sign-up (nome, username, email, password, termos) → onboarding **opcional** (foto, peso, altura, skip) → feed.
2. **Google:** OAuth (com aviso legal tipo B) → **Rever dados** (username + nome pré-preenchidos, editáveis, check de disponibilidade) → **mesmo** onboarding opcional → feed.

Contas Google **já existentes** com `terms_accepted_at` e perfil completo (username válido) entram directo no feed.

## Termos (escolha B)

- Por baixo de **Continuar com Google** (sign-in e sign-up):

  > Ao continuar com Google, aceitas os [Termos] e a [Privacidade].

- Ao tocar no botão Google: `markTermsAcceptedForOAuth()` (grava timestamp pendente → `terms_accepted_at` no `SIGNED_IN`, como hoje).
- Sign-up **email/password** mantém o **checkbox** explícito (sem mudança de regra).
- Página **Rever dados** **não** volta a pedir termos.

## Ecrãs

### 1. Rever dados (só Google / perfil incompleto)

- Rota nova, ex.: `/(auth)/complete-profile` (nome exacto na implementação).
- Campos: **nome**, **username** (pré-preenchidos de `user_metadata` Google: `full_name` / `name`, sugestão de username a partir do nome ou email).
- Validação em tempo real de username (reutilizar `checkUsernameAvailability`).
- Botão **Seguinte** → grava perfil (username + full_name) → onboarding opcional.
- Quem cai aqui: sessão autenticada **sem** username definitivo / perfil marcado incompleto (ver gate abaixo).

### 2. Onboarding opcional (email e Google)

- Substituir o onboarding actual (nome+peso obrigatórios) por:
  - foto de perfil (opcional)
  - peso (opcional)
  - altura (opcional)
  - **Skip** / **Seguinte** (ambos permitem ir ao feed; Seguinte grava o que estiver preenchido)
- Prefill: se Google tiver `picture`, mostrar como avatar sugerido (utilizador pode trocar ou skip).

## Gate de navegação (auth)

Após sessão estabelecida (incl. callback OAuth):

| Estado | Destino |
|--------|---------|
| Sem `terms_accepted_at` (raro se B + park funcionar) | Rever dados / bloquear feed |
| Perfil incompleto (sem username utilizável) | Rever dados |
| Perfil completo, onboarding ainda não “visto” (flag) | Onboarding opcional |
| Completo | Feed (`/(tabs)`) |

Flag sugerida: `user_metadata.onboarding_completed_at` (ou equivalente em `profiles`) definida ao Skip ou Seguinte no onboarding opcional. Assim um user que já usava a app não é forçado outra vez (migration/backfill: users existentes = completed).

**Nota:** Sign-up email já define username no `signUp`; após verify, ir ao onboarding opcional (não ao feed directo nem ao onboarding antigo com nome obrigatório).

## Fora de âmbito

- Alterar o fluxo de verify-email além do destino pós-verify.
- Forçar PKCE vs hash no OAuth (já tratado noutros PRs).
- Redesign completo do sign-up email (campos actuais mantêm-se).

## Sucesso

- Google pelo sign-in **não** entra no feed sem termos gravados + username confirmado.
- Email e Google partilham o mesmo ecrã opcional foto/peso/altura com skip.
- UX de termos Google = aviso B junto ao botão, sem checkbox extra na review.
