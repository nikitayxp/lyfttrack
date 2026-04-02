# STACK

## Scope

Technology stack snapshot for monorepo `C:\LyftTrack` as mapped on 2026-04-02.

## Workspace Shape

- Monorepo root managed with npm workspaces in `package.json`.
- Workspace `app` contains the mobile product (Expo + React Native + Expo Router).
- Workspace `site` contains the marketing website (Next.js App Router).

## Runtime and Language

- Primary language: TypeScript in both workspaces.
- JavaScript runtime/tooling: Node.js + npm.
- Mobile UI runtime: React 19 + React Native 0.81 (Expo SDK 54).
- Web runtime: Next.js 16 + React 19.

## Root-Level Tooling

- Workspaces configured in `package.json`:
  - `app`
  - `site`
- Root scripts:
  - `npm run dev:app`
  - `npm run dev:site`
  - `npm run build:android`
- Shared install entrypoint: `npm install` at repo root.

## Mobile App Stack (`app/`)

- Router/navigation:
  - `expo-router`
  - `@react-navigation/native`
  - `@react-navigation/bottom-tabs`
- Platform APIs:
  - `expo-image-picker`
  - `expo-sharing`
  - `expo-localization`
  - `expo-keep-awake`
- Data/backend:
  - `@supabase/supabase-js`
- Charts and visualization:
  - `react-native-gifted-charts`
  - `react-native-svg`
- State and persistence primitives:
  - React context in `app/src/context/*`
  - `@react-native-async-storage/async-storage`

## Website Stack (`site/`)

- Framework: Next.js 16 App Router in `site/src/app/*`.
- UI stack:
  - React 19
  - Tailwind CSS v4 (`@tailwindcss/postcss` + `tailwindcss`)
  - `framer-motion` and `gsap` for motion
  - `sonner` for toasts
- Blog/content data currently local in `site/src/lib/blog-data.ts` and `site/src/lib/marketing-data.ts`.

## TypeScript and Linting

- Mobile TS config: `app/tsconfig.json` extends `expo/tsconfig.base.json` with `strict: true` and alias `@/* -> ./src/*`.
- Website TS config: `site/tsconfig.json` with `strict: true`, `noEmit: true`, and alias `@/* -> ./src/*`.
- Mobile lint: Expo flat config in `app/eslint.config.js`.
- Site lint: Next core web vitals + TS config in `site/eslint.config.mjs`.

## Configuration and Environment

- Supabase public env vars are statically referenced in `app/src/services/supabase.ts`:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- App build config files:
  - `app/app.json`
  - `app/eas.json`
- Site deploy/runtime config files:
  - `site/next.config.ts`
  - `site/vercel.json`

## Baseline Size Snapshot

- Approx total repository files (excluding `.git`, `node_modules`, `.next`, `.expo`): 144.
- Mobile package files in `app/*`: 87.
- Website package files in `site/*`: 46.
- Service-layer files in `app/src/services/*`: 11.
- Expo Router route files under `app/app/*`: 22.

## Notes

- Mobile codebase uses typed Supabase schema in `app/src/types/database.ts`.
- Current stack is app-heavy; site is content/marketing focused with static-style data sources.
