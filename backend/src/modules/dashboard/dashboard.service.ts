import { Difficulty, Prisma, TaskPriority, TaskStatus } from "@prisma/client";
import { projetosAtivosVisiveis } from "../../authorization/scopes.js";
import {
  daquiADias,
  dataPura,
  diaNoFuso,
  diasNoIntervalo,
  hojeNoFuso,
  inicioDoDiaNoFuso,
  somarDias,
} from "../../lib/datas.js";
import { prisma } from "../../lib/prisma.js";
import { reunioesAgendadas } from "../calendar/calendar.service.js";

/**
 * Dashboard.
 *
 * Todos os números vêm de agregações no banco: trazer as linhas e contar em
 * memória ficaria lento e, pior, exigiria repetir o filtro de permissão a cada
 * cálculo.
 *
 * O recorte de permissão é feito uma vez só, no começo, resolvendo os projetos
 * visíveis. Todas as consultas seguintes partem dessa lista — o que torna o
 * limite de acesso explícito, em vez de espalhado por seis consultas.
 */

export type Escopo = "MINHAS" | "TODAS";

export interface FiltrosDoDashboard {
  escopo?: Escopo;
  projectId?: string;
  /**
   * Período em AAAA-MM-DD, no fuso da pessoa, com os dois dias inclusos. Vêm
   * juntos ou não vêm: sem eles, vale todo o período.
   */
  de?: string;
  ate?: string;
}

/** Tamanho de cada barra do fluxo, conforme a duração do período. */
export type Granularidade = "dia" | "semana" | "mes";

const UNIDADE_SQL: Record<Granularidade, string> = {
  dia: "day",
  semana: "week",
  mes: "month",
};

/** Até um mês, barra por dia; até seis meses, por semana; acima, por mês. */
function granularidadeDe(dias: number): Granularidade {
  if (dias <= 31) return "dia";
  if (dias <= 183) return "semana";
  return "mes";
}

/** Status que representam trabalho ativo, usados na conta de atrasadas. */
const STATUS_ATIVOS: TaskStatus[] = [
  TaskStatus.A_FAZER,
  TaskStatus.EM_ANDAMENTO,
  TaskStatus.EM_REVISAO,
];

export async function montarDashboard(
  userId: string,
  timezone: string,
  filtros: FiltrosDoDashboard = {},
) {
  const escopo = filtros.escopo ?? "MINHAS";
  const periodo = filtros.de && filtros.ate ? { de: filtros.de, ate: filtros.ate } : null;
  const hoje = hojeNoFuso(timezone);

  // Um único ponto de recorte: se o usuário não enxerga o projeto, nenhum
  // número abaixo pode incluí-lo.
  const projetos = await prisma.project.findMany({
    where: {
      ...projetosAtivosVisiveis(userId),
      ...(filtros.projectId && { id: filtros.projectId }),
    },
    select: { id: true, name: true, isInbox: true },
  });

  const idsDeProjeto = projetos.map((p) => p.id);

  if (idsDeProjeto.length === 0) {
    return vazio(escopo, periodo, hoje);
  }

  const baseDeTarefas: Prisma.TaskWhereInput = {
    projectId: { in: idsDeProjeto },
    deletedAt: null,
    ...(escopo === "MINHAS" && { assignees: { some: { userId } } }),
  };

  // O período vira instantes [meia-noite do primeiro dia, meia-noite do dia
  // seguinte ao último), no fuso da pessoa — as colunas estão em UTC.
  const limites = periodo && {
    inicio: inicioDoDiaNoFuso(periodo.de, timezone),
    fim: inicioDoDiaNoFuso(somarDias(periodo.ate, 1), timezone),
  };

  // Os retratos (etapas, prioridade, progresso, carga) contam as tarefas
  // criadas no período, com a situação de agora. Os prazos não entram aqui:
  // uma tarefa atrasada continua atrasada, seja de quando for.
  const criadasNoPeriodo: Prisma.TaskWhereInput = limites
    ? { createdAt: { gte: limites.inicio, lt: limites.fim } }
    : {};
  const tarefasDoRecorte: Prisma.TaskWhereInput = { ...baseDeTarefas, ...criadasNoPeriodo };
  const criadaNoPeriodoSql = limites
    ? Prisma.sql`AND t."createdAt" >= ${limites.inicio} AND t."createdAt" < ${limites.fim}`
    : Prisma.empty;
  const concluidaNoPeriodoSql = limites
    ? Prisma.sql`AND t."completedAt" >= ${limites.inicio} AND t."completedAt" < ${limites.fim}`
    : Prisma.empty;

  // Fluxo e mapa precisam de um começo mesmo em "todo o período": o dia da
  // primeira tarefa do recorte.
  const janela = periodo ?? {
    de: (await primeiroDiaComTarefa(baseDeTarefas, timezone)) ?? hoje,
    ate: hoje,
  };
  const inicioDaJanela = inicioDoDiaNoFuso(janela.de, timezone);
  const fimDaJanela = inicioDoDiaNoFuso(somarDias(janela.ate, 1), timezone);
  const granularidade = granularidadeDe(diasNoIntervalo(janela.de, janela.ate));
  const unidade = UNIDADE_SQL[granularidade];
  const inicioDoMapa = inicioDoMapaDe(janela);

  // "Só as minhas" nas consultas em SQL: tarefas em que sou responsável.
  const soAsMinhas =
    escopo === "MINHAS"
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM task_assignees a
          WHERE a."taskId" = t.id AND a."userId" = ${userId}::uuid
        )`
      : Prisma.empty;

  const [
    porStatus,
    porPrioridade,
    atrasadas,
    proximosSeteDias,
    semTerminoDefinido,
    fluxo,
    progresso,
    reunioes,
    porDificuldade,
    projetosPorEtapa,
    [noPrazo],
    carga,
    semResponsavel,
    conclusoesPorDia,
  ] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where: tarefasDoRecorte,
      _count: { _all: true },
    }),

    prisma.task.groupBy({
      by: ["priority"],
      where: { ...tarefasDoRecorte, status: { not: TaskStatus.CONCLUIDO } },
      _count: { _all: true },
    }),

    prisma.task.count({
      where: {
        ...baseDeTarefas,
        status: { in: STATUS_ATIVOS },
        dueDate: { lt: dataPura(hoje) },
      },
    }),

    prisma.task.count({
      where: {
        ...baseDeTarefas,
        status: { in: STATUS_ATIVOS },
        dueDate: { gte: dataPura(hoje), lte: dataPura(daquiADias(timezone, 7)) },
      },
    }),

    prisma.task.count({
      where: {
        ...baseDeTarefas,
        status: { not: TaskStatus.CONCLUIDO },
        dueDate: null,
      },
    }),

    // Criadas e concluídas por dia, semana ou mês, em SQL: date_trunc é o que
    // o Prisma ainda não expressa em groupBy. Os baldes vêm do generate_series,
    // então período sem movimento aparece com zero em vez de sumir do gráfico.
    // As colunas são timestamp sem fuso, gravadas em UTC; o balde é contado no
    // fuso da pessoa (a semana começa na segunda, como no date_trunc).
    prisma.$queryRaw<Array<{ inicio: Date; criadas: bigint; concluidas: bigint }>>`
      WITH baldes AS (
        SELECT generate_series(
          date_trunc(${unidade}::text, ${janela.de}::date::timestamp),
          date_trunc(${unidade}::text, ${janela.ate}::date::timestamp),
          ${`1 ${unidade}`}::interval
        ) AS inicio
      ),
      movimento AS (
        SELECT
          CASE WHEN t."createdAt" >= ${inicioDaJanela} AND t."createdAt" < ${fimDaJanela}
            THEN date_trunc(${unidade}::text, t."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})
          END AS criada,
          CASE WHEN t."completedAt" >= ${inicioDaJanela} AND t."completedAt" < ${fimDaJanela}
            THEN date_trunc(${unidade}::text, t."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})
          END AS concluida
        FROM tasks t
        WHERE t."projectId" = ANY(${idsDeProjeto}::uuid[])
          AND t."deletedAt" IS NULL
          AND (
            (t."createdAt" >= ${inicioDaJanela} AND t."createdAt" < ${fimDaJanela})
            OR (t."completedAt" >= ${inicioDaJanela} AND t."completedAt" < ${fimDaJanela})
          )
          ${soAsMinhas}
      )
      SELECT
        b.inicio,
        (SELECT count(*) FROM movimento m WHERE m.criada = b.inicio) AS criadas,
        (SELECT count(*) FROM movimento m WHERE m.concluida = b.inicio) AS concluidas
      FROM baldes b
      ORDER BY 1
    `,

    prisma.task.groupBy({
      by: ["projectId", "status"],
      where: tarefasDoRecorte,
      _count: { _all: true },
    }),

    reunioesAgendadas(userId, 5),

    prisma.task.groupBy({
      by: ["difficulty"],
      where: { ...tarefasDoRecorte, status: { not: TaskStatus.CONCLUIDO } },
      _count: { _all: true },
    }),

    // A etapa é do próprio projeto; "só as minhas" vale para tarefas, não aqui.
    // No período, entram os projetos criados nele.
    prisma.project.groupBy({
      by: ["status"],
      where: {
        id: { in: idsDeProjeto },
        isInbox: false,
        ...(limites && { createdAt: { gte: limites.inicio, lt: limites.fim } }),
      },
      _count: { _all: true },
    }),

    // Concluídas no período e, das que tinham prazo, quantas saíram até o dia
    // do vencimento — o dia da conclusão no fuso da pessoa, não em UTC.
    prisma.$queryRaw<Array<{ concluidas: bigint; comPrazo: bigint; dentroDoPrazo: bigint }>>`
      SELECT
        count(*) AS concluidas,
        count(*) FILTER (WHERE t."dueDate" IS NOT NULL) AS "comPrazo",
        count(*) FILTER (
          WHERE t."dueDate" IS NOT NULL
            AND (t."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date <= t."dueDate"
        ) AS "dentroDoPrazo"
      FROM tasks t
      WHERE t."projectId" = ANY(${idsDeProjeto}::uuid[])
        AND t."deletedAt" IS NULL
        AND t."completedAt" IS NOT NULL
        ${concluidaNoPeriodoSql}
        ${soAsMinhas}
    `,

    // Carga do time: ignora o escopo de propósito — "só as minhas" mostraria
    // apenas a própria pessoa. Os projetos continuam sendo só os visíveis, e o
    // período vale como nos outros retratos: tarefas criadas nele.
    prisma.$queryRaw<
      Array<{ userId: string; nome: string; image: string | null; alta: bigint; media: bigint; baixa: bigint }>
    >`
      SELECT
        u.id AS "userId",
        u.name AS nome,
        u.image,
        count(*) FILTER (WHERE t.priority = 'ALTA') AS alta,
        count(*) FILTER (WHERE t.priority = 'MEDIA') AS media,
        count(*) FILTER (WHERE t.priority = 'BAIXA') AS baixa
      FROM tasks t
      JOIN task_assignees a ON a."taskId" = t.id
      JOIN users u ON u.id = a."userId"
      WHERE t."projectId" = ANY(${idsDeProjeto}::uuid[])
        AND t."deletedAt" IS NULL
        AND t.status <> 'CONCLUIDO'
        ${criadaNoPeriodoSql}
      GROUP BY u.id, u.name, u.image
      ORDER BY count(*) DESC, u.name
      LIMIT ${LIMITE_DA_CARGA}
    `,

    prisma.task.count({
      where: {
        projectId: { in: idsDeProjeto },
        deletedAt: null,
        status: { not: TaskStatus.CONCLUIDO },
        assignees: { none: {} },
        ...criadasNoPeriodo,
      },
    }),

    // O mapa cobre o fim da janela para trás, até 12 meses.
    prisma.$queryRaw<Array<{ dia: Date; total: bigint }>>`
      SELECT
        (t."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date AS dia,
        count(*) AS total
      FROM tasks t
      WHERE t."projectId" = ANY(${idsDeProjeto}::uuid[])
        AND t."deletedAt" IS NULL
        AND t."completedAt" IS NOT NULL
        AND t."completedAt" >= ${inicioDoDiaNoFuso(inicioDoMapa, timezone)}
        AND t."completedAt" < ${fimDaJanela}
        ${soAsMinhas}
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const nomePorProjeto = new Map(projetos.map((p) => [p.id, p]));

  return {
    filtros: {
      escopo,
      projectId: filtros.projectId ?? null,
      de: periodo?.de ?? null,
      ate: periodo?.ate ?? null,
    },

    /** Distribuição por etapa, na ordem em que o trabalho anda. */
    porStatus: ordemDeStatus.map((status) => ({
      status,
      total: porStatus.find((g) => g.status === status)?._count._all ?? 0,
    })),

    /** Só o que não está concluído: prioridade de tarefa pronta não informa nada. */
    porPrioridade: ordemDePrioridade.map((priority) => ({
      priority,
      total: porPrioridade.find((g) => g.priority === priority)?._count._all ?? 0,
    })),

    prazos: {
      atrasadas,
      proximosSeteDias,
      semTerminoDefinido,
    },

    /** Um balde por dia, semana ou mês do período, inclusive os sem movimento. */
    fluxo: {
      granularidade,
      baldes: fluxo.map((linha) => ({
        inicio: linha.inicio.toISOString().slice(0, 10),
        // count() do PostgreSQL volta como bigint, que não serializa em JSON.
        criadas: Number(linha.criadas),
        concluidas: Number(linha.concluidas),
      })),
    },

    progressoPorProjeto: montarProgresso(progresso, nomePorProjeto),

    etapasPorProjeto: montarEtapasPorProjeto(progresso, nomePorProjeto),

    /** Só o que não está concluído, como na prioridade. */
    porDificuldade: ordemDeDificuldade.map((difficulty) => ({
      difficulty,
      total:
        porDificuldade.find((g) =>
          difficulty === NAO_ESTIMADA ? g.difficulty === null : g.difficulty === difficulty,
        )?._count._all ?? 0,
    })),

    projetosPorEtapa: ordemDeStatus.map((status) => ({
      status,
      total: projetosPorEtapa.find((g) => g.status === status)?._count._all ?? 0,
    })),

    noPrazo: {
      concluidas: Number(noPrazo?.concluidas ?? 0),
      comPrazo: Number(noPrazo?.comPrazo ?? 0),
      dentroDoPrazo: Number(noPrazo?.dentroDoPrazo ?? 0),
    },

    cargaPorResponsavel: {
      pessoas: carga.map((linha) => ({
        userId: linha.userId,
        nome: linha.nome,
        image: linha.image,
        ALTA: Number(linha.alta),
        MEDIA: Number(linha.media),
        BAIXA: Number(linha.baixa),
      })),
      semResponsavel,
    },

    /**
     * Mapa de calor: o trecho do período que ele cobre (até 12 meses, contados
     * do fim) e os dias com conclusão nele; os sem nenhuma ficam de fora.
     */
    mapaDeEntregas: {
      inicio: inicioDoMapa,
      fim: janela.ate,
      dias: conclusoesPorDia.map((linha) => ({
        dia: linha.dia.toISOString().slice(0, 10),
        total: Number(linha.total),
      })),
    },

    proximasReunioes: reunioes.map((o) => ({
      eventId: o.evento.id,
      title: o.evento.title,
      inicio: o.inicio.toISOString(),
      participantes: o.evento.participants.length,
    })),
  };
}

const ordemDeStatus: TaskStatus[] = [
  TaskStatus.BACKLOG,
  TaskStatus.A_FAZER,
  TaskStatus.EM_ANDAMENTO,
  TaskStatus.EM_REVISAO,
  TaskStatus.EM_PAUSA,
  TaskStatus.CONCLUIDO,
];

const ordemDePrioridade: TaskPriority[] = [
  TaskPriority.ALTA,
  TaskPriority.MEDIA,
  TaskPriority.BAIXA,
];

const NAO_ESTIMADA = "NAO_ESTIMADA" as const;

const ordemDeDificuldade: Array<Difficulty | typeof NAO_ESTIMADA> = [
  Difficulty.ROTINEIRO,
  Difficulty.COMPLEXO,
  Difficulty.CRITICO,
  NAO_ESTIMADA,
];

/**
 * Projetos no radar de etapas. Os polígonos se sobrepõem, então toda cor
 * precisa se distinguir de todas as outras — e só três tons passam nessa
 * checagem de daltonismo nos dois temas. Com mais, vira um emaranhado.
 */
const LIMITE_DO_RADAR = 3;
/** Pessoas no gráfico de carga. */
const LIMITE_DA_CARGA = 8;
/** O mapa de calor cobre no máximo 12 meses. */
const DIAS_MAXIMOS_DO_MAPA = 365;

/** Início do mapa: o da janela, desde que não passe de 12 meses antes do fim. */
function inicioDoMapaDe(janela: { de: string; ate: string }): string {
  const limite = somarDias(janela.ate, -(DIAS_MAXIMOS_DO_MAPA - 1));
  // AAAA-MM-DD compara como texto na mesma ordem que como data.
  return janela.de > limite ? janela.de : limite;
}

/** O dia, no fuso da pessoa, em que a primeira tarefa do recorte foi criada. */
async function primeiroDiaComTarefa(
  where: Prisma.TaskWhereInput,
  timezone: string,
): Promise<string | null> {
  const { _min } = await prisma.task.aggregate({ where, _min: { createdAt: true } });
  return _min.createdAt ? diaNoFuso(_min.createdAt, timezone) : null;
}

/**
 * Tarefas de cada projeto em cada etapa, para o radar: os projetos com mais
 * tarefas, cada um com as seis etapas (zeradas inclusive — o polígono precisa
 * de todos os eixos).
 */
function montarEtapasPorProjeto(
  grupos: Array<{ projectId: string; status: TaskStatus; _count: { _all: number } }>,
  projetos: Map<string, { id: string; name: string; isInbox: boolean }>,
) {
  const porProjeto = new Map<string, Record<TaskStatus, number>>();

  for (const grupo of grupos) {
    const contagem =
      porProjeto.get(grupo.projectId) ??
      (Object.fromEntries(ordemDeStatus.map((s) => [s, 0])) as Record<TaskStatus, number>);
    contagem[grupo.status] += grupo._count._all;
    porProjeto.set(grupo.projectId, contagem);
  }

  const total = (contagem: Record<TaskStatus, number>) =>
    Object.values(contagem).reduce((soma, n) => soma + n, 0);

  return [...porProjeto.entries()]
    .map(([projectId, porStatus]) => ({
      projectId,
      nome: projetos.get(projectId)?.name ?? "",
      isInbox: projetos.get(projectId)?.isInbox ?? false,
      total: total(porStatus),
      porStatus,
    }))
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, LIMITE_DO_RADAR);
}

function montarProgresso(
  grupos: Array<{ projectId: string; status: TaskStatus; _count: { _all: number } }>,
  projetos: Map<string, { id: string; name: string; isInbox: boolean }>,
) {
  const acumulado = new Map<string, { total: number; concluidas: number }>();

  for (const grupo of grupos) {
    const atual = acumulado.get(grupo.projectId) ?? { total: 0, concluidas: 0 };
    atual.total += grupo._count._all;
    if (grupo.status === TaskStatus.CONCLUIDO) {
      atual.concluidas += grupo._count._all;
    }
    acumulado.set(grupo.projectId, atual);
  }

  return [...acumulado.entries()]
    .map(([projectId, { total, concluidas }]) => ({
      projectId,
      nome: projetos.get(projectId)?.name ?? "",
      isInbox: projetos.get(projectId)?.isInbox ?? false,
      total,
      concluidas,
      percentual: total === 0 ? 0 : Math.round((concluidas / total) * 100),
    }))
    // Projeto sem tarefa não diz nada sobre progresso.
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

/** Estado inicial de quem ainda não tem projeto algum. */
function vazio(escopo: Escopo, periodo: { de: string; ate: string } | null, hoje: string) {
  const janela = periodo ?? { de: hoje, ate: hoje };
  return {
    filtros: { escopo, projectId: null, de: periodo?.de ?? null, ate: periodo?.ate ?? null },
    porStatus: ordemDeStatus.map((status) => ({ status, total: 0 })),
    porPrioridade: ordemDePrioridade.map((priority) => ({ priority, total: 0 })),
    prazos: { atrasadas: 0, proximosSeteDias: 0, semTerminoDefinido: 0 },
    fluxo: {
      granularidade: granularidadeDe(diasNoIntervalo(janela.de, janela.ate)),
      baldes: [],
    },
    progressoPorProjeto: [],
    proximasReunioes: [],
    etapasPorProjeto: [],
    porDificuldade: ordemDeDificuldade.map((difficulty) => ({ difficulty, total: 0 })),
    projetosPorEtapa: ordemDeStatus.map((status) => ({ status, total: 0 })),
    noPrazo: { concluidas: 0, comPrazo: 0, dentroDoPrazo: 0 },
    cargaPorResponsavel: { pessoas: [], semResponsavel: 0 },
    mapaDeEntregas: { inicio: inicioDoMapaDe(janela), fim: janela.ate, dias: [] },
  };
}

/** Projetos que podem ser escolhidos no filtro do Dashboard. */
export async function projetosParaFiltro(userId: string) {
  return prisma.project.findMany({
    where: projetosAtivosVisiveis(userId),
    select: { id: true, name: true, isInbox: true },
    orderBy: [{ isInbox: "desc" }, { name: "asc" }],
  });
}
