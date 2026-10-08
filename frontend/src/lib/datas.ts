import {
  formatDistanceToNow,
  format,
  isSameDay,
  isThisYear,
  isToday,
  isValid,
  isYesterday,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Formatação de datas, sempre em português.
 *
 * As datas chegam da API como texto ISO. Converter num só lugar evita que cada
 * tela invente o próprio formato.
 */

function paraData(valor: string | Date): Date | null {
  const data = typeof valor === "string" ? parseISO(valor) : valor;
  return isValid(data) ? data : null;
}

/** "há 3 minutos", usado no Header e nas listas. */
export function tempoRelativo(valor: string | Date): string {
  const data = paraData(valor);
  if (!data) return "";
  return formatDistanceToNow(data, { addSuffix: true, locale: ptBR });
}

/** "19 de setembro de 2026" */
export function dataPorExtenso(valor: string | Date): string {
  const data = paraData(valor);
  if (!data) return "";
  return format(data, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/**
 * "19/09/2026"
 *
 * Datas puras (só "AAAA-MM-DD", sem hora) nunca passam por `Date`: o valor
 * fica guardado como meia-noite UTC, e ler isso por getters de fuso local
 * (o que `parseISO`+`format` faz) volta um dia em fusos negativos como o do
 * Brasil. Uma data pura é só texto reordenado — nunca um instante no tempo.
 */
export function dataCurta(valor: string | Date): string {
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  const data = paraData(valor);
  if (!data) return "";
  return format(data, "dd/MM/yyyy", { locale: ptBR });
}

/**
 * Data pura (AAAA-MM-DD) como meia-noite local, para calendário e
 * formatação com date-fns. Pelo mesmo motivo de `dataCurta`, nunca passa
 * por UTC.
 */
export function dataPuraLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano ?? 1970, (mes ?? 1) - 1, dia ?? 1);
}

/** "19/09/2026 às 14:30" */
export function dataEHora(valor: string | Date): string {
  const data = paraData(valor);
  if (!data) return "";
  return format(data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

/** "14:30" — a hora no balão de um comentário. */
export function hora(valor: string | Date): string {
  const data = paraData(valor);
  if (!data) return "";
  return format(data, "HH:mm", { locale: ptBR });
}

/**
 * Separador de dia numa conversa: "Hoje", "Ontem", "19 de setembro" ou, fora
 * do ano corrente, "19 de setembro de 2025".
 */
export function rotuloDoDia(valor: string | Date): string {
  const data = paraData(valor);
  if (!data) return "";
  if (isToday(data)) return "Hoje";
  if (isYesterday(data)) return "Ontem";
  return isThisYear(data)
    ? format(data, "d 'de' MMMM", { locale: ptBR })
    : dataPorExtenso(data);
}

/** Os dois instantes caem no mesmo dia do calendário local? */
export function mesmoDia(a: string | Date, b: string | Date): boolean {
  const x = paraData(a);
  const y = paraData(b);
  return Boolean(x && y && isSameDay(x, y));
}
