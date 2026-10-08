import { ProjectRole, TaskPriority, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../src/lib/errors.js";
import { hojeNoFuso } from "../src/lib/datas.js";
import { prisma } from "../src/lib/prisma.js";
import { criarCaixaDeEntrada } from "../src/modules/projects/inbox.js";
import {
  atualizarTarefa,
  criarTarefa,
  definirResponsaveis,
  excluirTarefa,
  listarTarefasDoProjeto,
  moverTarefa,
  obterTarefa,
  porPrioridade,
  recentes,
  todasAsTarefas,
  vencemHoje,
} from "../src/modules/tasks/tasks.service.js";
import {
  adicionarAoProjeto,
  criarProjeto,
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

const FUSO = "America/Sao_Paulo";

describe("criar tarefa", () => {
  it("sem projeto informado, vai para a Caixa de entrada", async () => {
    const usuario = await criarUsuario();
    const inbox = await criarCaixaDeEntrada(usuario.id);

    const tarefa = await criarTarefa(usuario.id, { title: "Comprar café" });
    expect(tarefa.projectId).toBe(inbox.id);
  });

  it("VIEWER não cria tarefa", async () => {
    const dono = await criarUsuario();
    const viewer = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, viewer.id, ProjectRole.VIEWER);

    const erro = await erroDe(() =>
      criarTarefa(viewer.id, { projectId: projeto.id, title: "X" }),
    );
    expect(erro?.code).toBe("SEM_PERMISSAO");
  });

  it("responsável precisa participar do projeto", async () => {
    const dono = await criarUsuario();
    const estranho = await criarUsuario();
    const projeto = await criarProjeto(dono.id);

    const erro = await erroDe(() =>
      criarTarefa(dono.id, {
        projectId: projeto.id,
        title: "X",
        assigneeIds: [estranho.id],
      }),
    );
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
  });

  it("aceita vários responsáveis", async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);

    const tarefa = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "A dois",
      assigneeIds: [dono.id, editor.id],
    });
    expect(tarefa.assignees).toHaveLength(2);
  });

  it("concluída já nasce com a data de conclusão", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);

    const tarefa = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Já feita",
      status: TaskStatus.CONCLUIDO,
    });
    expect(tarefa.completedAt).not.toBeNull();
  });
});

describe("subtarefas", () => {
  it("aceita um nível, e recusa o segundo", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);

    const pai = await criarTarefa(dono.id, { projectId: projeto.id, title: "Pai" });
    const filha = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Filha",
      parentId: pai.id,
    });
    expect(filha.parentId).toBe(pai.id);

    const erro = await erroDe(() =>
      criarTarefa(dono.id, {
        projectId: projeto.id,
        title: "Neta",
        parentId: filha.id,
      }),
    );
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
    expect(erro?.message).toContain("um nível só");
  });

  it("subtarefa precisa ser do mesmo projeto do pai", async () => {
    const dono = await criarUsuario();
    const projetoA = await criarProjeto(dono.id);
    const projetoB = await criarProjeto(dono.id);
    const pai = await criarTarefa(dono.id, { projectId: projetoA.id, title: "Pai" });

    const erro = await erroDe(() =>
      criarTarefa(dono.id, {
        projectId: projetoB.id,
        title: "Filha",
        parentId: pai.id,
      }),
    );
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
  });

  it("no Kanban, subtarefas não aparecem como cartões soltos", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const pai = await criarTarefa(dono.id, { projectId: projeto.id, title: "Pai" });
    await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Filha",
      parentId: pai.id,
    });

    const lista = await listarTarefasDoProjeto(dono.id, projeto.id);
    expect(lista.map((t) => t.id)).toEqual([pai.id]);
    expect(lista[0]?._count.subtasks).toBe(1);
  });

  it("concluir o pai com subtarefa aberta exige confirmação", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const pai = await criarTarefa(dono.id, { projectId: projeto.id, title: "Pai" });
    await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Filha",
      parentId: pai.id,
    });

    const erro = await erroDe(() =>
      atualizarTarefa(dono.id, pai.id, {
        status: TaskStatus.CONCLUIDO,
        version: pai.version,
      }),
    );
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");

    // Nada é concluído em cascata: quem decide é o usuário.
    const confirmada = await atualizarTarefa(dono.id, pai.id, {
      status: TaskStatus.CONCLUIDO,
      version: pai.version,
      concluirComSubtarefasAbertas: true,
    });
    expect(confirmada.status).toBe(TaskStatus.CONCLUIDO);

    const filha = await prisma.task.findFirst({ where: { parentId: pai.id } });
    expect(filha?.status).not.toBe(TaskStatus.CONCLUIDO);
  });

  it("excluir o pai leva as subtarefas no mesmo lote", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const pai = await criarTarefa(dono.id, { projectId: projeto.id, title: "Pai" });
    const filha = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Filha",
      parentId: pai.id,
    });

    const { deletionBatchId } = await excluirTarefa(dono.id, pai.id);

    const filhaExcluida = await prisma.task.findUnique({ where: { id: filha.id } });
    expect(filhaExcluida?.deletionBatchId).toBe(deletionBatchId);
  });
});

describe("conflito de versão", () => {
  it("gravar com versão desatualizada devolve CONFLITO", async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);

    const tarefa = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Disputada",
    });

    // Os dois leem a mesma versão; o segundo a gravar encontra o conflito.
    await atualizarTarefa(dono.id, tarefa.id, {
      title: "Alterada pelo dono",
      version: tarefa.version,
    });

    const erro = await erroDe(() =>
      atualizarTarefa(editor.id, tarefa.id, {
        title: "Alterada pelo editor",
        version: tarefa.version,
      }),
    );
    expect(erro?.code).toBe("CONFLITO");
    // A mensagem nomeia quem alterou, para o aviso ser acionável.
    expect(erro?.message).toContain("alterada por");

    const atual = await prisma.task.findUnique({ where: { id: tarefa.id } });
    expect(atual?.title).toBe("Alterada pelo dono");
  });

  it("a versão avança a cada gravação", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const tarefa = await criarTarefa(dono.id, { projectId: projeto.id, title: "T" });

    const v2 = await atualizarTarefa(dono.id, tarefa.id, {
      title: "T2",
      version: tarefa.version,
    });
    expect(v2.version).toBe(tarefa.version + 1);
  });
});

describe("status e conclusão", () => {
  it("a data de conclusão é gravada ao concluir e limpa ao reabrir", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const tarefa = await criarTarefa(dono.id, { projectId: projeto.id, title: "T" });

    const concluida = await atualizarTarefa(dono.id, tarefa.id, {
      status: TaskStatus.CONCLUIDO,
      version: tarefa.version,
    });
    expect(concluida.completedAt).not.toBeNull();

    const reaberta = await atualizarTarefa(dono.id, tarefa.id, {
      status: TaskStatus.EM_ANDAMENTO,
      version: concluida.version,
    });
    // Sem isso, o gráfico de concluídas por semana contaria tarefas reabertas.
    expect(reaberta.completedAt).toBeNull();
  });
});

describe("ordem no Kanban", () => {
  it("mover para o fim da coluna preserva a ordem das demais", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const a = await criarTarefa(dono.id, { projectId: projeto.id, title: "A" });
    const b = await criarTarefa(dono.id, { projectId: projeto.id, title: "B" });
    const c = await criarTarefa(dono.id, { projectId: projeto.id, title: "C" });

    await moverTarefa(dono.id, a.id, { status: TaskStatus.A_FAZER, antesDeId: null });

    const coluna = await prisma.task.findMany({
      where: { projectId: projeto.id, status: TaskStatus.A_FAZER },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    expect(coluna.map((t) => t.id)).toEqual([b.id, c.id, a.id]);
  });

  it("mover para antes de outra tarefa a coloca na posição certa", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const a = await criarTarefa(dono.id, { projectId: projeto.id, title: "A" });
    const b = await criarTarefa(dono.id, { projectId: projeto.id, title: "B" });
    const c = await criarTarefa(dono.id, { projectId: projeto.id, title: "C" });

    await moverTarefa(dono.id, c.id, { status: TaskStatus.A_FAZER, antesDeId: b.id });

    const coluna = await prisma.task.findMany({
      where: { projectId: projeto.id, status: TaskStatus.A_FAZER },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    expect(coluna.map((t) => t.id)).toEqual([a.id, c.id, b.id]);
  });

  it("mover entre colunas ajusta o status e a data de conclusão", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const tarefa = await criarTarefa(dono.id, { projectId: projeto.id, title: "T" });

    const movida = await moverTarefa(dono.id, tarefa.id, {
      status: TaskStatus.CONCLUIDO,
    });
    expect(movida.status).toBe(TaskStatus.CONCLUIDO);
    expect(movida.completedAt).not.toBeNull();
  });
});

describe("listas da barra lateral", () => {
  it('"Vencem Hoje" traz só o que é meu e vence hoje', async () => {
    const dono = await criarUsuario();
    const outro = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, outro.id, ProjectRole.EDITOR);
    const hoje = hojeNoFuso(FUSO);

    const minha = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Minha de hoje",
      dueDate: hoje,
      assigneeIds: [dono.id],
    });
    await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "De outro, hoje",
      dueDate: hoje,
      assigneeIds: [outro.id],
    });
    await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Minha, sem prazo",
      assigneeIds: [dono.id],
    });

    const lista = await vencemHoje(dono.id, FUSO);
    expect(lista.map((t) => t.id)).toEqual([minha.id]);
  });

  it('"Vencem Hoje" ignora Backlog, Em pausa e Concluído', async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const hoje = hojeNoFuso(FUSO);

    for (const status of [
      TaskStatus.BACKLOG,
      TaskStatus.EM_PAUSA,
      TaskStatus.CONCLUIDO,
    ]) {
      await criarTarefa(dono.id, {
        projectId: projeto.id,
        title: status,
        dueDate: hoje,
        status,
        assigneeIds: [dono.id],
      });
    }

    // Só trabalho ativo entra: a seção não pode virar um acumulado.
    expect(await vencemHoje(dono.id, FUSO)).toHaveLength(0);
  });

  it("as seções de prioridade incluem Backlog e Em pausa, mas não Concluído", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);

    for (const status of [
      TaskStatus.BACKLOG,
      TaskStatus.EM_PAUSA,
      TaskStatus.CONCLUIDO,
    ]) {
      await criarTarefa(dono.id, {
        projectId: projeto.id,
        title: status,
        status,
        priority: TaskPriority.ALTA,
        assigneeIds: [dono.id],
      });
    }

    const { itens, total } = await porPrioridade(dono.id, TaskPriority.ALTA);
    expect(total).toBe(2);
    expect(itens.map((t) => t.status).sort()).toEqual(
      [TaskStatus.BACKLOG, TaskStatus.EM_PAUSA].sort(),
    );
  });

  it("sem responsável escolhido, a tarefa fica com quem a criou", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);

    const tarefa = await criarTarefa(dono.id, { projectId: projeto.id, title: "T" });

    expect(tarefa.assignees.map((a) => a.user.id)).toEqual([dono.id]);
  });

  it("as seções de prioridade incluem a Caixa de entrada, mesmo sem responsável", async () => {
    const eu = await criarUsuario();
    const tarefa = await criarTarefa(eu.id, { title: "Pessoal", priority: TaskPriority.ALTA });
    await definirResponsaveis(eu.id, tarefa.id, []);

    const { itens } = await porPrioridade(eu.id, TaskPriority.ALTA);
    expect(itens.map((t) => t.id)).toEqual([tarefa.id]);
  });

  it("as listas não trazem tarefas de projetos alheios", async () => {
    const eu = await criarUsuario();
    const outro = await criarUsuario();
    const alheio = await criarProjeto(outro.id);

    await criarTarefa(outro.id, {
      projectId: alheio.id,
      title: "Secreta",
      priority: TaskPriority.ALTA,
      assigneeIds: [outro.id],
    });

    const { itens } = await porPrioridade(eu.id, TaskPriority.ALTA);
    expect(itens).toHaveLength(0);
  });

  it('"Recentes" mostra quem alterou e não repete a mesma tarefa', async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);

    const tarefa = await criarTarefa(dono.id, { projectId: projeto.id, title: "T" });
    await atualizarTarefa(editor.id, tarefa.id, {
      title: "T editada",
      version: tarefa.version,
    });

    const lista = await recentes(dono.id);
    expect(lista).toHaveLength(1);
    // A alteração mais recente é a do editor, mesmo quem lê sendo o dono.
    expect(lista[0]?.alteradoPor.id).toBe(editor.id);
  });

  it('"Recentes" não vaza tarefas de projetos sem acesso', async () => {
    const eu = await criarUsuario();
    const outro = await criarUsuario();
    const alheio = await criarProjeto(outro.id);
    await criarTarefa(outro.id, { projectId: alheio.id, title: "Secreta" });

    expect(await recentes(eu.id)).toHaveLength(0);
  });
});

describe("responsáveis", () => {
  it("definir substitui o conjunto inteiro", async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);

    const tarefa = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "T",
      assigneeIds: [dono.id],
    });

    await definirResponsaveis(dono.id, tarefa.id, [editor.id]);

    const atual = await obterTarefa(dono.id, tarefa.id);
    expect(atual.assignees.map((a) => a.user.id)).toEqual([editor.id]);
  });

  it("notifica quem foi atribuído, menos quem atribuiu", async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);

    const tarefa = await criarTarefa(dono.id, { projectId: projeto.id, title: "T" });
    await definirResponsaveis(dono.id, tarefa.id, [dono.id, editor.id]);

    expect(
      await prisma.notification.count({
        where: { userId: editor.id, type: "TAREFA_ATRIBUIDA" },
      }),
    ).toBe(1);
    expect(
      await prisma.notification.count({
        where: { userId: dono.id, type: "TAREFA_ATRIBUIDA" },
      }),
    ).toBe(0);
  });
});

describe("acesso às tarefas", () => {
  it("tarefa de projeto invisível responde NAO_ENCONTRADO", async () => {
    const dono = await criarUsuario();
    const estranho = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const tarefa = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Secreta",
    });

    // A existência da tarefa não pode revelar a existência do projeto.
    expect((await erroDe(() => obterTarefa(estranho.id, tarefa.id)))?.code).toBe(
      "NAO_ENCONTRADO",
    );
  });

  it("EDITOR exclui a própria tarefa, mas não a dos outros", async () => {
    const dono = await criarUsuario();
    const editor = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);

    const doDono = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Do dono",
    });
    const doEditor = await criarTarefa(editor.id, {
      projectId: projeto.id,
      title: "Do editor",
    });

    expect((await erroDe(() => excluirTarefa(editor.id, doDono.id)))?.code).toBe(
      "SEM_PERMISSAO",
    );
    await excluirTarefa(editor.id, doEditor.id);
    expect(
      (await prisma.task.findUnique({ where: { id: doEditor.id } }))?.deletedAt,
    ).not.toBeNull();
  });
});

describe("todas as tarefas", () => {
  it("inclui as da Caixa de entrada mesmo sem responsável", async () => {
    const usuario = await criarUsuario();
    await criarCaixaDeEntrada(usuario.id);
    const semDono = await criarTarefa(usuario.id, { title: "Anotar ideia" });

    const ids = (await todasAsTarefas(usuario.id)).map((t) => t.id);
    expect(ids).toContain(semDono.id);
  });

  it("fora da Caixa de entrada, só as atribuídas a mim", async () => {
    const dono = await criarUsuario();
    const colega = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, colega.id, ProjectRole.EDITOR);

    const minha = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Minha",
      assigneeIds: [dono.id],
    });
    const doColega = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Do colega",
      assigneeIds: [colega.id],
    });
    const semNinguem = await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Sem ninguém",
    });
    // Nasce com quem a criou; tirar o responsável é o que a deixa sem ninguém.
    await definirResponsaveis(dono.id, semNinguem.id, []);

    const ids = (await todasAsTarefas(dono.id)).map((t) => t.id);
    expect(ids).toContain(minha.id);
    expect(ids).not.toContain(doColega.id);
    expect(ids).not.toContain(semNinguem.id);
  });

  it("a Caixa de entrada de outra pessoa não aparece", async () => {
    const eu = await criarUsuario();
    const outro = await criarUsuario();
    await criarCaixaDeEntrada(outro.id);
    const deOutro = await criarTarefa(outro.id, { title: "Particular" });

    const ids = (await todasAsTarefas(eu.id)).map((t) => t.id);
    expect(ids).not.toContain(deOutro.id);
  });
});

describe("dificuldade da tarefa", () => {
  it("é opcional, e pode ser definida e limpa depois", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    const tarefa = await criarTarefa(dono.id, { projectId: projeto.id, title: "Estimar" });
    expect(tarefa.difficulty).toBeNull();

    const estimada = await atualizarTarefa(dono.id, tarefa.id, {
      difficulty: "COMPLEXO",
      version: tarefa.version,
    });
    expect(estimada.difficulty).toBe("COMPLEXO");

    const limpa = await atualizarTarefa(dono.id, tarefa.id, {
      difficulty: null,
      version: estimada.version,
    });
    expect(limpa.difficulty).toBeNull();
  });
});
