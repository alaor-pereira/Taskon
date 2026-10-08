import {
  EventKind,
  EventExceptionKind,
  ParticipantResponse,
  Prisma,
} from "@prisma/client";
import { resolveProjectContext } from "../../authorization/authorize.js";
import { registrarAtividade } from "../../lib/activity-log.js";
import { hojeNoFuso } from "../../lib/datas.js";
import {
  naoEncontrado,
  regraDeNegocio,
  semPermissao,
} from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { definirMeet } from "../integrations/google/meet.js";
import { marcarParaSincronizar } from "../integrations/google/sincronizacao.js";
import { nomeDoAutor, notificarVarios } from "../notifications/notifications.service.js";
import {
  encerrarAntesDe,
  expandirOcorrencias,
  paraTextoRRule,
  type Ocorrencia,
  type Recorrencia,
} from "./recurrence.js";
import { deHorarioDeParede, fusoValido } from "./timezone.js";

/**
 * Agenda: atividades e reuniões.
 *
 * Atividade é pessoal — serve para o usuário se organizar e pode apontar para
 * uma tarefa ou projeto. Reunião tem participantes que respondem.
 *
 * **Atividades não são tarefas de projeto** e nunca aparecem nas listas de
 * tarefas: são compromissos que ajudam a cumprir uma tarefa, não o trabalho em si.
 */

const selecaoDoEvento = {
  id: true,
  kind: true,
  ownerId: true,
  title: true,
  description: true,
  locationOrLink: true,
  meetLink: true,
  startsAt: true,
  endsAt: true,
  allDay: true,
  timezone: true,
  rrule: true,
  taskId: true,
  projectId: true,
  createdAt: true,
  owner: { select: { id: true, name: true, image: true } },
  participants: {
    select: {
      response: true,
      user: { select: { id: true, name: true, image: true } },
    },
  },
  task: { select: { id: true, title: true, projectId: true } },
  project: { select: { id: true, name: true } },
  exceptions: {
    select: { id: true, originalStart: true, kind: true, overrides: true },
  },
} as const;

type EventoCarregado = Prisma.CalendarEventGetPayload<{
  select: typeof selecaoDoEvento;
}>;

/** Vê o evento quem o criou ou quem foi convidado. Atividade não tem convidados. */
function eventosVisiveis(userId: string): Prisma.CalendarEventWhereInput {
  return {
    OR: [{ ownerId: userId }, { participants: { some: { userId } } }],
  };
}

// --- Leitura ---------------------------------------------------------------

export interface OcorrenciaDeAgenda extends Ocorrencia {
  evento: Omit<EventoCarregado, "exceptions">;
}

/**
 * Expande os eventos visíveis dentro de uma janela.
 *
 * Só os eventos que podem alcançar a janela são lidos: os pontuais precisam
 * cair dentro dela, e os recorrentes só precisam ter começado antes do fim.
 */
async function ocorrenciasNaJanela(
  userId: string,
  janela: { inicio: Date; fim: Date },
  kind?: EventKind,
): Promise<OcorrenciaDeAgenda[]> {
  const eventos = await prisma.calendarEvent.findMany({
    where: {
      AND: [
        eventosVisiveis(userId),
        ...(kind ? [{ kind }] : []),
        {
          OR: [
            { rrule: null, startsAt: { lte: janela.fim }, endsAt: { gte: janela.inicio } },
            { rrule: { not: null }, startsAt: { lte: janela.fim } },
          ],
        },
      ],
    },
    select: selecaoDoEvento,
  });

  const resultado: OcorrenciaDeAgenda[] = [];

  for (const evento of eventos) {
    const { exceptions, ...semExcecoes } = evento;

    const ocorrencias = expandirOcorrencias(
      {
        startsAt: evento.startsAt,
        endsAt: evento.endsAt,
        timezone: evento.timezone,
        rrule: evento.rrule,
      },
      janela,
      exceptions.map((e) => ({
        originalStart: e.originalStart,
        kind: e.kind,
        overrides: e.overrides as { startsAt?: string; endsAt?: string } | null,
      })),
    );

    for (const ocorrencia of ocorrencias) {
      resultado.push({ ...ocorrencia, evento: semExcecoes });
    }
  }

  return resultado.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

/** Limites do dia atual do usuário, como instantes. */
function limitesDoDia(timezone: string) {
  const [ano, mes, dia] = hojeNoFuso(timezone).split("-").map(Number);
  const inicio = deHorarioDeParede(
    { ano: ano!, mes: mes!, dia: dia!, hora: 0, minuto: 0 },
    timezone,
  );
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { inicio, fim };
}

export async function atividadesDeHoje(
  userId: string,
  timezone: string,
  limite = 15,
) {
  const janela = limitesDoDia(timezone);
  const ocorrencias = await ocorrenciasNaJanela(userId, janela, EventKind.ATIVIDADE);
  return ocorrencias.slice(0, limite);
}

/**
 * Próximas atividades, a partir de amanhã.
 *
 * As de hoje ficam de fora de propósito: elas já têm seção própria, e repeti-las
 * aqui só ocuparia espaço.
 */
export async function proximasAtividades(
  userId: string,
  timezone: string,
  limite = 15,
) {
  const hoje = limitesDoDia(timezone);
  const inicio = new Date(hoje.fim.getTime() + 1);
  const fim = new Date(inicio.getTime() + 180 * 24 * 60 * 60 * 1000);

  const ocorrencias = await ocorrenciasNaJanela(userId, { inicio, fim }, EventKind.ATIVIDADE);
  return ocorrencias.slice(0, limite);
}

export async function reunioesAgendadas(userId: string, limite = 15) {
  const inicio = new Date();
  const fim = new Date(inicio.getTime() + 180 * 24 * 60 * 60 * 1000);

  const ocorrencias = await ocorrenciasNaJanela(userId, { inicio, fim }, EventKind.REUNIAO);
  return ocorrencias.slice(0, limite);
}

/** Agenda completa de um intervalo, para a visualização de calendário. */
export async function agendaDoPeriodo(
  userId: string,
  inicio: Date,
  fim: Date,
  kind?: EventKind,
) {
  return ocorrenciasNaJanela(userId, { inicio, fim }, kind);
}

export async function obterEvento(userId: string, eventId: string) {
  const evento = await prisma.calendarEvent.findFirst({
    where: { AND: [{ id: eventId }, eventosVisiveis(userId)] },
    select: selecaoDoEvento,
  });
  if (!evento) throw naoEncontrado("Evento");

  return { ...evento, vinculo: await vinculoVisivel(userId, evento) };
}

/**
 * O vínculo com tarefa ou projeto só é exibido a quem ainda acessa o projeto.
 *
 * Perder o acesso ao projeto não apaga o evento — ele continua na agenda de
 * quem o criou —, mas o nome do projeto deixa de aparecer.
 */
async function vinculoVisivel(
  userId: string,
  evento: Pick<EventoCarregado, "projectId" | "task" | "project">,
) {
  const projectId = evento.projectId ?? evento.task?.projectId ?? null;
  if (!projectId) return null;

  const ctx = await resolveProjectContext(userId, projectId);
  if (!ctx) return null;

  return { projeto: evento.project, tarefa: evento.task };
}

// --- Escrita ---------------------------------------------------------------

export interface NovoEvento {
  kind: EventKind;
  title: string;
  description?: string | null;
  locationOrLink?: string | null;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  timezone: string;
  recorrencia?: Recorrencia | null;
  taskId?: string | null;
  projectId?: string | null;
  participantIds?: string[];
  /** Gerar link do Google Meet (só organizador com o Google Agenda conectado). */
  meet?: boolean;
}

export async function criarEvento(userId: string, dados: NovoEvento) {
  const inicio = new Date(dados.startsAt);
  const fim = new Date(dados.endsAt);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    throw regraDeNegocio("Data ou hora inválida.");
  }
  if (fim < inicio) {
    throw regraDeNegocio("O término não pode ser anterior ao início.");
  }
  if (!fusoValido(dados.timezone)) {
    throw regraDeNegocio("Fuso horário desconhecido.");
  }

  await validarVinculo(userId, dados.taskId, dados.projectId);

  const participantes =
    dados.kind === EventKind.REUNIAO
      ? [...new Set(dados.participantIds ?? [])].filter((id) => id !== userId)
      : [];

  if (dados.kind === EventKind.ATIVIDADE && dados.participantIds?.length) {
    // Atividade é pessoal: convidar alguém aqui seria criar uma reunião com
    // outro nome, e a distinção entre as duas coisas é do prompt.
    throw regraDeNegocio("Atividades são pessoais e não têm participantes.");
  }

  await garantirConvidaveis(userId, participantes);

  const rrule = dados.recorrencia ? paraTextoRRule(dados.recorrencia) : null;

  const evento = await prisma.$transaction(async (tx) => {
    const criado = await tx.calendarEvent.create({
      data: {
        kind: dados.kind,
        ownerId: userId,
        title: dados.title,
        description: dados.description ?? null,
        locationOrLink: dados.locationOrLink ?? null,
        startsAt: inicio,
        endsAt: fim,
        allDay: dados.allDay ?? false,
        timezone: dados.timezone,
        rrule,
        taskId: dados.taskId ?? null,
        projectId: dados.projectId ?? null,
        // O organizador entra como participante já aceito.
        ...(dados.kind === EventKind.REUNIAO && {
          participants: {
            create: [
              { userId, response: ParticipantResponse.ACEITO },
              ...participantes.map((id) => ({ userId: id })),
            ],
          },
        }),
      },
      select: selecaoDoEvento,
    });

    await registrarAtividade(
      {
        entityType: "EVENTO",
        entityId: criado.id,
        projectId: dados.projectId ?? null,
        actorId: userId,
        action: "CRIADO",
        after: { title: criado.title, kind: criado.kind },
      },
      tx,
    );

    return criado;
  });

  await notificarVarios(
    participantes,
    {
      type: "REUNIAO_AGENDADA",
      payload: {
        eventId: evento.id,
        title: evento.title,
        startsAt: evento.startsAt.toISOString(),
        autorNome: await nomeDoAutor(userId),
      },
    },
    userId,
  );

  // O Meet nasce antes da sincronização, que então leva o link às cópias.
  const aviso = dados.meet ? await definirMeet(userId, evento.id, true) : null;
  await marcarParaSincronizar(evento.id);

  if (!dados.meet) return evento;
  const comMeet = await prisma.calendarEvent.findUniqueOrThrow({
    where: { id: evento.id },
    select: selecaoDoEvento,
  });
  return { ...comMeet, aviso };
}

async function validarVinculo(
  userId: string,
  taskId?: string | null,
  projectId?: string | null,
) {
  if (taskId) {
    const tarefa = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { projectId: true },
    });
    if (!tarefa) throw naoEncontrado("Tarefa");
    // Sem acesso ao projeto, ligar a agenda a ele revelaria que a tarefa existe.
    if (!(await resolveProjectContext(userId, tarefa.projectId))) {
      throw naoEncontrado("Tarefa");
    }
  }

  if (projectId && !(await resolveProjectContext(userId, projectId))) {
    throw naoEncontrado("Projeto");
  }
}

/** Escopo da alteração numa série recorrente. */
export type EscopoDaAlteracao = "SO_ESTA" | "ESTA_E_SEGUINTES" | "TODAS";

export interface EdicaoDeEvento {
  title?: string;
  description?: string | null;
  locationOrLink?: string | null;
  startsAt?: string;
  endsAt?: string;
  recorrencia?: Recorrencia | null;
  /** Ocorrência afetada. Obrigatória fora de "TODAS". */
  ocorrencia?: string;
  escopo?: EscopoDaAlteracao;
  /** Liga ou desliga o Google Meet da reunião. Omitido: não mexe. */
  meet?: boolean;
}

async function carregarParaEdicao(userId: string, eventId: string) {
  const evento = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: selecaoDoEvento,
  });
  if (!evento) throw naoEncontrado("Evento");

  // Participante vê e responde, mas quem edita é o organizador.
  if (evento.ownerId !== userId) {
    const participa = evento.participants.some((p) => p.user.id === userId);
    if (!participa) throw naoEncontrado("Evento");
    throw semPermissao("editar um evento organizado por outra pessoa");
  }

  return evento;
}

export async function atualizarEvento(
  userId: string,
  eventId: string,
  dados: EdicaoDeEvento,
) {
  const evento = await carregarParaEdicao(userId, eventId);
  const resultado = await aplicarAlteracao(userId, evento, dados);

  // "Esta e as seguintes" cria uma série nova: o Meet e o Google valem para
  // ela e também para a original, que foi encurtada.
  const alvo = resultado && "id" in resultado && resultado.id ? resultado.id : evento.id;
  const aviso = dados.meet !== undefined ? await definirMeet(userId, alvo, dados.meet) : null;

  await avisarAlteracaoDeReuniao(userId, evento, dados);
  for (const id of new Set([evento.id, alvo])) await marcarParaSincronizar(id);

  if (dados.meet === undefined) return resultado;
  return { ...(await obterEvento(userId, alvo)), aviso };
}

/**
 * Avisa os participantes quando a reunião muda no que importa para quem vai:
 * quando (início, fim, repetição), onde e o nome. Mudar só a descrição não
 * gera aviso — o formulário reenvia todos os campos, então cada um é
 * comparado com o que já estava valendo.
 */
async function avisarAlteracaoDeReuniao(
  userId: string,
  evento: EventoCarregado,
  dados: EdicaoDeEvento,
) {
  if (evento.kind !== EventKind.REUNIAO) return;

  const escopo = evento.rrule ? (dados.escopo ?? "TODAS") : "TODAS";
  const ocorrencia =
    escopo !== "TODAS" && dados.ocorrencia ? new Date(dados.ocorrencia) : null;
  const atual = ocorrencia
    ? horarioDaOcorrencia(evento, ocorrencia)
    : { inicio: evento.startsAt, fim: evento.endsAt };

  const mudouHorario =
    (dados.startsAt !== undefined &&
      new Date(dados.startsAt).getTime() !== atual.inicio.getTime()) ||
    (dados.endsAt !== undefined &&
      new Date(dados.endsAt).getTime() !== atual.fim.getTime());
  const mudouRepeticao =
    escopo === "TODAS" &&
    dados.recorrencia !== undefined &&
    (dados.recorrencia ? paraTextoRRule(dados.recorrencia) : null) !== evento.rrule;
  const mudouTitulo = dados.title !== undefined && dados.title !== evento.title;
  const mudouLocal =
    dados.locationOrLink !== undefined &&
    (dados.locationOrLink ?? null) !== evento.locationOrLink;
  // Ganhar ou perder o Meet muda onde a reunião acontece.
  const mudouMeet = dados.meet !== undefined && dados.meet !== Boolean(evento.meetLink);

  if (!mudouHorario && !mudouRepeticao && !mudouTitulo && !mudouLocal && !mudouMeet) return;

  await notificarVarios(
    evento.participants.map((p) => p.user.id),
    {
      type: "REUNIAO_ALTERADA",
      payload: {
        eventId: evento.id,
        title: dados.title ?? evento.title,
        startsAt: (dados.startsAt ? new Date(dados.startsAt) : atual.inicio).toISOString(),
        escopo,
        recorrente: Boolean(evento.rrule),
        ocorrencia: ocorrencia?.toISOString() ?? null,
        autorNome: await nomeDoAutor(userId),
      },
    },
    userId,
  );
}

/** Horário em vigor de uma ocorrência: o remarcado, se houver, ou o da série. */
function horarioDaOcorrencia(evento: EventoCarregado, ocorrencia: Date) {
  const duracao = evento.endsAt.getTime() - evento.startsAt.getTime();
  const excecao = evento.exceptions.find(
    (e) => e.originalStart.getTime() === ocorrencia.getTime(),
  );
  const remarcada = excecao?.overrides as { startsAt?: string; endsAt?: string } | null;
  const inicio = remarcada?.startsAt ? new Date(remarcada.startsAt) : ocorrencia;
  const fim = remarcada?.endsAt
    ? new Date(remarcada.endsAt)
    : new Date(inicio.getTime() + duracao);
  return { inicio, fim };
}

async function aplicarAlteracao(
  userId: string,
  evento: EventoCarregado,
  dados: EdicaoDeEvento,
) {
  const escopo = dados.escopo ?? "TODAS";

  if (!evento.rrule || escopo === "TODAS") {
    return atualizarSerieInteira(userId, evento, dados);
  }

  if (!dados.ocorrencia) {
    throw regraDeNegocio(
      "Informe qual ocorrência está sendo alterada.",
      { escopo },
    );
  }
  const ocorrencia = new Date(dados.ocorrencia);

  return escopo === "SO_ESTA"
    ? alterarUmaOcorrencia(userId, evento, ocorrencia, dados)
    : dividirSerie(userId, evento, ocorrencia, dados);
}

async function atualizarSerieInteira(
  userId: string,
  evento: EventoCarregado,
  dados: EdicaoDeEvento,
) {
  const rrule =
    dados.recorrencia === undefined
      ? evento.rrule
      : dados.recorrencia
        ? paraTextoRRule(dados.recorrencia)
        : null;

  return prisma.$transaction(async (tx) => {
    // Mudar a regra invalida as exceções: elas apontam para ocorrências que
    // podem não existir mais na nova série.
    if (dados.recorrencia !== undefined || dados.startsAt) {
      await tx.eventException.deleteMany({ where: { eventId: evento.id } });
    }

    const atualizado = await tx.calendarEvent.update({
      where: { id: evento.id },
      data: {
        ...(dados.title !== undefined && { title: dados.title }),
        ...(dados.description !== undefined && { description: dados.description }),
        ...(dados.locationOrLink !== undefined && {
          locationOrLink: dados.locationOrLink,
        }),
        ...(dados.startsAt && { startsAt: new Date(dados.startsAt) }),
        ...(dados.endsAt && { endsAt: new Date(dados.endsAt) }),
        rrule,
      },
      select: selecaoDoEvento,
    });

    await registrarAtividade(
      {
        entityType: "EVENTO",
        entityId: evento.id,
        projectId: evento.projectId,
        actorId: userId,
        action: "ATUALIZADO",
        after: { escopo: "TODAS" },
      },
      tx,
    );

    return atualizado;
  });
}

/** "Só esta": grava uma exceção, sem mexer na série. */
async function alterarUmaOcorrencia(
  userId: string,
  evento: EventoCarregado,
  ocorrencia: Date,
  dados: EdicaoDeEvento,
) {
  const overrides: Record<string, string> = {};
  if (dados.startsAt) overrides.startsAt = dados.startsAt;
  if (dados.endsAt) overrides.endsAt = dados.endsAt;
  if (dados.title) overrides.title = dados.title;

  await prisma.eventException.upsert({
    where: {
      eventId_originalStart: { eventId: evento.id, originalStart: ocorrencia },
    },
    create: {
      eventId: evento.id,
      originalStart: ocorrencia,
      kind: EventExceptionKind.MODIFICADA,
      overrides,
    },
    update: { kind: EventExceptionKind.MODIFICADA, overrides },
  });

  return obterEvento(userId, evento.id);
}

/**
 * "Esta e as seguintes": encerra a série original na véspera e cria outra a
 * partir desta ocorrência, com os dados alterados.
 */
async function dividirSerie(
  userId: string,
  evento: EventoCarregado,
  ocorrencia: Date,
  dados: EdicaoDeEvento,
) {
  if (!evento.rrule) throw regraDeNegocio("Este evento não se repete.");

  const duracao = evento.endsAt.getTime() - evento.startsAt.getTime();
  const novoInicio = dados.startsAt ? new Date(dados.startsAt) : ocorrencia;
  const novoFim = dados.endsAt
    ? new Date(dados.endsAt)
    : new Date(novoInicio.getTime() + duracao);

  const novaRegra =
    dados.recorrencia === undefined
      ? evento.rrule
      : dados.recorrencia
        ? paraTextoRRule(dados.recorrencia)
        : null;

  return prisma.$transaction(async (tx) => {
    await tx.calendarEvent.update({
      where: { id: evento.id },
      data: {
        rrule: encerrarAntesDe(evento.rrule!, ocorrencia, evento.timezone),
      },
    });

    // Exceções posteriores ao corte pertencem à nova série, não à antiga.
    await tx.eventException.deleteMany({
      where: { eventId: evento.id, originalStart: { gte: ocorrencia } },
    });

    const nova = await tx.calendarEvent.create({
      data: {
        kind: evento.kind,
        ownerId: evento.ownerId,
        title: dados.title ?? evento.title,
        description:
          dados.description !== undefined ? dados.description : evento.description,
        locationOrLink:
          dados.locationOrLink !== undefined
            ? dados.locationOrLink
            : evento.locationOrLink,
        // A sala do Meet é a mesma: continua válida para as próximas ocorrências.
        meetLink: evento.meetLink,
        startsAt: novoInicio,
        endsAt: novoFim,
        allDay: evento.allDay,
        timezone: evento.timezone,
        rrule: novaRegra,
        taskId: evento.taskId,
        projectId: evento.projectId,
        ...(evento.kind === EventKind.REUNIAO && {
          // A resposta de participação vale por série: a nova série herda o
          // que já havia sido respondido.
          participants: {
            create: evento.participants.map((p) => ({
              userId: p.user.id,
              response: p.response,
            })),
          },
        }),
      },
      select: selecaoDoEvento,
    });

    await registrarAtividade(
      {
        entityType: "EVENTO",
        entityId: evento.id,
        projectId: evento.projectId,
        actorId: userId,
        action: "ATUALIZADO",
        after: { escopo: "ESTA_E_SEGUINTES", novaSerie: nova.id },
      },
      tx,
    );

    return nova;
  });
}

export async function excluirEvento(
  userId: string,
  eventId: string,
  opcoes: { escopo?: EscopoDaAlteracao; ocorrencia?: string } = {},
) {
  const evento = await carregarParaEdicao(userId, eventId);

  // A série inteira some: as cópias no Google precisam ser marcadas para
  // remoção antes, enquanto ainda se sabe de quem elas são.
  const apagaTudo = !evento.rrule || (opcoes.escopo ?? "TODAS") === "TODAS";
  if (apagaTudo) await marcarParaSincronizar(eventId, { excluido: true });

  const resultado = await aplicarExclusao(evento, opcoes);
  if (!apagaTudo) await marcarParaSincronizar(eventId);

  // Os participantes vêm do evento já carregado: depois de apagado, não
  // haveria mais de onde lê-los.
  if (evento.kind === EventKind.REUNIAO) {
    const escopo = evento.rrule ? (opcoes.escopo ?? "TODAS") : "TODAS";
    await notificarVarios(
      evento.participants.map((p) => p.user.id),
      {
        type: "REUNIAO_CANCELADA",
        payload: {
          eventId: evento.id,
          title: evento.title,
          escopo,
          recorrente: Boolean(evento.rrule),
          ocorrencia: escopo !== "TODAS" ? (opcoes.ocorrencia ?? null) : null,
          autorNome: await nomeDoAutor(userId),
        },
      },
      userId,
    );
  }

  return resultado;
}

async function aplicarExclusao(
  evento: EventoCarregado,
  opcoes: { escopo?: EscopoDaAlteracao; ocorrencia?: string },
) {
  const eventId = evento.id;
  const escopo = opcoes.escopo ?? "TODAS";

  // A agenda não tem Lixeira: o prompt só prevê restauração de projetos e
  // tarefas, então a exclusão aqui é definitiva.
  if (!evento.rrule || escopo === "TODAS") {
    await prisma.calendarEvent.delete({ where: { id: eventId } });
    return { removido: "SERIE" as const };
  }

  if (!opcoes.ocorrencia) {
    throw regraDeNegocio("Informe qual ocorrência está sendo excluída.");
  }
  const ocorrencia = new Date(opcoes.ocorrencia);

  if (escopo === "SO_ESTA") {
    await prisma.eventException.upsert({
      where: {
        eventId_originalStart: { eventId, originalStart: ocorrencia },
      },
      create: {
        eventId,
        originalStart: ocorrencia,
        kind: EventExceptionKind.CANCELADA,
      },
      update: { kind: EventExceptionKind.CANCELADA, overrides: Prisma.DbNull },
    });
    return { removido: "OCORRENCIA" as const };
  }

  await prisma.$transaction(async (tx) => {
    await tx.calendarEvent.update({
      where: { id: eventId },
      data: { rrule: encerrarAntesDe(evento.rrule!, ocorrencia, evento.timezone) },
    });
    await tx.eventException.deleteMany({
      where: { eventId, originalStart: { gte: ocorrencia } },
    });
  });

  return { removido: "DAQUI_EM_DIANTE" as const };
}

// --- Participação ----------------------------------------------------------

/** A resposta vale para a série inteira, e não por ocorrência. */
export async function responderReuniao(
  userId: string,
  eventId: string,
  resposta: ParticipantResponse,
) {
  const participante = await prisma.eventParticipant.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (!participante) throw naoEncontrado("Convite de reunião");

  const atualizado = await prisma.eventParticipant.update({
    where: { eventId_userId: { eventId, userId } },
    data: { response: resposta },
    select: {
      response: true,
      user: { select: { id: true, name: true } },
    },
  });
  // Recusar tira a reunião do Google de quem recusou; aceitar a devolve.
  await marcarParaSincronizar(eventId);
  return atualizado;
}

/** Quem pode ser chamado para uma reunião: quem divide alguma equipe com o organizador. */
const filtroDeConvidaveis = (userId: string) => ({
  id: { not: userId },
  anonymizedAt: null,
  teamMemberships: {
    some: { team: { members: { some: { userId } } } },
  },
});

/**
 * A lista da tela só mostra quem pode ser convidado, mas os ids chegam do
 * cliente: sem esta conferência, qualquer UUID viraria participante, receberia
 * o aviso e passaria a ver os demais convidados.
 */
async function garantirConvidaveis(userId: string, ids: string[]) {
  if (ids.length === 0) return;
  const validos = await prisma.user.count({
    where: { ...filtroDeConvidaveis(userId), id: { in: ids, not: userId } },
  });
  if (validos !== ids.length) {
    throw regraDeNegocio("Só é possível chamar para a reunião pessoas das suas equipes.");
  }
}

export async function convidaveis(userId: string) {
  return prisma.user.findMany({
    where: filtroDeConvidaveis(userId),
    select: { id: true, name: true, image: true },
    orderBy: { name: "asc" },
    take: 100,
  });
}
