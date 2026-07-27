# Design: onboarding unificado + Google termos (#86 / #87)

Data: 2026-07-27  
Issues: [#86](https://github.com/nikitayxp/lyfttrack/issues/86), [#87](https://github.com/nikitayxp/lyfttrack/issues/87)

## Fluxo

1. **Email:** criar conta (nome, username, email, password, termos) → ecrã perfil opcional (foto, peso, altura) com um botão **Continuar** (campos vazios = ok) → feed.
2. **Google:** OAuth → **Rever dados** (username + nome pré-preenchidos da Google, editáveis, check username) → **Continuar** → **mesmo** ecrã perfil opcional → feed.

Contas Google já existentes (termos + username ok) → feed directo.

## Termos Google (B)

Texto sob o botão Google (sign-in e sign-up): “Ao continuar com Google, aceitas os Termos e a Privacidade.”  
Clique Google → `markTermsAcceptedForOAuth()`. Email mantém checkbox. Rever dados **não** pede termos outra vez.

## Notas

- Não há botão “Skip” separado: um **Continuar** basta.
- O ficheiro legado `onboarding.tsx` (nome+peso) é substituído por este ecrã opcional.
- Gate: sem username utilizável → Rever dados; senão se ainda não passou pelo ecrã opcional (flag) → perfil opcional; senão feed. Users antigos: flag backfill = completed.
