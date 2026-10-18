# LyftTrack App

App Expo (React Native) do LyftTrack — treinos, rotinas, stats e social.

Instala as dependências na raiz do monorepo (`C:\LyftTrack`):

```bash
npm ci --workspaces --include-workspace-root
npm run dev:app
```

Para testar no telemóvel, depois da instalação na raiz:

```bash
cd app
npx expo start --lan
```

Abre o QR no Expo Go ou [http://desktop-b00buva:8081/](http://desktop-b00buva:8081/) no navegador. O hostname depende do nome do computador.

Mantém apenas um servidor da app em execução. Se a porta já estiver ocupada pelo mesmo projeto, usa o servidor existente ou termina-o com `Ctrl+C` no terminal onde arrancou. Para reinstalar dependências, para primeiro os servidores.

Precisas de `app/.env` com `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
