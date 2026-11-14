# LyftTrack Site

Landing page e blog do LyftTrack (Next.js).

Instala as dependências na raiz do monorepo:

```bash
npm ci --workspaces --include-workspace-root
npm run dev:site
```

Abre [http://localhost:3000](http://localhost:3000).

Para testar a partir de outro dispositivo na mesma rede, acrescenta `SITE_ALLOWED_DEV_ORIGIN=nome-do-computador` ao teu `site/.env.local`. Na raiz do repositório, arranca o servidor com `npm run dev --workspace=site -- --hostname 0.0.0.0`. Abre `http://nome-do-computador:3000` no outro dispositivo. Usa apenas o hostname, sem protocolo ou porta.

Mantém apenas um servidor do site em execução. Se a porta já estiver ocupada pelo mesmo projeto, usa o servidor existente ou termina-o com `Ctrl+C` no terminal onde arrancou. Para reinstalar dependências, para primeiro os servidores.
