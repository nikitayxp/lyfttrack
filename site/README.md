# LyftTrack Site

Landing page e blog do LyftTrack (Next.js).

Instala as dependências na raiz do monorepo (`C:\LyftTrack`):

```bash
npm ci --workspaces --include-workspace-root
npm run dev:site
```

Abre [http://localhost:3000](http://localhost:3000).

Na mesma rede, podes usar [http://desktop-b00buva:3000/](http://desktop-b00buva:3000/). Se o nome do computador mudar, atualiza `allowedDevOrigins` em `next.config.ts`.

Mantém apenas um servidor do site em execução. Se a porta já estiver ocupada pelo mesmo projeto, usa o servidor existente ou termina-o com `Ctrl+C` no terminal onde arrancou. Para reinstalar dependências, para primeiro os servidores.
