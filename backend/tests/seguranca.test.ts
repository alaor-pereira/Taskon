import { EventKind, ProjectRole, TeamRole } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import {
  JANELA_MS,
  MAXIMO_DE_FALHAS,
  contaBloqueada,
  limparFalhas,
  registrarFalha,
  zerarBloqueios,
} from "../src/lib/bloqueio-de-login.js";
import { urlSemSegredos } from "../src/lib/log.js";
import { escaparHtml, layoutEmail } from "../src/lib/mailer.js";
import { prisma } from "../src/lib/prisma.js";
import { gerarToken, dataDeExpiracaoDeConvite } from "../src/lib/tokens.js";
import { criarEvento } from "../src/modules/calendar/calendar.service.js";
import { comentar, listarComentarios, mencionaveis } from "../src/modules/comments/comments.service.js";
import {
  aceitarConvite,
  convidarParaEquipe,
  listarConvitesRecebidos,
  recusarConvite,
} from "../src/modules/invitations/invitations.service.js";
import { alterarPapelDeMembro, removerMembro } from "../src/modules/teams/teams.service.js";
import {
  adicionarAEquipe,
  adicionarAoProjeto,
  colegasDeEquipe,
  criarEquipe,
  criarProjeto,
  criarTarefa,
  criarUsuario,
  limparBanco,
} from "./factories.js";

beforeEach(async () => {
  await limparBanco();
  zerarBloqueios();
});

describe("e-mail sem HTML de usuário", () => {
  it("escapa os caracteres que abrem tags e atributos", () => {
    expect(escaparHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });

  it("o título e o botão do layout saem escapados", () => {
    const html = layoutEmail("<img src=x onerror=alert(1)>", "<p>ok</p>", {
      texto: "<b>Ir</b>",
      url: 'https://exemplo.com/"><script>',
    });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Ir</b>");
    expect(html).toContain("<p>ok</p>");
  });
});

describe("tokens fora do log", () => {
  it("troca tokens no caminho e na query por um marcador", () => {
    expect(urlSemSegredos("/api/convites/token/abc123XYZ")).toBe("/api/convites/token/<token>");
    expect(urlSemSegredos("/api/auth/reset-password/tok?callbackURL=/x")).toBe(
      "/api/auth/reset-password/<token>?callbackURL=/x",
    );
    expect(urlSemSegredos("/api/auth/verify-email?token=abc&callbackURL=/")).toBe(
      "/api/auth/verify-email?token=<token>&callbackURL=/",
    );
    expect(urlSemSegredos("/api/projetos/123")).toBe("/api/projetos/123");
  });
});

describe("bloqueio de login por conta", () => {
  it("trava depois do limite de falhas e solta quando a janela passa", () => {
    const inicio = Date.now();
    for (let i = 0; i < MAXIMO_DE_FALHAS - 1; i++) registrarFalha("Ana@Teste.com", inicio);
    expect(contaBloqueada("ana@teste.com", inicio)).toBe(false);

    registrarFalha("ana@teste.com", inicio);
    expect(contaBloqueada("ANA@teste.com", inicio)).toBe(true);
    expect(contaBloqueada("outra@teste.com", inicio)).toBe(false);

    expect(contaBloqueada("ana@teste.com", inicio + JANELA_MS)).toBe(false);
  });

  it("um login certo zera a contagem", () => {
    for (let i = 0; i < MAXIMO_DE_FALHAS; i++) registrarFalha("ana@teste.com");
    limparFalhas("ana@teste.com");
    expect(contaBloqueada("ana@teste.com")).toBe(false);
  });
});

describe("reunião só com colegas de equipe", () => {
  const reuniao = (participantIds: string[]) => ({
    kind: EventKind.REUNIAO,
    title: "Planejamento",
    startsAt: new Date("2030-01-10T14:00:00Z").toISOString(),
    endsAt: new Date("2030-01-10T15:00:00Z").toISOString(),
    timezone: "America/Sao_Paulo",
    participantIds,
  });

  it("recusa quem não divide equipe com o organizador e não o notifica", async () => {
    const organizador = await criarUsuario();
    const colega = await criarUsuario();
    const estranho = await criarUsuario();
    await colegasDeEquipe(organizador.id, colega.id);

    await expect(criarEvento(organizador.id, reuniao([colega.id, estranho.id]))).rejects.toMatchObject({
      code: "REGRA_DE_NEGOCIO",
    });
    expect(await prisma.notification.count({ where: { userId: estranho.id } })).toBe(0);

    const evento = await criarEvento(organizador.id, reuniao([colega.id]));
    expect(evento.participants).toHaveLength(2);
  });
});

describe("só o dono mexe em gestores", () => {
  async function cenario() {
    const dono = await criarUsuario();
    const gestor = await criarUsuario();
    const outroGestor = await criarUsuario();
    const membro = await criarUsuario();
    const equipe = await criarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, gestor.id, TeamRole.GESTOR);
    await adicionarAEquipe(equipe.id, outroGestor.id, TeamRole.GESTOR);
    await adicionarAEquipe(equipe.id, membro.id, TeamRole.MEMBRO);
    return { dono, gestor, outroGestor, membro, equipe };
  }

  it("um gestor não rebaixa, não remove e não cria outro gestor", async () => {
    const { gestor, outroGestor, membro, equipe } = await cenario();

    await expect(
      alterarPapelDeMembro(gestor.id, equipe.id, outroGestor.id, TeamRole.MEMBRO),
    ).rejects.toMatchObject({ code: "SEM_PERMISSAO" });
    await expect(removerMembro(gestor.id, equipe.id, outroGestor.id)).rejects.toMatchObject({
      code: "SEM_PERMISSAO",
    });
    await expect(
      alterarPapelDeMembro(gestor.id, equipe.id, membro.id, TeamRole.GESTOR),
    ).rejects.toMatchObject({ code: "SEM_PERMISSAO" });
    await expect(
      convidarParaEquipe(gestor.id, equipe.id, { email: "novo@teste.local", role: TeamRole.GESTOR }),
    ).rejects.toMatchObject({ code: "SEM_PERMISSAO" });
  });

  it("o gestor continua gerenciando membros comuns", async () => {
    const { gestor, membro, equipe } = await cenario();
    const atualizado = await alterarPapelDeMembro(gestor.id, equipe.id, membro.id, TeamRole.VISUALIZADOR);
    expect(atualizado.role).toBe(TeamRole.VISUALIZADOR);
  });

  it("o dono promove e rebaixa gestores", async () => {
    const { dono, gestor, membro, equipe } = await cenario();
    await alterarPapelDeMembro(dono.id, equipe.id, membro.id, TeamRole.GESTOR);
    const rebaixado = await alterarPapelDeMembro(dono.id, equipe.id, gestor.id, TeamRole.MEMBRO);
    expect(rebaixado.role).toBe(TeamRole.MEMBRO);
  });
});

describe("resposta a convite", () => {
  it("aceitar e recusar ao mesmo tempo: só uma resposta vale", async () => {
    const dono = await criarUsuario();
    const convidado = await criarUsuario();
    const equipe = await criarEquipe(dono.id);
    const convite = await prisma.invitation.create({
      data: {
        type: "EQUIPE",
        teamId: equipe.id,
        email: convidado.email,
        invitedUserId: convidado.id,
        role: TeamRole.MEMBRO,
        tokenHash: gerarToken().hash,
        invitedById: dono.id,
        expiresAt: dataDeExpiracaoDeConvite(),
      },
    });

    const resultados = await Promise.allSettled([
      aceitarConvite(convidado.id, convite.id),
      recusarConvite(convidado.id, convite.id),
    ]);

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const final = await prisma.invitation.findUniqueOrThrow({ where: { id: convite.id } });
    const entrou = await prisma.teamMember.count({ where: { teamId: equipe.id, userId: convidado.id } });
    expect(entrou).toBe(final.status === "ACEITO" ? 1 : 0);
  });
});

describe("e-mail de terceiros só onde a tela mostra", () => {
  it("comentários e menções não levam o e-mail de ninguém", async () => {
    const ana = await criarUsuario("Ana");
    const bruno = await criarUsuario("Bruno");
    const projeto = await criarProjeto(ana.id);
    await adicionarAoProjeto(projeto.id, bruno.id, ProjectRole.EDITOR);
    const tarefa = await criarTarefa(projeto.id, ana.id);

    await comentar(bruno.id, tarefa.id, "Pronto para revisão.");
    const [comentario] = await listarComentarios(ana.id, tarefa.id);
    expect(comentario?.author).not.toHaveProperty("email");

    const pessoas = await mencionaveis(ana.id, tarefa.id);
    const doBruno = pessoas.find((p) => p.id === bruno.id);
    expect(doBruno).not.toHaveProperty("email");
    expect(doBruno?.apelido).toBe(bruno.email.split("@")[0]);
  });

  it("o convite recebido não devolve o hash do token", async () => {
    const dono = await criarUsuario();
    const convidado = await criarUsuario();
    const equipe = await criarEquipe(dono.id);
    await convidarParaEquipe(dono.id, equipe.id, { email: convidado.email, role: TeamRole.MEMBRO });

    const [convite] = await listarConvitesRecebidos(convidado.id);
    expect(convite).toBeDefined();
    expect(convite).not.toHaveProperty("tokenHash");
  });
});
