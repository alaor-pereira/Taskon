import { ProjectRole, TeamRole } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../src/lib/errors.js";
import { prisma } from "../src/lib/prisma.js";
import { criarCaixaDeEntrada } from "../src/modules/projects/inbox.js";
import {
  adicionarMembro,
  atualizarProjeto,
  criarProjeto,
  excluirProjeto,
  listarProjetos,
  listarTodosOsProjetos,
  obterProjeto,
  removerMembro,
  transferirPropriedade,
} from "../src/modules/projects/projects.service.js";
import { atualizarTarefa, criarTarefa } from "../src/modules/tasks/tasks.service.js";
import {
  adicionarAEquipe,
  adicionarAoProjeto,
  colegasDeEquipe,
  criarEquipe,
  criarProjeto as fabricarProjeto,
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

describe("criar projeto", () => {
  it("o criador vira dono e também OWNER em project_members", async () => {
    const usuario = await criarUsuario();
    const projeto = await criarProjeto(usuario.id, { name: "Sistema ERP" });

    expect(projeto.ownerId).toBe(usuario.id);
    const membro = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: projeto.id, userId: usuario.id } },
    });
    expect(membro?.role).toBe(ProjectRole.OWNER);
  });

  it("VISUALIZADOR da equipe não cria projeto nela", async () => {
    const dono = await criarUsuario();
    const visualizador = await criarUsuario();
    const equipe = await criarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, visualizador.id, TeamRole.VISUALIZADOR);

    const erro = await erroDe(() =>
      criarProjeto(visualizador.id, { name: "X", teamId: equipe.id }),
    );
    expect(erro?.code).toBe("SEM_PERMISSAO");
  });

  it("MEMBRO da equipe cria projeto nela", async () => {
    const dono = await criarUsuario();
    const membro = await criarUsuario();
    const equipe = await criarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, membro.id, TeamRole.MEMBRO);

    const projeto = await criarProjeto(membro.id, {
      name: "Projeto do membro",
      teamId: equipe.id,
    });
    expect(projeto.teamId).toBe(equipe.id);
  });

  it("quem não é da equipe não cria projeto nela", async () => {
    const dono = await criarUsuario();
    const estranho = await criarUsuario();
    const equipe = await criarEquipe(dono.id);

    const erro = await erroDe(() =>
      criarProjeto(estranho.id, { name: "X", teamId: equipe.id }),
    );
    expect(erro?.code).toBe("NAO_ENCONTRADO");
  });
});

describe("listagem da barra lateral", () => {
  it('a Caixa de entrada não aparece em "Meus Projetos" — mora na Home', async () => {
    const usuario = await criarUsuario();
    await criarProjeto(usuario.id, { name: "Outro" });
    const caixa = await criarCaixaDeEntrada(usuario.id);

    const { meus, caixaDeEntrada } = await listarProjetos(usuario.id);
    expect(meus.some((p) => p.isInbox)).toBe(false);
    expect(caixaDeEntrada?.id).toBe(caixa.id);
  });

  it("um projeto de equipe em que não participo não aparece", async () => {
    const gestorOutro = await criarUsuario();
    const eu = await criarUsuario();
    const equipe = await criarEquipe(gestorOutro.id);
    await adicionarAEquipe(equipe.id, eu.id, TeamRole.MEMBRO);
    await fabricarProjeto(gestorOutro.id, { teamId: equipe.id });

    // Ser da equipe não basta: é a regra que diferencia este sistema do
    // desenho original.
    const { meus, participo } = await listarProjetos(eu.id);
    expect(meus).toHaveLength(0);
    expect(participo).toHaveLength(0);
  });

  it("aparece em 'Participo' quando sou incluído no projeto", async () => {
    const dono = await criarUsuario();
    const eu = await criarUsuario();
    const equipe = await criarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, eu.id, TeamRole.MEMBRO);
    const projeto = await fabricarProjeto(dono.id, { teamId: equipe.id });
    await adicionarAoProjeto(projeto.id, eu.id, ProjectRole.EDITOR);

    const { participo } = await listarProjetos(eu.id);
    expect(participo.map((p) => p.id)).toEqual([projeto.id]);
  });

  it("o total permite decidir se o 'ver todos' faz sentido", async () => {
    const usuario = await criarUsuario();
    for (let i = 0; i < 4; i++) await criarProjeto(usuario.id, { name: `P${i}` });

    const { meus, totais } = await listarProjetos(usuario.id, 2);
    expect(meus).toHaveLength(2);
    expect(totais.meus).toBe(4);
  });
});

describe("membros do projeto", () => {
  it("em projeto de equipe, só entra quem é da equipe", async () => {
    const dono = await criarUsuario();
    const deFora = await criarUsuario();
    const equipe = await criarEquipe(dono.id);
    const projeto = await criarProjeto(dono.id, {
      name: "Da equipe",
      teamId: equipe.id,
    });

    const erro = await erroDe(() =>
      adicionarMembro(dono.id, projeto.id, {
        userId: deFora.id,
        role: ProjectRole.EDITOR,
      }),
    );
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
    expect(erro?.message).toContain("membros da própria equipe");
  });

  it("em projeto pessoal, entra quem divide alguma equipe com o dono", async () => {
    const dono = await criarUsuario();
    const colega = await criarUsuario();
    await colegasDeEquipe(dono.id, colega.id);
    const projeto = await criarProjeto(dono.id, { name: "Pessoal" });

    const membro = await adicionarMembro(dono.id, projeto.id, {
      userId: colega.id,
      role: ProjectRole.VIEWER,
    });
    expect(membro.role).toBe(ProjectRole.VIEWER);
  });

  it("em projeto pessoal, um estranho não entra só pelo id", async () => {
    const dono = await criarUsuario();
    const estranho = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { name: "Pessoal" });

    await expect(
      adicionarMembro(dono.id, projeto.id, { userId: estranho.id, role: ProjectRole.VIEWER }),
    ).rejects.toMatchObject({ code: "REGRA_DE_NEGOCIO" });
    expect(await prisma.notification.count({ where: { userId: estranho.id } })).toBe(0);
  });

  it("EDITOR não gerencia membros", async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario();
    const outro = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { name: "P" });
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);

    const erro = await erroDe(() =>
      adicionarMembro(editor.id, projeto.id, {
        userId: outro.id,
        role: ProjectRole.EDITOR,
      }),
    );
    expect(erro?.code).toBe("SEM_PERMISSAO");
  });

  it("não é possível adicionar um segundo OWNER", async () => {
    const dono = await criarUsuario();
    const outro = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { name: "P" });

    const erro = await erroDe(() =>
      adicionarMembro(dono.id, projeto.id, {
        userId: outro.id,
        role: ProjectRole.OWNER,
      }),
    );
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
  });

  it("o proprietário não sai nem é removido", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { name: "P" });

    const erro = await erroDe(() => removerMembro(dono.id, projeto.id, dono.id));
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
  });

  it("remover membro desatribui as tarefas dele naquele projeto", async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { name: "P" });
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);

    const tarefa = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Tarefa",
      assigneeIds: [editor.id],
    });

    await removerMembro(dono.id, projeto.id, editor.id);

    expect(
      await prisma.taskAssignee.findUnique({
        where: { taskId_userId: { taskId: tarefa.id, userId: editor.id } },
      }),
    ).toBeNull();
    expect(await prisma.task.findUnique({ where: { id: tarefa.id } })).not.toBeNull();
  });
});

describe("transferir propriedade do projeto", () => {
  it("o novo dono vira OWNER e o anterior continua como EDITOR", async () => {
    const dono = await criarUsuario();
    const outro = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { name: "P" });
    await adicionarAoProjeto(projeto.id, outro.id, ProjectRole.VIEWER);

    await transferirPropriedade(dono.id, projeto.id, outro.id);

    const atualizado = await prisma.project.findUnique({ where: { id: projeto.id } });
    expect(atualizado?.ownerId).toBe(outro.id);

    const papeis = await prisma.projectMember.findMany({
      where: { projectId: projeto.id },
      select: { userId: true, role: true },
    });
    expect(papeis.find((p) => p.userId === outro.id)?.role).toBe(ProjectRole.OWNER);
    // Perder o acesso ao próprio trabalho ao passar a responsabilidade seria
    // surpreendente, então o dono anterior fica como EDITOR.
    expect(papeis.find((p) => p.userId === dono.id)?.role).toBe(ProjectRole.EDITOR);
  });

  it("não transfere para quem não participa", async () => {
    const dono = await criarUsuario();
    const estranho = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { name: "P" });

    const erro = await erroDe(() =>
      transferirPropriedade(dono.id, projeto.id, estranho.id),
    );
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
  });
});

describe("Caixa de entrada", () => {
  it("não pode ser excluída nem compartilhada", async () => {
    const usuario = await criarUsuario();
    const outro = await criarUsuario();
    const inbox = await criarCaixaDeEntrada(usuario.id);

    expect((await erroDe(() => excluirProjeto(usuario.id, inbox.id)))?.code).toBe(
      "REGRA_DE_NEGOCIO",
    );
    expect(
      (
        await erroDe(() =>
          adicionarMembro(usuario.id, inbox.id, {
            userId: outro.id,
            role: ProjectRole.VIEWER,
          }),
        )
      )?.code,
    ).toBe("REGRA_DE_NEGOCIO");
  });

  it("é criada uma só vez por usuário", async () => {
    const usuario = await criarUsuario();
    const primeira = await criarCaixaDeEntrada(usuario.id);
    const segunda = await criarCaixaDeEntrada(usuario.id);

    expect(segunda.id).toBe(primeira.id);
    expect(
      await prisma.project.count({ where: { ownerId: usuario.id, isInbox: true } }),
    ).toBe(1);
  });
});

describe("excluir projeto", () => {
  it("leva as tarefas no mesmo lote, para a restauração saber o que devolver", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { name: "P" });
    const tarefa = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Tarefa",
    });

    const { deletionBatchId } = await excluirProjeto(dono.id, projeto.id);

    const projetoExcluido = await prisma.project.findUnique({
      where: { id: projeto.id },
    });
    const tarefaExcluida = await prisma.task.findUnique({ where: { id: tarefa.id } });

    expect(projetoExcluido?.deletionBatchId).toBe(deletionBatchId);
    expect(tarefaExcluida?.deletionBatchId).toBe(deletionBatchId);
    expect(tarefaExcluida?.deletedBy).toBe(dono.id);
  });

  it("uma tarefa já na Lixeira não entra no lote do projeto", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { name: "P" });
    const antiga = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Excluída antes",
    });
    await prisma.task.update({
      where: { id: antiga.id },
      data: { deletedAt: new Date(), deletionBatchId: null },
    });

    const { deletionBatchId } = await excluirProjeto(dono.id, projeto.id);

    // Restaurar o projeto não deve ressuscitar o que já estava descartado.
    const aindaAntiga = await prisma.task.findUnique({ where: { id: antiga.id } });
    expect(aindaAntiga?.deletionBatchId).not.toBe(deletionBatchId);
  });

  it("EDITOR não exclui projeto", async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { name: "P" });
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);

    const erro = await erroDe(() => excluirProjeto(editor.id, projeto.id));
    expect(erro?.code).toBe("SEM_PERMISSAO");
  });

  it("projeto excluído some das consultas", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { name: "P" });
    await excluirProjeto(dono.id, projeto.id);

    expect((await erroDe(() => obterProjeto(dono.id, projeto.id)))?.code).toBe(
      "NAO_ENCONTRADO",
    );
  });
});

describe("níveis e prazo do projeto", () => {
  it("sem informar, nasce com prioridade Média e sem dificuldade nem prazo", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { name: "Site" });

    expect(projeto.priority).toBe("MEDIA");
    expect(projeto.difficulty).toBeNull();
    expect(projeto.dueDate).toBeNull();
  });

  it("grava e altera prioridade, dificuldade e prazo", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id, {
      name: "App",
      priority: "ALTA",
      difficulty: "CRITICO",
      dueDate: "2026-12-01",
    });
    expect(projeto.difficulty).toBe("CRITICO");
    expect(projeto.dueDate?.toISOString().slice(0, 10)).toBe("2026-12-01");

    // null limpa a estimativa: "não estimada" é um estado legítimo.
    const editado = await atualizarProjeto(dono.id, projeto.id, {
      difficulty: null,
      dueDate: null,
      priority: "BAIXA",
    });
    expect(editado.difficulty).toBeNull();
    expect(editado.dueDate).toBeNull();
    expect(editado.priority).toBe("BAIXA");
  });

  it("a listagem completa traz os membros, com o dono primeiro", async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { name: "Time" });
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);

    const [item] = await listarTodosOsProjetos(dono.id);
    expect(item?.members.map((m) => m.user.id)).toEqual([dono.id, editor.id]);
  });
});

describe("quem alterou o projeto por último", () => {
  it("ao criar, é quem criou", async () => {
    const dono = await criarUsuario("Ana");
    const projeto = await criarProjeto(dono.id, { name: "Site" });

    expect(projeto.updatedBy?.id).toBe(dono.id);
    expect((await obterProjeto(dono.id, projeto.id)).projeto.updatedBy?.name).toBe("Ana");
  });

  it("editar o projeto passa a autoria para quem editou", async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario("Bruno");
    const projeto = await criarProjeto(dono.id, { name: "Site" });
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);

    // Mover no Kanban é uma edição da etapa, pelo mesmo caminho.
    await atualizarProjeto(editor.id, projeto.id, { status: "EM_ANDAMENTO" });

    const { projeto: lido } = await obterProjeto(dono.id, projeto.id);
    expect(lido.updatedBy).toEqual(
      expect.objectContaining({ id: editor.id, name: "Bruno" }),
    );
    const [item] = await listarTodosOsProjetos(dono.id);
    expect(item?.updatedBy?.id).toBe(editor.id);
  });

  it("criar ou alterar tarefas não conta como alteração do projeto", async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { name: "Site" });
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);

    const tarefa = await criarTarefa(editor.id, { projectId: projeto.id, title: "T" });
    await atualizarTarefa(editor.id, tarefa.id, { title: "T2", version: tarefa.version });

    const { projeto: lido } = await obterProjeto(dono.id, projeto.id);
    expect(lido.updatedBy?.id).toBe(dono.id);
  });

  it("transferir a propriedade conta como alteração", async () => {
    const dono = await criarUsuario();
    const outro = await criarUsuario();
    const projeto = await criarProjeto(dono.id, { name: "P" });
    await adicionarAoProjeto(projeto.id, outro.id, ProjectRole.EDITOR);
    await prisma.project.update({ where: { id: projeto.id }, data: { updatedById: outro.id } });

    await transferirPropriedade(dono.id, projeto.id, outro.id);

    const { projeto: lido } = await obterProjeto(dono.id, projeto.id);
    expect(lido.updatedBy?.id).toBe(dono.id);
  });
});
