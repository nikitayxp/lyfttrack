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
- Modelos de treino
- Estatísticas e medições (peso corporal)
- Feed social (likes, comentários, perfis públicos)
- Perfil, foto e definições (idioma PT/EN, preferências)
- Suporte offline básico e sync

## Como correr

```bash
# instalar dependências (raiz do monorepo)
npm ci --workspaces --include-workspace-root

# app Expo
npm run dev:app

# landing Next.js
npm run dev:site
```

Instala as dependências na raiz do projeto, antes de entrar em `app/` ou `site/`, e espera que a instalação termine. Uma instalação feita dentro de um workspace pode deixar as dependências do outro por instalar.

Mantém apenas um servidor de cada app em execução. Se o terminal indicar que a porta já está ocupada pelo mesmo projeto, usa o endereço do servidor existente ou termina-o com `Ctrl+C` no terminal onde arrancou antes de iniciar outro. Para reinstalar dependências, para primeiro os servidores.

Para testar a app no telemóvel, executa `npx expo start --lan` dentro de `app/` e usa o QR no Expo Go ou o endereço da rede apresentado no terminal. Abre a landing em [http://localhost:3000](http://localhost:3000). As instruções para aceder ao site na rede local estão no [README do site](site/README.md).

Cria um ficheiro `app/.env` com o URL do Supabase e a chave pública de cliente:

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

As migrações SQL e o processo de aplicação estão em [supabase/migrations](supabase/migrations/README.md).

## Verificações

Executa `npm run check` na raiz para correr lint, TypeScript e testes. O GitHub Actions também verifica os builds web da app e do site. As migrações de produção têm um workflow manual com aprovação da revisão a aplicar.
