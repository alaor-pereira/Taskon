import rrule, { type Options } from "rrule";
import { dadosInvalidos } from "../../lib/errors.js";
import {
  deDataFlutuante,
  deHorarioDeParede,
  paraDataFlutuante,
  paraHorarioDeParede,
} from "./timezone.js";

/**
 * O pacote `rrule` (2.8.1) é CommonJS e não declara `exports`, então o Node
 * não enxerga seus exports nomeados a partir de um módulo ESM: `import
 * { RRule } from "rrule"` derruba o servidor na inicialização. Importar o
 * default e desestruturar funciona nos dois mundos.
 *
 * O Vitest faz essa interoperabilidade sozinho, e foi por isso que os testes
 * passaram enquanto a aplicação real não subia.
 */
const { RRule } = rrule;

/**
 * Recorrência de eventos.
 *
 * A regra é guardada no formato iCalendar (RRULE) e as ocorrências são
 * calculadas sob demanda: gerar uma linha por dia encheria o banco e tornaria
 * impossível alterar uma série sem reescrever tudo.
 *
 * Este módulo é puro — recebe dados e devolve datas, sem tocar no banco. É o
 * ponto onde a aritmética de calendário e fuso horário é testada.
 */

export type Frequencia = "DIARIA" | "SEMANAL" | "MENSAL" | "ANUAL";

export type Termino =
  | { tipo: "NUNCA" }
  | { tipo: "ATE"; data: string } // AAAA-MM-DD
  | { tipo: "APOS"; ocorrencias: number };

export interface Recorrencia {
  frequencia: Frequencia;
  /** A cada N períodos. Padrão 1. */
  intervalo?: number;
  /** Só para SEMANAL: 0 = domingo … 6 = sábado. */
  diasDaSemana?: number[];
  termino?: Termino;
}

const FREQ_RRULE: Record<Frequencia, number> = {
  DIARIA: RRule.DAILY,
  SEMANAL: RRule.WEEKLY,
  MENSAL: RRule.MONTHLY,
  ANUAL: RRule.YEARLY,
};

/** Siglas iCalendar na ordem da biblioteca: 0 = segunda. */
const SIGLAS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;

// --- Serialização ----------------------------------------------------------

/** Converte a recorrência escolhida na interface em texto RRULE. */
export function paraTextoRRule(recorrencia: Recorrencia): string {
  const partes: string[] = [`FREQ=${frequenciaIcal(recorrencia.frequencia)}`];

  const intervalo = recorrencia.intervalo ?? 1;
  if (intervalo < 1 || intervalo > 366) {
    throw dadosInvalidos("O intervalo da repetição precisa estar entre 1 e 366.");
  }
  if (intervalo > 1) partes.push(`INTERVAL=${intervalo}`);

  if (recorrencia.frequencia === "SEMANAL" && recorrencia.diasDaSemana?.length) {
    const dias = [...new Set(recorrencia.diasDaSemana)].sort();
    if (dias.some((d) => d < 0 || d > 6)) {
      throw dadosInvalidos("Dia da semana inválido.");
    }
    const siglas = dias.map((d) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][d]);
    partes.push(`BYDAY=${siglas.join(",")}`);
  }

  const termino = recorrencia.termino ?? { tipo: "NUNCA" };
  if (termino.tipo === "APOS") {
    if (termino.ocorrencias < 1 || termino.ocorrencias > 1000) {
      throw dadosInvalidos("O número de repetições precisa estar entre 1 e 1000.");
    }
    partes.push(`COUNT=${termino.ocorrencias}`);
  } else if (termino.tipo === "ATE") {
    // UNTIL no formato iCalendar, no fim do dia escolhido, para que a última
    // ocorrência daquele dia ainda entre na série.
    const [ano, mes, dia] = termino.data.split("-");
    if (!ano || !mes || !dia) throw dadosInvalidos("Data de término inválida.");
    partes.push(`UNTIL=${ano}${mes}${dia}T235959Z`);
  }

  return partes.join(";");
}

const frequenciaIcal = (f: Frequencia) =>
  ({ DIARIA: "DAILY", SEMANAL: "WEEKLY", MENSAL: "MONTHLY", ANUAL: "YEARLY" })[f];

/** Lê o texto RRULE de volta para a forma usada pela interface. */
export function deTextoRRule(texto: string): Recorrencia {
  const opcoes = RRule.parseString(texto);

  const frequencia = (
    {
      [RRule.DAILY]: "DIARIA",
      [RRule.WEEKLY]: "SEMANAL",
      [RRule.MONTHLY]: "MENSAL",
      [RRule.YEARLY]: "ANUAL",
    } as Record<number, Frequencia>
  )[opcoes.freq ?? RRule.DAILY];

  if (!frequencia) throw dadosInvalidos("Frequência de repetição não suportada.");

  const diasDaSemana = opcoes.byweekday
    ? (Array.isArray(opcoes.byweekday) ? opcoes.byweekday : [opcoes.byweekday]).map(
        (d) => {
          // A biblioteca aceita número, objeto Weekday ou sigla ("MO").
          const numero =
            typeof d === "number"
              ? d
              : typeof d === "string"
                ? SIGLAS.indexOf(d)
                : d.weekday;
          // Ali 0 = segunda; na interface 0 = domingo.
          return (numero + 1) % 7;
        },
      )
    : undefined;

  let termino: Termino = { tipo: "NUNCA" };
  if (opcoes.count) termino = { tipo: "APOS", ocorrencias: opcoes.count };
  else if (opcoes.until) {
    termino = { tipo: "ATE", data: opcoes.until.toISOString().slice(0, 10) };
  }

  return {
    frequencia,
    intervalo: opcoes.interval ?? 1,
    ...(diasDaSemana && { diasDaSemana }),
    termino,
  };
}

// --- Expansão --------------------------------------------------------------

export interface Ocorrencia {
  /** Instante real de início. */
  inicio: Date;
  /** Instante real de fim, preservando a duração do evento. */
  fim: Date;
  /**
   * Início original desta ocorrência na série. É a chave das exceções: uma
   * ocorrência movida continua identificada por onde ela deveria ter começado.
   */
  inicioOriginal: Date;
  /** Verdadeiro quando esta ocorrência foi alterada individualmente. */
  modificada: boolean;
}

export interface ExcecaoDeSerie {
  originalStart: Date;
  kind: "CANCELADA" | "MODIFICADA";
  overrides?: { startsAt?: string; endsAt?: string; title?: string } | null;
}

export interface EventoExpansivel {
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  rrule: string | null;
}

/** Teto de segurança: séries infinitas não podem travar uma consulta. */
const MAXIMO_DE_OCORRENCIAS = 500;

/**
 * Calcula as ocorrências de um evento dentro de uma janela.
 *
 * A expansão acontece em horário de parede: a regra é aplicada sobre os
 * componentes locais do evento e só depois cada resultado vira um instante.
 * É isso que mantém uma reunião das 14h às 14h ao atravessar o horário de
 * verão, em vez de deslocá-la em uma hora.
 */
export function expandirOcorrencias(
  evento: EventoExpansivel,
  janela: { inicio: Date; fim: Date },
  excecoes: ExcecaoDeSerie[] = [],
): Ocorrencia[] {
  const duracao = evento.endsAt.getTime() - evento.startsAt.getTime();

  // Sem regra, o evento é único.
  if (!evento.rrule) {
    if (evento.endsAt < janela.inicio || evento.startsAt > janela.fim) return [];
    return [
      {
        inicio: evento.startsAt,
        fim: evento.endsAt,
        inicioOriginal: evento.startsAt,
        modificada: false,
      },
    ];
  }

  const paredeInicial = paraHorarioDeParede(evento.startsAt, evento.timezone);
  const opcoes: Partial<Options> = {
    ...RRule.parseString(evento.rrule),
    dtstart: paraDataFlutuante(paredeInicial),
  };

  // A janela também precisa virar horário de parede, senão o recorte
  // aconteceria em um sistema de referência diferente do da expansão.
  const janelaFlutuante = {
    inicio: paraDataFlutuante(paraHorarioDeParede(janela.inicio, evento.timezone)),
    fim: paraDataFlutuante(paraHorarioDeParede(janela.fim, evento.timezone)),
  };

  const regra = new RRule(opcoes);
  const datasFlutuantes = regra
    .between(janelaFlutuante.inicio, janelaFlutuante.fim, true)
    .slice(0, MAXIMO_DE_OCORRENCIAS);

  const porInicioOriginal = new Map(
    excecoes.map((e) => [e.originalStart.getTime(), e]),
  );

  const ocorrencias: Ocorrencia[] = [];

  for (const flutuante of datasFlutuantes) {
    const inicioOriginal = deHorarioDeParede(
      deDataFlutuante(flutuante),
      evento.timezone,
    );

    const excecao = porInicioOriginal.get(inicioOriginal.getTime());
    if (excecao?.kind === "CANCELADA") continue;

    if (excecao?.kind === "MODIFICADA" && excecao.overrides) {
      const inicio = excecao.overrides.startsAt
        ? new Date(excecao.overrides.startsAt)
        : inicioOriginal;
      const fim = excecao.overrides.endsAt
        ? new Date(excecao.overrides.endsAt)
        : new Date(inicio.getTime() + duracao);

      ocorrencias.push({ inicio, fim, inicioOriginal, modificada: true });
      continue;
    }

    ocorrencias.push({
      inicio: inicioOriginal,
      fim: new Date(inicioOriginal.getTime() + duracao),
      inicioOriginal,
      modificada: false,
    });
  }

  return ocorrencias;
}

/**
 * Encerra uma série na véspera de uma ocorrência.
 *
 * Usado em "esta e as seguintes": a série original passa a terminar antes da
 * ocorrência escolhida, e uma nova série começa dali com os dados alterados.
 */
export function encerrarAntesDe(
  rruleTexto: string,
  ocorrencia: Date,
  timezone: string,
): string {
  const parede = paraHorarioDeParede(ocorrencia, timezone);
  const vespera = new Date(
    Date.UTC(parede.ano, parede.mes - 1, parede.dia) - 24 * 60 * 60 * 1000,
  );

  const opcoes = RRule.parseString(rruleTexto);
  // COUNT e UNTIL não convivem: ao fixar um fim, a contagem deixa de valer.
  delete opcoes.count;

  const partes = RRule.optionsToString({ ...opcoes })
    .replace(/^RRULE:/, "")
    .split(";")
    .filter((p) => !p.startsWith("UNTIL=") && !p.startsWith("COUNT=") && p.length > 0);

  const ate = vespera.toISOString().slice(0, 10).replace(/-/g, "");
  partes.push(`UNTIL=${ate}T235959Z`);

  return partes.join(";");
}
