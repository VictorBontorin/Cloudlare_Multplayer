# Xadrez online

Xadrez multiplayer em tempo real, sem cadastro. Roda inteiro na Cloudflare:
Workers (servidor) + Durable Objects (uma sala por partida, via WebSocket) + arquivos estáticos.

O servidor valida todos os lances e controla o relógio; o cliente só exibe.

## Rodar local

```bash
npm install
npm run dev
```

Abra `http://localhost:8787` em duas abas (ou em dois navegadores) para testar.

## Publicar

```bash
npx wrangler login
npm run deploy
```

Ou conecte o repositório do GitHub em **Workers & Pages > Create > Import a repository**,
com o comando de deploy `npx wrangler deploy`. Cada push na branch principal publica de novo.

## Recursos

- Regras completas: roque, en passant, promoção, xeque-mate, afogamento, material insuficiente, tripla repetição e regra dos 50 lances
- Relógio com incremento, desistir, abortar, empate por acordo e revanche (com troca de cores)
- Link de convite, reconexão automática, espectadores e chat
- Salas inativas são apagadas após 24 horas

## Estrutura

- `src/worker.js`: rotas e a sala de jogo (Durable Object)
- `public/chess.js`: motor de xadrez, usado no servidor e no navegador
- `public/index.html`, `style.css`, `app.js`: interface
