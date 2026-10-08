import { ProjectRole, TeamRole } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../src/lib/errors.js";
import { prisma } from "../src/lib/prisma.js";
import {
  alterarPapelDeMembro,
  criarEquipe,
  excluirEquipe,
  listarEquipes,
  removerMembro,
  transferirPropriedade,
} from "../src/modules/teams/teams.service.js";
import {
  adicionarAEquipe,
  adicionarAoProjeto,
  criarEquipe as fabricarEquipe,
  criarProjeto,
  criarTarefa,
  criarUsuario,
  limparBanco,
} from "./factories.js";

beforeEach(limparBanco);

async function erroDe(fn: () => Promise<unknown>) {
  try {
    await fn();
    return null;
  } catch (erro) {
    return erro instanceof AppError ? erro : null;
  }
}

describe("criar equipe", () => {
  it("o criador vira dono e também GESTOR em team_members", async () => {
    const usuario = await criarUsuario();
    const equipe = await criarEquipe(usuario.id, { name: "Desenvolvimento" });

    expect(equipe.ownerId).toBe(usuario.id);

    // A autorização consulta team_members; sem esta linha, o dono não teria
    // papel e ficaria sem acesso à própria equipe.
    const membro = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: equipe.id, userId: usuario.id } },
    });
    expect(membro?.role).toBe(TeamRole.GESTOR);
  });

  it("aparece em 'Equipes que Administro', nunca em 'Participo'", async () => {
    const usuario = await criarUsuario();
    await criarEquipe(usuario.id, { name: "Minha" });

    const { administro, participo } = await listarEquipes(usuario.id);
    expect(administro).toHaveLength(1);
    expect(participo).toHaveLength(0);
  });
});

describe("alterar papel", () => {
  it("o dono não pode ser rebaixado", async () => {
    const dono = await criarUsuario();
    const equipe = await fabricarEquipe(dono.id);

    const erro = await erroDe(() =>
      alterarPapelDeMembro(dono.id, equipe.id, dono.id, TeamRole.MEMBRO),
    );
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
  });

  it("GESTOR altera o papel de outro membro", async () => {
    const dono = await criarUsuario();
    const membro = await criarUsuario();
    const equipe = await fabricarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, membro.id, TeamRole.MEMBRO);

    const atualizado = await alterarPapelDeMembro(
      dono.id,
      equipe.id,
      membro.id,
      TeamRole.VISUALIZADOR,
    );
    expect(atualizado.role).toBe(TeamRole.VISUALIZADOR);
  });

  it("MEMBRO não altera papéis", async () => {
    const dono = await criarUsuario();
    const membro = await criarUsuario();
    const outro = await criarUsuario();
    const equipe = await fabricarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, membro.id, TeamRole.MEMBRO);
    await adicionarAEquipe(equipe.id, outro.id, TeamRole.MEMBRO);

    const erro = await erroDe(() =>
      alterarPapelDeMembro(membro.id, equipe.id, outro.id, TeamRole.GESTOR),
    );
    expect(erro?.code).toBe("SEM_PERMISSAO");
  });
});

describe("remover membro", () => {
  it("o dono não pode ser removido nem sair", async () => {
    const dono = await criarUsuario();
    const gestor = await criarUsuario();
    const equipe = await fabricarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, gestor.id, TeamRole.GESTOR);

    expect((await erroDe(() => removerMembro(gestor.id, equipe.id, dono.id)))?.code).toBe(
      "REGRA_DE_NEGOCIO",
    );
    expect((await erroDe(() => removerMembro(dono.id, equipe.id, dono.id)))?.code).toBe(
      "REGRA_DE_NEGOCIO",
    );
  });

  it("bloqueia quem é dono de projeto da equipe", async () => {
    const dono = await criarUsuario();
    const membro = await criarUsuario();
    const equipe = await fabricarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, membro.id, TeamRole.MEMBRO);
    await criarProjeto(membro.id, { teamId: equipe.id });

    const erro = await erroDe(() => removerMembro(dono.id, equipe.id, membro.id));
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
    expect(erro?.message).toContain("Transfira a propriedade");
  });

  it("remove de todos os projetos da equipe e desatribui as tarefas", async () => {
    const dono = await criarUsuario();
    const membro = await criarUsuario();
    const equipe = await fabricarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, membro.id, TeamRole.MEMBRO);

    const projeto = await criarProjeto(dono.id, { teamId: equipe.id });
    await adicionarAoProjeto(projeto.id, membro.id, ProjectRole.EDITOR);
    const tarefa = await criarTarefa(projeto.id, dono.id);
    await prisma.taskAssignee.create({
      data: { taskId: tarefa.id, userId: membro.id },
    });

    await removerMembro(dono.id, equipe.id, membro.id);

    expect(
      await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: projeto.id, userId: membro.id } },
      }),
    ).toBeNull();

    // A tarefa continua existindo: só o vínculo com a pessoa some.
    expect(
      await prisma.taskAssignee.findUnique({
        where: { taskId_userId: { taskId: tarefa.id, userId: membro.id } },
      }),
    ).toBeNull();
    expect(await prisma.task.findUnique({ where: { id: tarefa.id } })).not.toBeNull();
  });

  it("não toca nos projetos pessoais de quem sai", async () => {
    const dono = await criarUsuario();
    const membro = await criarUsuario();
    const equipe = await fabricarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, membro.id, TeamRole.MEMBRO);
    const pessoal = await criarProjeto(membro.id); // sem teamId

    await removerMembro(dono.id, equipe.id, membro.id);

    expect(
      await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: pessoal.id, userId: membro.id } },
      }),
    ).not.toBeNull();
  });
});

describe("transferir propriedade", () => {
  it("só o dono transfere, e o novo dono vira GESTOR", async () => {
    const dono = await criarUsuario();
    const membro = await criarUsuario();
    const equipe = await fabricarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, membro.id, TeamRole.MEMBRO);

    await transferirPropriedade(dono.id, equipe.id, membro.id);

    const atualizada = await prisma.team.findUnique({ where: { id: equipe.id } });
    expect(atualizada?.ownerId).toBe(membro.id);

    const novoPapel = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: equipe.id, userId: membro.id } },
    });
    expect(novoPapel?.role).toBe(TeamRole.GESTOR);
  });

  it("não transfere para quem não é membro", async () => {
    const dono = await criarUsuario();
    const estranho = await criarUsuario();
    const equipe = await fabricarEquipe(dono.id);

    const erro = await erroDe(() =>
      transferirPropriedade(dono.id, equipe.id, estranho.id),
    );
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
  });

  it("um GESTOR que não é dono não transfere", async () => {
    const dono = await criarUsuario();
    const gestor = await criarUsuario();
    const equipe = await fabricarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, gestor.id, TeamRole.GESTOR);

    const erro = await erroDe(() =>
      transferirPropriedade(gestor.id, equipe.id, gestor.id),
    );
    expect(erro?.code).toBe("SEM_PERMISSAO");
  });
});

describe("excluir equipe", () => {
  it("bloqueia enquanto houver projeto ativo", async () => {
    const dono = await criarUsuario();
    const equipe = await fabricarEquipe(dono.id);
    await criarProjeto(dono.id, { teamId: equipe.id });

    const erro = await erroDe(() => excluirEquipe(dono.id, equipe.id));
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
  });

  it("projeto na Lixeira não impede a exclusão e sobrevive, desvinculado", async () => {
    const dono = await criarUsuario();
    const equipe = await fabricarEquipe(dono.id);
    const projeto = await criarProjeto(dono.id, { teamId: equipe.id });
    await prisma.project.update({
      where: { id: projeto.id },
      data: { deletedAt: new Date() },
    });

    await excluirEquipe(dono.id, equipe.id);

    expect(await prisma.team.findUnique({ where: { id: equipe.id } })).toBeNull();

    // O projeto continua na Lixeira do dono, agora como projeto pessoal:
    // excluir a equipe não deve destruir o que ainda era recuperável.
    const sobrevivente = await prisma.project.findUnique({
      where: { id: projeto.id },
    });
    expect(sobrevivente).not.toBeNull();
    expect(sobrevivente?.teamId).toBeNull();
    expect(sobrevivente?.deletedAt).not.toBeNull();
  });

  it("só o dono exclui", async () => {
    const dono = await criarUsuario();
    const gestor = await criarUsuario();
    const equipe = await fabricarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, gestor.id, TeamRole.GESTOR);

    const erro = await erroDe(() => excluirEquipe(gestor.id, equipe.id));
    expect(erro?.code).toBe("SEM_PERMISSAO");
  });
});
