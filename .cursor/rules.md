---

alwaysApply: true

description: Preferências permanentes do Nikita para agentes no LyftTrack

---



# Preferências do utilizador (Nikita / LyftTrack)



Estas regras são permanentes. Qualquer agente seguinte deve segui-las sem pedir confirmação outra vez, salvo se o utilizador as alterar.



## Identidade Git (obrigatório)



- Todos os commits, merges e atividade no GitHub devem aparecer **só como o utilizador**, nunca como Cursor / agente.

- Autor e committer: `NikitaYxp <nikitayxp@gmail.com>`.

- **Proibido** `Co-authored-by: Cursor` (ou qualquer co-author de AI) nas mensagens de commit.

- O shell do Cursor reescreve `git commit` / `commit-tree` e pode meter Cursor no histórico. Para commits “limpos”, usar script externo (bash + `git commit-tree` / `CT=commit-tree`) com author/committer forçados, e verificar com `git log -1 --format="%an <%ae>%n%B"` antes do push.

- Se aparecer Cursor nos contribuidores ou no histórico, corrigir (rewrite / force push **só** quando o utilizador pedir explicitamente).



## Fluxo de trabalho Git



1. **Nunca** trabalhar commits de feature/bugfix diretamente na `main` local “escondida”.

2. Criar sempre uma **branch nova** (`fix/...`, `feature/...`, etc.).

3. Fazer commit(s) nessa branch e **push para o GitHub** para o utilizador ver/testar.

4. O utilizador **testa**. Só depois de ele **confirmar** é que se faz **merge**.

5. **Não mergear para `main` sem confirmação explícita** do utilizador. `main` = produção.

6. Preferir fluxo com branch `dev` como staging quando fizer sentido: feature/fix → (opcionalmente `dev`) → `main` só quando o utilizador autorizar.

7. Depois do merge (quando o utilizador pedir / fizer sentido), fechar a PR e apagar a branch remota/local para o GitHub ficar limpo.

8. Separar **bugs** e **features** em branches diferentes (não misturar num único PR se o utilizador pediu correção de bugs).

9. **Uma branch por issue:** ao atacar issues do GitHub, criar **uma branch dedicada por issue** (ex. `fix/issue-20-minimize-workout`). Não meter várias issues na mesma branch.

10. Branches de issues ainda em review / não aprovadas **deixar abertas**; não rebasear/fechar/mergear enquanto se trabalha noutras issues, salvo pedido explícito.

11. **Antes do PR / antes de eu testar:** a branch tem de estar **actualizada com `main`** (`git fetch` + `merge origin/main` na branch, resolver conflitos, push). Sem isto, o teste fica sem merges recentes e parece “desatualizado”. Quem abrir o PR (agente ou colaborador) é responsável por trazer a `main` para a branch **antes** de pedir review/teste.



## Testes: visual vs o agente faz tudo



- Se a mudança tem **coisa visual / UX** para validar na app ou no site → o Nikita testa; o agente prepara a branch, aplica migrations se preciso, e dá os comandos.

- Se **não** há UI a validar (só backend, migration, refactor sem ecrã, etc.) → o agente faz **tudo** (aplicar, verificar, merge só se ele já tiver autorizado esse fluxo / pedido explícito de merge).

- Em dúvida: se dá para “ver” no ecrã, é teste dele.



## O que dizer no fim de cada entrega



- No final de um fix/feature na branch, **sempre** indicar os comandos exactos que o utilizador deve digitar para ir buscar e testar (ex.: `git fetch`, `git checkout <branch>`, `git pull`, e como arrancar a app se relevante).

- Não assumir que ele sabe a branch ou os comandos.



## Commits e atividade no GitHub



- O repositório serve também de **portfólio** (recrutadores a ver histórico). Histórico deve parecer trabalho real do Nikita: branches, PRs, merges limpos.

- Quando o utilizador pedir commits em dias específicos, usar `GIT_AUTHOR_DATE` / `GIT_COMMITTER_DATE` — **só** quando ele pedir.

- Preferir vários commits pequenos e claros numa feature/fix, quando ele pedir actividade / histórico.



## Issues no GitHub



- Quando o utilizador reportar vários bugs/features de uma vez e pedir issues, criar issues no GitHub para não se perderem, e só depois ir resolvendo.

- **Detalhes nas issues:** tudo o que o utilizador descrever nos prompts deve ir para o **corpo/descrição** da issue.

- **Tom em 1.ª pessoa (como se fosse o Nikita):** títulos e descrições em português natural, directo, na voz dele.

- **Labels (obrigatório quando possível):** `bug`, `enhancement`, `polish`, `ux`, `documentation`, etc.

- **Não reescrever issues antigas** só para corrigir o tom.

- Não fechar issues / mergear fixes sem o utilizador ter testado (salvo se ele disser explicitamente para mergear).

- **Nas issues novas (a partir de agora):** incluir no corpo uma nota de processo, por exemplo:

  > **Antes do PR para `main`:** actualizar a branch com `main` (`merge origin/main`), resolver conflitos e só depois abrir/actualizar o PR para eu testar.



## Preferências novas a partir das mensagens



- Se o pedido for claramente uma regra para agentes futuros, **atualizar** `.cursor/rules/preferencias.mdc`.

- Quando ele disser explicitamente para meter algo nas preferências, fazer isso de imediato.



## Comunicação



- **Começar sempre cada resposta com** `Ok Nikita`.

- Responder em **português** (Portugal), de forma directa e curta.

- Explicar o estado do GitHub (branches, PRs, o que testar) de forma clara quando ele estiver confuso.



## Supabase / base de dados



- O projeto Supabase está **ligado** (`hiilbngoxqcwmiqdiuyd` / LyftTrack). O agente **tem acesso** para inspecionar e aplicar migrations quando for preciso.

- Não aplicar migrations em produção sem o utilizador estar a testar / ter pedido; preferir staging ou confirmação explícita quando o risco for alto.



## Código / produto



- App = cópia melhorada do Hevy (`LyftTrack`); UX deve parecer app de mercado.

- Seguir também a regra `ponytail.mdc` (diffs mínimos, código simples).

- i18n PT/EN: nomes de exercícios e UI devem respeitar o idioma do utilizador **em todo o lado**.



## Resumo rápido



| Fazer | Não fazer |

|-------|-----------|

| Branch → push → eu testo (se for visual) → merge só se eu disser | Commit na `main` sem eu confirmar |

| Commits só no meu nome (`NikitaYxp`) | `Co-authored-by: Cursor` / autor Cursor |

| Dar-me os comandos para checkout/testar | Assumir que eu sei a branch |

| Sem UI → agente trata do resto | Pedir-me para testar coisas sem ecrã |

| **1 branch = 1 issue** | Várias issues na mesma branch |

| Actualizar branch com `main` antes do PR/teste | Abrir PR desatualizado sem merges recentes |

| Usar Supabase ligado para migrations quando preciso | Assumir que não há acesso à BD |

| Começar cada resposta com `Ok Nikita` | Responder sem a saudação pedida |

| Testar LAN com `http://desktop-b00buva:8081` | Usar IP Tailscale para Google OAuth |



## Teste LAN (telemóvel + Tailscale)



- Arrancar: `cd app` → `npx expo start --lan`.

- No telemóvel (Brave), abrir sempre pelo **nome do PC Tailscale**, não pelo IP:

  - Preferido: `http://desktop-b00buva:8081`

  - Evitar: `http://100.x.x.x:8081` para fluxos com **Google OAuth** (o Supabase Auth rejeita redirects para IPs não-loopback e cai na Site URL / Vercel).

- O IP pode servir para abrir a app sem OAuth; para login Google / callbacks, hostname.

- Se o hostname Tailscale do desktop mudar, actualizar esta regra e a allow list do Supabase (`http://<hostname>:8081/**`).



Eu sempre faço para testar a app:

```

cd app

npx expo start --lan

```

No telemóvel: `http://desktop-b00buva:8081` (não o IP, se for OAuth).



e no site:

```

cd site

npm run dev

```