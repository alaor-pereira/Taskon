import { Difficulty, ProjectRole, TaskPriority, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import {
  daquiADias,
  dataPura,
  ehDataValida,
  hojeNoFuso,
  inicioDoDiaNoFuso,
} from "../src/lib/datas.js";
import { prisma } from "../src/lib/prisma.js";
import { montarDashboard } from "../src/modules/dashboard/dashboard.service.js";
import {
  avisarVencimentos,
  expirarConvites,
  limparLixeira,
} from "../src/modules/cron/jobs.service.js";
import { criarTarefa, definirResponsaveis } from "../src/modules/tasks/tasks.service.js";
import { excluirProjeto } from "../src/modules/projects/projects.service.js";
import { convidarParaEquipe } from "../src/modules/invitations/invitations.service.js";
import {
  adicionarAoProjeto,
  criarEquipe,
  criarProjeto,
  criarUsuario,
  limparBanco,
} from "./factories.js";

beforeEach(limparBanco);

const FUSO = "America/Sao_Paulo";

describe("distribuições", () => {
  it("conta por etapa e por prioridade", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);

    for (const status of [
      TaskStatus.A_FAZER,
      TaskStatus.A_FAZER,
      TaskStatus.EM_ANDAMENTO,
      TaskStatus.CONCLUIDO,
    ]) {
      await criarTarefa(eu.id, {
        projectId: projeto.id,
        title: status,
        status,
        priority: TaskPriority.ALTA,
        assigneeIds: [eu.id],
      });
    }

    const d = await montarDashboard(eu.id, FUSO);

    const porStatus = new Map(d.porStatus.map((s) => [s.status, s.total]));
    expect(porStatus.get(TaskStatus.A_FAZER)).toBe(2);
    expect(porStatus.get(TaskStatus.EM_ANDAMENTO)).toBe(1);
    expect(porStatus.get(TaskStatus.CONCLUIDO)).toBe(1);

    // Prioridade de tarefa concluída não informa nada sobre o que falta.
    const alta = d.porPrioridade.find((p) => p.priority === TaskPriority.ALTA);
    expect(alta?.total).toBe(3);
  });

  it("todas as etapas aparecem, mesmo zeradas", async () => {
    const eu = await criarUsuario();
    await criarProjeto(eu.id);

    const d = await montarDashboard(eu.id, FUSO);
    // Um gráfico com barras faltando esconderia que a etapa existe.
    expect(d.porStatus).toHaveLength(6);
    expect(d.porPrioridade).toHaveLength(3);
  });
});

describe("prazos", () => {
  it("separa atrasadas, próximos 7 dias e sem prazo", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);

    const ontem = daquiADias(FUSO, -1);
    const emTresDias = daquiADias(FUSO, 3);

    await criarTarefa(eu.id, {
      projectId: projeto.id,
      title: "Atrasada",
      dueDate: ontem,
      assigneeIds: [eu.id],
    });
    await criarTarefa(eu.id, {
      projectId: projeto.id,
      title: "Em breve",
      dueDate: emTresDias,
      assigneeIds: [eu.id],
    });
    await criarTarefa(eu.id, {
      projectId: projeto.id,
      title: "Sem prazo",
      assigneeIds: [eu.id],
    });

    const d = await montarDashboard(eu.id, FUSO);
    expect(d.prazos.atrasadas).toBe(1);
    expect(d.prazos.proximosSeteDias).toBe(1);
    expect(d.prazos.semTerminoDefinido).toBe(1);
  });

  it("Backlog, Em pausa e Concluído não contam como atrasadas", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);
    const ontem = daquiADias(FUSO, -1);

    for (const status of [
      TaskStatus.BACKLOG,
      TaskStatus.EM_PAUSA,
      TaskStatus.CONCLUIDO,
    ]) {
      await criarTarefa(eu.id, {
        projectId: projeto.id,
        title: status,
        status,
        dueDate: ontem,
        assigneeIds: [eu.id],
      });
    }

    // Atrasada só vale para trabalho ativo, senão o aviso perde o sentido.
    expect((await montarDashboard(eu.id, FUSO)).prazos.atrasadas).toBe(0);
  });
});

const somar = (linhas: Array<{ criadas: number; concluidas: number }>, campo: "criadas" | "concluidas") =>
  linhas.reduce((soma, l) => soma + l[campo], 0);

/** Os últimos N dias, contando hoje, no fuso dos testes. */
const ultimosDias = (n: number) => ({ de: daquiADias(FUSO, -(n - 1)), ate: hojeNoFuso(FUSO) });

/** Um instante N dias atrás. */
const diasAtras = (n: number) => {
  const data = new Date();
  data.setDate(data.getDate() - n);
  return data;
};

describe("criadas e concluídas", () => {
  it("conta dentro do período", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);

    const tarefa = await criarTarefa(eu.id, {
      projectId: projeto.id,
      title: "Feita",
      status: TaskStatus.CONCLUIDO,
      assigneeIds: [eu.id],
    });
    expect(tarefa.completedAt).not.toBeNull();

    const d = await montarDashboard(eu.id, FUSO, ultimosDias(30));
    expect(somar(d.fluxo.baldes, "concluidas")).toBe(1);
    expect(somar(d.fluxo.baldes, "criadas")).toBe(1);
  });

  it("ignora conclusões anteriores ao período", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);
    const tarefa = await criarTarefa(eu.id, {
      projectId: projeto.id,
      title: "Antiga",
      status: TaskStatus.CONCLUIDO,
      assigneeIds: [eu.id],
    });

    await prisma.task.update({
      where: { id: tarefa.id },
      data: { createdAt: diasAtras(110), completedAt: diasAtras(100) },
    });

    const d = await montarDashboard(eu.id, FUSO, ultimosDias(30));
    expect(somar(d.fluxo.baldes, "concluidas")).toBe(0);
  });

  it("a barra é por dia até um mês, por semana até seis meses e por mês acima", async () => {
    const eu = await criarUsuario();
    await criarProjeto(eu.id);

    const semana = await montarDashboard(eu.id, FUSO, ultimosDias(7));
    expect(semana.fluxo.granularidade).toBe("dia");
    expect(semana.fluxo.baldes).toHaveLength(7);
    expect(semana.fluxo.baldes.at(-1)?.inicio).toBe(hojeNoFuso(FUSO));

    const trimestre = await montarDashboard(eu.id, FUSO, ultimosDias(90));
    expect(trimestre.fluxo.granularidade).toBe("semana");

    const ano = await montarDashboard(eu.id, FUSO, ultimosDias(365));
    expect(ano.fluxo.granularidade).toBe("mes");
    expect(ano.fluxo.baldes.length).toBeGreaterThanOrEqual(12);
    expect(ano.fluxo.baldes.every((b) => b.inicio.endsWith("-01"))).toBe(true);
  });

  it("um intervalo no passado conta só o que caiu nele", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);
    const base = { projectId: projeto.id, assigneeIds: [eu.id] };
    const antiga = await criarTarefa(eu.id, { ...base, title: "antiga" });
    await criarTarefa(eu.id, { ...base, title: "nova" });
    await prisma.task.update({ where: { id: antiga.id }, data: { createdAt: diasAtras(45) } });

    const d = await montarDashboard(eu.id, FUSO, {
      de: daquiADias(FUSO, -60),
      ate: daquiADias(FUSO, -31),
    });
    expect(somar(d.fluxo.baldes, "criadas")).toBe(1);
    expect(d.porStatus.reduce((t, s) => t + s.total, 0)).toBe(1);
  });

  it("todo o período: o fluxo começa na primeira tarefa", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);
    const antiga = await criarTarefa(eu.id, {
      projectId: projeto.id,
      title: "antiga",
      assigneeIds: [eu.id],
    });
    await prisma.task.update({ where: { id: antiga.id }, data: { createdAt: diasAtras(400) } });

    const d = await montarDashboard(eu.id, FUSO);
    expect(d.filtros).toMatchObject({ de: null, ate: null });
    expect(d.fluxo.granularidade).toBe("mes");
    expect(somar(d.fluxo.baldes, "criadas")).toBe(1);
    // O mapa não passa de 12 meses, mesmo com tarefa mais antiga.
    expect(d.mapaDeEntregas.inicio).toBe(daquiADias(FUSO, -364));
    expect(d.mapaDeEntregas.fim).toBe(hojeNoFuso(FUSO));
  });
});

describe("o período nos retratos", () => {
  it("etapas, prioridade, progresso e carga contam só as criadas no período", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);
    const base = { projectId: projeto.id, assigneeIds: [eu.id], priority: TaskPriority.ALTA };
    const antiga = await criarTarefa(eu.id, { ...base, title: "antiga" });
    await criarTarefa(eu.id, { ...base, title: "nova" });
    await prisma.task.update({ where: { id: antiga.id }, data: { createdAt: diasAtras(60) } });

    const recente = await montarDashboard(eu.id, FUSO, ultimosDias(30));
    expect(recente.porStatus.reduce((t, s) => t + s.total, 0)).toBe(1);
    expect(recente.porPrioridade.find((p) => p.priority === TaskPriority.ALTA)?.total).toBe(1);
    expect(recente.progressoPorProjeto[0]?.total).toBe(1);
    expect(recente.cargaPorResponsavel.pessoas[0]?.ALTA).toBe(1);

    const tudo = await montarDashboard(eu.id, FUSO);
    expect(tudo.porStatus.reduce((t, s) => t + s.total, 0)).toBe(2);
    expect(tudo.cargaPorResponsavel.pessoas[0]?.ALTA).toBe(2);
  });

  it("projetos por etapa contam os criados no período", async () => {
    const eu = await criarUsuario();
    const antigo = await criarProjeto(eu.id);
    await criarProjeto(eu.id);
    await prisma.project.update({ where: { id: antigo.id }, data: { createdAt: diasAtras(60) } });

    const d = await montarDashboard(eu.id, FUSO, ultimosDias(30));
    expect(d.projetosPorEtapa.reduce((t, p) => t + p.total, 0)).toBe(1);
  });

  it("os prazos ignoram o período", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);
    const antiga = await criarTarefa(eu.id, {
      projectId: projeto.id,
      title: "atrasada há tempos",
      dueDate: daquiADias(FUSO, -40),
      assigneeIds: [eu.id],
    });
    await prisma.task.update({ where: { id: antiga.id }, data: { createdAt: diasAtras(60) } });

    const d = await montarDashboard(eu.id, FUSO, ultimosDias(7));
    expect(d.prazos.atrasadas).toBe(1);
  });
});

describe("datas no fuso", () => {
  it("a meia-noite de São Paulo é 03:00 UTC", () => {
    expect(inicioDoDiaNoFuso("2026-09-20", FUSO).toISOString()).toBe("2026-09-20T03:00:00.000Z");
    expect(inicioDoDiaNoFuso("2026-09-20", "UTC").toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });

  it("reconhece datas que não existem", () => {
    expect(ehDataValida("2026-02-28")).toBe(true);
    expect(ehDataValida("2026-02-31")).toBe(false);
    expect(ehDataValida("20-02-2026")).toBe(false);
  });
});

describe("progresso por projeto", () => {
  it("calcula o percentual concluído", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id, { nome: "Alfa" });

    await criarTarefa(eu.id, {
      projectId: projeto.id,
      title: "1",
      status: TaskStatus.CONCLUIDO,
      assigneeIds: [eu.id],
    });
    for (const i of [2, 3, 4]) {
      await criarTarefa(eu.id, {
        projectId: projeto.id,
        title: String(i),
        assigneeIds: [eu.id],
      });
    }

    const d = await montarDashboard(eu.id, FUSO);
    const alfa = d.progressoPorProjeto.find((p) => p.nome === "Alfa");
    expect(alfa?.total).toBe(4);
    expect(alfa?.concluidas).toBe(1);
    expect(alfa?.percentual).toBe(25);
  });

  it("projeto sem tarefa fica de fora", async () => {
    const eu = await criarUsuario();
    await criarProjeto(eu.id, { nome: "Vazio" });

    expect((await montarDashboard(eu.id, FUSO)).progressoPorProjeto).toHaveLength(0);
  });
});

describe("escopo e filtros", () => {
  it('"minhas" traz só onde sou responsável; "todas" traz o projeto inteiro', async () => {
    const dono = await criarUsuario();
    const colega = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, colega.id, ProjectRole.EDITOR);

    await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Minha",
      assigneeIds: [dono.id],
    });
    await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Do colega",
      assigneeIds: [colega.id],
    });

    const minhas = await montarDashboard(dono.id, FUSO, { escopo: "MINHAS" });
    const todas = await montarDashboard(dono.id, FUSO, { escopo: "TODAS" });

    expect(soma(minhas.porStatus)).toBe(1);
    expect(soma(todas.porStatus)).toBe(2);
  });

  it("filtrar por projeto restringe os números", async () => {
    const eu = await criarUsuario();
    const a = await criarProjeto(eu.id, { nome: "A" });
    const b = await criarProjeto(eu.id, { nome: "B" });

    await criarTarefa(eu.id, { projectId: a.id, title: "1", assigneeIds: [eu.id] });
    await criarTarefa(eu.id, { projectId: b.id, title: "2", assigneeIds: [eu.id] });

    const d = await montarDashboard(eu.id, FUSO, { projectId: a.id });
    expect(soma(d.porStatus)).toBe(1);
    expect(d.progressoPorProjeto).toHaveLength(1);
  });
});

describe("o Dashboard respeita a permissão", () => {
  it("não conta tarefas de projeto alheio", async () => {
    const eu = await criarUsuario();
    const outro = await criarUsuario();
    const alheio = await criarProjeto(outro.id);

    await criarTarefa(outro.id, {
      projectId: alheio.id,
      title: "Secreta",
      assigneeIds: [outro.id],
    });

    const d = await montarDashboard(eu.id, FUSO, { escopo: "TODAS" });
    expect(soma(d.porStatus)).toBe(0);
    expect(d.progressoPorProjeto).toHaveLength(0);
  });

  it("filtrar por um projeto alheio não revela nada", async () => {
    const eu = await criarUsuario();
    const outro = await criarUsuario();
    const alheio = await criarProjeto(outro.id);
    await criarTarefa(outro.id, {
      projectId: alheio.id,
      title: "Secreta",
      assigneeIds: [outro.id],
    });

    // O filtro é aplicado sobre os projetos visíveis: um id alheio não
    // aumenta o alcance da consulta.
    const d = await montarDashboard(eu.id, FUSO, {
      projectId: alheio.id,
      escopo: "TODAS",
    });
    expect(soma(d.porStatus)).toBe(0);
  });

  it("projeto na Lixeira sai das contas", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);
    await criarTarefa(eu.id, {
      projectId: projeto.id,
      title: "Some",
      assigneeIds: [eu.id],
    });

    await excluirProjeto(eu.id, projeto.id);
    expect(soma((await montarDashboard(eu.id, FUSO)).porStatus)).toBe(0);
  });
});

describe("rotinas agendadas", () => {
  it("avisa quem é responsável por tarefa que vence hoje", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);
    await criarTarefa(eu.id, {
      projectId: projeto.id,
      title: "Vence hoje",
      dueDate: hojeNoFuso(FUSO),
      assigneeIds: [eu.id],
    });

    await avisarVencimentos();
    expect(
      await prisma.notification.count({
        where: { userId: eu.id, type: "TAREFA_VENCENDO" },
      }),
    ).toBe(1);
  });

  it("rodar de novo no mesmo dia não duplica o aviso", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);
    await criarTarefa(eu.id, {
      projectId: projeto.id,
      title: "Vence hoje",
      dueDate: hojeNoFuso(FUSO),
      assigneeIds: [eu.id],
    });

    // O agendador roda de poucos em poucos minutos: repetir é o caso normal.
    await avisarVencimentos();
    await avisarVencimentos();
    await avisarVencimentos();

    expect(
      await prisma.notification.count({
        where: { userId: eu.id, type: "TAREFA_VENCENDO" },
      }),
    ).toBe(1);
  });

  it("não avisa sobre tarefa sem responsável nem fora do prazo de hoje", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);

    const semResponsavel = await criarTarefa(eu.id, {
      projectId: projeto.id,
      title: "Sem responsável",
      dueDate: hojeNoFuso(FUSO),
    });
    await definirResponsaveis(eu.id, semResponsavel.id, []);
    await criarTarefa(eu.id, {
      projectId: projeto.id,
      title: "Amanhã",
      dueDate: daquiADias(FUSO, 1),
      assigneeIds: [eu.id],
    });

    await avisarVencimentos();
    expect(
      await prisma.notification.count({ where: { type: "TAREFA_VENCENDO" } }),
    ).toBe(0);
  });

  it("não avisa sobre tarefa em Backlog ou concluída", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);

    for (const status of [TaskStatus.BACKLOG, TaskStatus.CONCLUIDO]) {
      await criarTarefa(eu.id, {
        projectId: projeto.id,
        title: status,
        status,
        dueDate: hojeNoFuso(FUSO),
        assigneeIds: [eu.id],
      });
    }

    await avisarVencimentos();
    expect(
      await prisma.notification.count({ where: { type: "TAREFA_VENCENDO" } }),
    ).toBe(0);
  });

  it("respeita o fuso de cada pessoa", async () => {
    const saoPaulo = await criarUsuario();
    const toquio = await criarUsuario();
    await prisma.user.update({
      where: { id: toquio.id },
      data: { timezone: "Asia/Tokyo" },
    });

    const projeto = await criarProjeto(saoPaulo.id);
    await adicionarAoProjeto(projeto.id, toquio.id, ProjectRole.EDITOR);

    // Vence no "hoje" de Tóquio, que pode ser outro dia para São Paulo.
    await criarTarefa(saoPaulo.id, {
      projectId: projeto.id,
      title: "Prazo de Tóquio",
      dueDate: hojeNoFuso("Asia/Tokyo"),
      assigneeIds: [saoPaulo.id, toquio.id],
    });

    await avisarVencimentos();

    expect(
      await prisma.notification.count({
        where: { userId: toquio.id, type: "TAREFA_VENCENDO" },
      }),
    ).toBe(1);
  });

  it("a purga apaga o que passou de 30 dias", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);
    await excluirProjeto(eu.id, projeto.id);

    const trintaEUm = new Date();
    trintaEUm.setDate(trintaEUm.getDate() - 31);
    await prisma.project.update({
      where: { id: projeto.id },
      data: { deletedAt: trintaEUm },
    });

    const r = await limparLixeira();
    expect(r.projetosApagados).toBe(1);
  });

  it("convites vencidos passam a constar como expirados", async () => {
    const dono = await criarUsuario();
    const equipe = await criarEquipe(dono.id);
    const { convite } = await convidarParaEquipe(dono.id, equipe.id, {
      email: "tarde@teste.local",
      role: "MEMBRO",
    });

    await prisma.invitation.update({
      where: { id: convite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const r = await expirarConvites();
    expect(r.convitesExpirados).toBe(1);
    expect(
      (await prisma.invitation.findUnique({ where: { id: convite.id } }))?.status,
    ).toBe("EXPIRADO");
  });
});

const soma = (linhas: Array<{ total: number }>) =>
  linhas.reduce((t, l) => t + l.total, 0);

describe("gráficos do dashboard", () => {
  it("radar: os projetos com mais tarefas, com a contagem por etapa", async () => {
    const eu = await criarUsuario();
    const tamanhos = [5, 4, 3, 2, 1];
    for (const [i, quantidade] of tamanhos.entries()) {
      const projeto = await criarProjeto(eu.id, { nome: `P${i}` });
      for (let n = 0; n < quantidade; n++) {
        await criarTarefa(eu.id, {
          projectId: projeto.id,
          title: `T${n}`,
          status: n === 0 ? TaskStatus.CONCLUIDO : TaskStatus.EM_ANDAMENTO,
          assigneeIds: [eu.id],
        });
      }
    }

    const { etapasPorProjeto } = await montarDashboard(eu.id, FUSO);

    expect(etapasPorProjeto.map((p) => p.nome)).toEqual(["P0", "P1", "P2"]);
    expect(etapasPorProjeto[0]?.porStatus).toMatchObject({
      CONCLUIDO: 1,
      EM_ANDAMENTO: 4,
      BACKLOG: 0,
    });
  });

  it("dificuldade das abertas, com a não estimada à parte", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);
    const base = { projectId: projeto.id, assigneeIds: [eu.id] };
    await criarTarefa(eu.id, { ...base, title: "a", difficulty: Difficulty.ROTINEIRO });
    await criarTarefa(eu.id, { ...base, title: "b" });
    await criarTarefa(eu.id, { ...base, title: "c" });
    await criarTarefa(eu.id, {
      ...base,
      title: "pronta",
      difficulty: Difficulty.CRITICO,
      status: TaskStatus.CONCLUIDO,
    });

    const porDificuldade = new Map(
      (await montarDashboard(eu.id, FUSO)).porDificuldade.map((d) => [d.difficulty, d.total]),
    );
    expect(porDificuldade.get(Difficulty.ROTINEIRO)).toBe(1);
    expect(porDificuldade.get("NAO_ESTIMADA")).toBe(2);
    expect(porDificuldade.get(Difficulty.CRITICO)).toBe(0);
  });

  it("projetos por etapa, sem a Caixa de entrada", async () => {
    const eu = await criarUsuario();
    await criarProjeto(eu.id, { isInbox: true });
    const feito = await criarProjeto(eu.id);
    await criarProjeto(eu.id);
    await prisma.project.update({ where: { id: feito.id }, data: { status: TaskStatus.CONCLUIDO } });

    const porEtapa = new Map(
      (await montarDashboard(eu.id, FUSO)).projetosPorEtapa.map((p) => [p.status, p.total]),
    );
    expect(porEtapa.get(TaskStatus.CONCLUIDO)).toBe(1);
    expect(porEtapa.get(TaskStatus.A_FAZER)).toBe(1);
  });

  it("toda semana do período aparece, mesmo sem movimento", async () => {
    const eu = await criarUsuario();
    await criarProjeto(eu.id);

    const { fluxo } = await montarDashboard(eu.id, FUSO, ultimosDias(90));
    expect(fluxo.baldes.length).toBeGreaterThanOrEqual(13);
    expect(fluxo.baldes.every((s) => s.criadas === 0 && s.concluidas === 0)).toBe(true);
  });

  it("no prazo: compara o dia da conclusão, no fuso da pessoa, com o vencimento", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);
    const base = { projectId: projeto.id, assigneeIds: [eu.id], status: TaskStatus.CONCLUIDO };

    await criarTarefa(eu.id, { ...base, title: "No prazo", dueDate: daquiADias(FUSO, 1) });
    await criarTarefa(eu.id, { ...base, title: "Atrasada", dueDate: daquiADias(FUSO, -5) });
    await criarTarefa(eu.id, { ...base, title: "Sem prazo" });

    // 02:00 UTC de anteontem+1 é 23:00 de anteontem em São Paulo: no fuso da
    // pessoa, foi entregue no dia do vencimento.
    const vespera = await criarTarefa(eu.id, {
      ...base,
      title: "Na virada",
      dueDate: daquiADias(FUSO, -2),
    });
    const conclusao = dataPura(daquiADias(FUSO, -1));
    conclusao.setUTCHours(2);
    await prisma.task.update({ where: { id: vespera.id }, data: { completedAt: conclusao } });

    const { noPrazo } = await montarDashboard(eu.id, FUSO, ultimosDias(30));
    expect(noPrazo).toEqual({ concluidas: 4, comPrazo: 3, dentroDoPrazo: 2 });
  });

  it("carga: o time todo, mesmo em 'só as minhas', só nos projetos visíveis", async () => {
    const eu = await criarUsuario("Ana");
    const colega = await criarUsuario("Bruno");
    const estranho = await criarUsuario("Carla");
    const projeto = await criarProjeto(eu.id);
    await adicionarAoProjeto(projeto.id, colega.id, ProjectRole.EDITOR);
    const alheio = await criarProjeto(estranho.id);

    const base = { projectId: projeto.id };
    await criarTarefa(eu.id, { ...base, title: "1", priority: TaskPriority.ALTA, assigneeIds: [colega.id] });
    await criarTarefa(eu.id, { ...base, title: "2", priority: TaskPriority.BAIXA, assigneeIds: [colega.id] });
    await criarTarefa(eu.id, { ...base, title: "3", priority: TaskPriority.MEDIA, assigneeIds: [eu.id] });
    // Sem responsável: criarTarefa põe o criador quando ninguém é informado.
    const semNinguem = await criarTarefa(eu.id, { ...base, title: "4" });
    await definirResponsaveis(eu.id, semNinguem.id, []);
    await criarTarefa(eu.id, {
      ...base,
      title: "pronta",
      status: TaskStatus.CONCLUIDO,
      assigneeIds: [colega.id],
    });
    await criarTarefa(estranho.id, { projectId: alheio.id, title: "x", assigneeIds: [estranho.id] });

    const { cargaPorResponsavel } = await montarDashboard(eu.id, FUSO, { escopo: "MINHAS" });

    expect(cargaPorResponsavel.pessoas).toEqual([
      expect.objectContaining({ nome: "Bruno", ALTA: 1, MEDIA: 0, BAIXA: 1 }),
      expect.objectContaining({ nome: "Ana", ALTA: 0, MEDIA: 1, BAIXA: 0 }),
    ]);
    expect(cargaPorResponsavel.semResponsavel).toBe(1);
  });

  it("conclusões por dia, no fuso da pessoa, dentro do período", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);
    const base = { projectId: projeto.id, assigneeIds: [eu.id], status: TaskStatus.CONCLUIDO };
    await criarTarefa(eu.id, { ...base, title: "hoje" });
    const antiga = await criarTarefa(eu.id, { ...base, title: "antiga" });
    await prisma.task.update({ where: { id: antiga.id }, data: { completedAt: diasAtras(100) } });

    const { mapaDeEntregas } = await montarDashboard(eu.id, FUSO, ultimosDias(84));
    expect(mapaDeEntregas.dias).toEqual([{ dia: hojeNoFuso(FUSO), total: 1 }]);
    expect(mapaDeEntregas.inicio).toBe(daquiADias(FUSO, -83));
  });
});
