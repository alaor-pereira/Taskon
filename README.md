# Taskon

Sistema de gerenciamento de projetos, equipes, tarefas e agenda, com controle de acesso por participação.

## Estrutura

```
Taskon/
├── backend/     API HTTP: Fastify + Prisma + Better Auth + PostgreSQL
└── frontend/    Interface: Next.js + React + shadcn/ui
```

A identidade visual atual (wordmark, símbolo, favicon e ícone de app, em SVG) fica em `frontend/public/taskon-logo-svg/`.

Backend e frontend são projetos independentes, cada um com seu `package.json`.

## Começando

Pré-requisitos: Node 20+ e PostgreSQL 14+.

```bash
# 1. Banco (ou use um PostgreSQL próprio)
docker compose up -d      # cria taskon_dev e taskon_test

# 2. Backend
cd backend
npm install
cp .env.example .env      # preencha DATABASE_URL e BETTER_AUTH_SECRET
npm run db:deploy         # aplica as migrações
npm run dev               # http://localhost:3333

# 3. Frontend (outro terminal)
cd frontend
npm install
cp .env.example .env.local
npm run dev               # http://localhost:3000
```

Com a `docker-compose.yml` deste repositório, as URLs são (ver "Banco com menor privilégio"):

```
DATABASE_URL="postgresql://taskon_app:taskon_app@localhost:5434/taskon_dev?schema=public"
DIRECT_URL="postgresql://taskon:taskon@localhost:5434/taskon_dev?schema=public"
```

O host usa a porta **5434**, e não a 5432, porque a porta padrão costuma estar
ocupada por outro PostgreSQL na máquina. Dentro do container ela segue sendo 5432.

Sem `RESEND_API_KEY` (só em desenvolvimento), nenhum e-mail sai da máquina: as mensagens de verificação,
recuperação de senha e convite são impressas no console do backend, com o link
utilizável.

## Testes

Os testes exigem um banco **separado**, porque apagam todas as tabelas entre
execuções.

```powershell
cd backend
$env:TEST_DATABASE_URL="postgresql://taskon_app:taskon_app@localhost:5434/taskon_test?schema=public"
npm test
```

Na primeira vez, aplique as migrações no banco de teste:

```powershell
$env:DATABASE_URL="postgresql://taskon:taskon@localhost:5434/taskon_test?schema=public"
$env:DIRECT_URL=$env:DATABASE_URL
npx prisma migrate deploy
```

## Rotinas agendadas

Três rotinas rodam fora de qualquer sessão: avisar vencimentos do dia, apagar
o que passou de 30 dias na lixeira e expirar convites vencidos. Elas ficam numa
rota só, protegida por segredo:

```
POST /api/cron/rodar
Authorization: Bearer $CRON_SECRET
```

Sem `CRON_SECRET` no `.env`, a rota **não é registrada** — deixá-la aberta
permitiria que qualquer um disparasse a purga da lixeira. Um intervalo de 5 a 15
minutos é suficiente; repetir é seguro, porque cada aviso sai uma vez por tarefa
e por dia.

O backend é um servidor Fastify de longa duração, então o agendador fica no host
(cron do sistema, systemd timer ou o agendador do provedor). Ele precisa mandar
**POST** com o cabeçalho; o Vercel Cron, por exemplo, só envia GET e não serve
aqui. Exemplo com cron do sistema:

```
*/10 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://api.seu-dominio/api/cron/rodar
```

Os vencimentos respeitam o fuso de **cada pessoa**: às 22h em São Paulo já é o
dia seguinte em Tóquio, e o aviso precisa chegar no dia certo de quem recebe.

## Google Agenda e Google Meet

A Agenda pode ser sincronizada com o Google Agenda (só Taskon → Google), e o
organizador pode gerar links do Google Meet. É opcional e por pessoa, com
consentimento no momento de conectar. O Taskon cria uma agenda "Taskon" na
conta Google escolhida e só acessa essa agenda (escopo
`calendar.app.created`). A conexão é separada do login: qualquer conta Google
serve, e conectar não cria uma forma de entrar no Taskon.

No Google Cloud, no mesmo projeto de `GOOGLE_CLIENT_ID`:

1. Ative a **Google Calendar API**.
2. Na tela de consentimento OAuth, adicione o escopo
   `https://www.googleapis.com/auth/calendar.app.created`. Enquanto o app não
   passar pela verificação do Google, ele mostra o aviso de "app não verificado"
   e aceita só os usuários de teste cadastrados.
3. Nas credenciais, inclua o URI de redirecionamento
   `${BETTER_AUTH_URL}/api/integracoes/google/callback`
   (em dev: `http://localhost:3333/api/integracoes/google/callback`).

Cada mudança na agenda é enviada logo depois de salvar; o que falhar fica
pendente e o cron (`POST /api/cron/rodar`) tenta de novo. Se a pessoa revogar o
acesso pelo Google, a integração passa a "Precisa reconectar" e ela recebe uma
notificação.

## Segurança

### Banco com menor privilégio

O servidor não conecta como dono do banco. `scripts/papeis-do-banco.sql` cria o
papel `taskon_app`, que só lê e escreve dados (não cria, altera nem apaga
tabelas). As migrações usam outro papel:

| Variável | Papel | Usada por |
|---|---|---|
| `DATABASE_URL` | `taskon_app` | servidor e testes |
| `DIRECT_URL` | dono do schema (`taskon` no dev) | `prisma migrate` |

Num volume do Postgres criado antes deste script, aplique-o uma vez:

```bash
docker exec -i taskon-postgres psql -U taskon -d postgres < scripts/papeis-do-banco.sql
```

A porta do container fica só em `127.0.0.1`: o banco não é acessível pela rede.

### Produção

Com `NODE_ENV=production`, o backend se recusa a subir se faltar algo destes:

- `BETTER_AUTH_URL` e `FRONTEND_URL` em `https://` (o cookie de sessão só
  trafega com `Secure`);
- `BETTER_AUTH_SECRET` gerado, e não o valor do `.env.example`;
- `RESEND_API_KEY` (sem ela, links de verificação e de redefinição de senha
  iriam para o log)

Também em produção:

- **`TRUST_PROXY_HOPS`**: quantos proxies ficam na frente do backend (1 para
  um Caddy/Nginx). O IP do cliente usado no rate limit e nos logs vem daí; o
  `X-Forwarded-For` mandado pelo próprio cliente é ignorado.
- **Papéis do banco**: crie um dono de schema sem `SUPERUSER` para as migrações
  e use um papel como `taskon_app` no servidor.
- **TLS**: o proxy termina o HTTPS; o backend já envia HSTS em produção.

### Deploy com Docker Compose (Coolify)

`docker-compose.prod.yml` sobe quatro serviços, sem portas publicadas:

| Serviço | Porta interna | Papel |
|---|---|---|
| `frontend` | 80 | Next.js (standalone) |
| `backend` | 3000 | API; aplica as migrações ao subir |
| `postgres` | 5432 | Banco, já com o papel `taskon_app` (`docker/postgres/`) |
| `cron` | — | Chama `POST /api/cron/rodar` a cada 10 minutos |

No Coolify, aponte o *Docker Compose Location* para `/docker-compose.prod.yml`
e dê aos serviços domínios do mesmo domínio registrado (o cookie de sessão é
`SameSite=Lax`): `https://app.seu-dominio.com` no `frontend` e
`https://api.seu-dominio.com:3000` no `backend`. As variáveis estão descritas
no próprio arquivo; gere os segredos com `openssl rand -hex 32`.

- `BETTER_AUTH_URL` também vira a URL da API no frontend, **durante o build**:
  ao trocá-la, faça um novo deploy (não basta reiniciar).
- As senhas do Postgres só valem na criação do volume. Use apenas letras e
  números, porque entram nas URLs de conexão.
- Nos provedores OAuth, os callbacks passam a ser
  `https://api.seu-dominio.com/api/auth/callback/{google,github}` e
  `https://api.seu-dominio.com/api/integracoes/google/callback`.

### O que está ligado

- Senhas com Argon2id; senhas novas conferidas contra vazamentos conhecidos
  (Have I Been Pwned, por k-anonimato, com falha aberta se o serviço cair).
- Verificação em duas etapas (TOTP + códigos de backup), opcional, em Meu perfil.
- Rate limit: login 5/min por IP e 10 falhas em 15 min por conta; API 300/min
  por IP.
- Sessões de 30 dias, revogadas ao redefinir a senha; lista de sessões ativas
  em Meu perfil.
- Cabeçalhos de segurança nos dois lados; CSP com nonce no frontend
  (`frontend/src/proxy.ts`).
- Tokens OAuth e segredos de 2FA cifrados no banco.
- Logs JSON no stdout, sem cookies, senhas nem tokens. Eventos de segurança
  saem com `"tipo":"seguranca"` e um `evento` (`login.falha`,
  `login.bloqueado`, `acesso.negado`, `rate_limit.atingido`, `mfa.ativado`…).

## Fases

| Fase | Situação |
|---|---|
| F0 Fundação | concluída |
| F1 Identidade e equipes | concluída |
| F2 Projetos e tarefas | concluída |
| F3 Comentários, Lixeira e Busca | concluída |
| F4 Agenda | concluída |
| F5 Home e acabamento | concluída |

## Princípios

1. Sem propriedade, participação ou compartilhamento explícito, o recurso é invisível.
2. O papel pertence à relação (usuário↔equipe, usuário↔projeto), nunca ao usuário.
3. Frontend melhora a experiência, backend garante a segurança, banco garante a integridade.
