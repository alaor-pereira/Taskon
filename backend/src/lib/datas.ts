/**
 * Datas.
 *
 * O vencimento de uma tarefa é uma data pura, sem hora e sem fuso: "vence dia
 * 20" significa o dia 20 onde quer que a pessoa esteja. Já o "hoje" que decide
 * o que entra em "Vencem Hoje" depende do fuso do usuário — às 22h em São Paulo
 * já é o dia seguinte em Tóquio, e as listas precisam respeitar isso.
 */

/** "Hoje" no fuso informado, no formato AAAA-MM-DD. */
export function hojeNoFuso(timezone: string): string {
  return diaNoFuso(new Date(), timezone);
}

/** O dia, em AAAA-MM-DD, em que um instante cai no fuso informado. */
export function diaNoFuso(instante: Date, timezone: string): string {
  try {
    // en-CA formata como AAAA-MM-DD, que é exatamente o que precisamos.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instante);
  } catch {
    // Fuso inválido no perfil não pode derrubar a listagem: cai para UTC.
    return instante.toISOString().slice(0, 10);
  }
}

/**
 * O instante em que o dia AAAA-MM-DD começa no fuso informado, para comparar
 * com colunas de data e hora gravadas em UTC: a meia-noite em São Paulo é
 * 03:00 UTC.
 */
export function inicioDoDiaNoFuso(iso: string, timezone: string): Date {
  const meiaNoiteUtc = dataPura(iso).getTime();
  // O deslocamento é medido duas vezes: se o dia tiver troca de horário de
  // verão, a segunda medida já cai do lado certo dela.
  let instante = meiaNoiteUtc - deslocamentoDoFuso(new Date(meiaNoiteUtc), timezone);
  instante = meiaNoiteUtc - deslocamentoDoFuso(new Date(instante), timezone);
  return new Date(instante);
}

/** Quanto o relógio do fuso está à frente do UTC num instante, em ms. */
function deslocamentoDoFuso(instante: Date, timezone: string): number {
  try {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(instante);
    const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
      Number(partes.find((p) => p.type === tipo)?.value ?? 0);
    const relogio = Date.UTC(
      valor("year"),
      valor("month") - 1,
      valor("day"),
      valor("hour"),
      valor("minute"),
      valor("second"),
    );
    return relogio - Math.floor(instante.getTime() / 1000) * 1000;
  } catch {
    return 0;
  }
}

/** AAAA-MM-DD somado de N dias (N pode ser negativo). */
export function somarDias(iso: string, dias: number): string {
  const data = dataPura(iso);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** Dias corridos de `de` até `ate`, contando os dois. */
export function diasNoIntervalo(de: string, ate: string): number {
  return Math.round((dataPura(ate).getTime() - dataPura(de).getTime()) / 86_400_000) + 1;
}

/** Se a string é uma data AAAA-MM-DD que existe no calendário. */
export function ehDataValida(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && dataPura(iso).toISOString().slice(0, 10) === iso;
}

/**
 * Converte AAAA-MM-DD na data que o PostgreSQL grava numa coluna `date`.
 *
 * O Prisma serializa `@db.Date` como um instante em UTC à meia-noite. Montar a
 * data com `new Date("2026-09-20")` já produz esse instante, mas passar por
 * `Date.UTC` deixa a intenção explícita e evita depender da interpretação do
 * runtime para strings sem fuso.
 */
export function dataPura(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano!, (mes ?? 1) - 1, dia ?? 1));
}

/** Intervalo [início, fim) de um dia, para comparar com colunas `date`. */
export function intervaloDoDia(iso: string): { inicio: Date; fim: Date } {
  const inicio = dataPura(iso);
  const fim = new Date(inicio);
  fim.setUTCDate(fim.getUTCDate() + 1);
  return { inicio, fim };
}

/** Data de N dias à frente de "hoje" no fuso, em AAAA-MM-DD. */
export function daquiADias(timezone: string, dias: number): string {
  return somarDias(hojeNoFuso(timezone), dias);
}
