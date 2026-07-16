# LyftTrack

App de treino (React Native / Expo) com landing page (Next.js) e backend em Supabase.

Monorepo com duas apps:

| Pasta | Stack | Função |
|-------|--------|--------|
| `app/` | Expo Router, React Native, TypeScript | App mobile + web |
| `site/` | Next.js, Tailwind | Landing page e blog |

## Funcionalidades

- Autenticação (email, Google) e onboarding
- Treinos ativos com séries, descanso e resumo
- Templates / rotinas
- Estatísticas e medições (peso corporal)
- Feed social (likes, comentários, perfis públicos)
- Perfil, foto e definições (idioma PT/EN, preferências)
- Suporte offline básico e sync

## Como correr

```bash
# instalar dependências (raiz do monorepo)
npm install

# app Expo
npm run dev:app

# landing Next.js
npm run dev:site
```

Cria um ficheiro `app/.env` com as chaves do Supabase:

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

## Estrutura

```
app/
  app/           # ecrãs (Expo Router)
  src/
    components/  # UI
    services/    # API / Supabase
    context/     # estado global
    i18n/        # traduções
site/
  src/app/       # páginas Next.js
  src/components/
```

## Notas

Projeto pessoal de portfolio. Foco em prática de full-stack: mobile, web e backend as a service.

## Base de dados

As migrations SQL estão em `supabase/migrations/`.
