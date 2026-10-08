/**
 * Conversão entre horário de parede e instante.
 *
 * Um evento semanal às 14h em Nova York deve continuar às 14h depois da
 * virada do horário de verão — ainda que o deslocamento em relação ao UTC
 * mude. Por isso a recorrência é expandida em horário de parede, e só no
 * final cada ocorrência vira um instante real.
 *
 * O Node não traz conversão com fuso pronta, então ela é feita com `Intl`.
 */

/** Deslocamento do fuso, em milissegundos, no instante informado. */
export function deslocamentoEm(instante: Date, timezone: string): number {
  const formatador = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const partes = Object.fromEntries(
    formatador.formatToParts(instante).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  // `hour` volta como "24" à meia-noite em alguns ambientes.
  const hora = Number(partes.hour) % 24;

  const comoSeFosseUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    hora,
    Number(partes.minute),
    Number(partes.second),
  );

  return comoSeFosseUtc - instante.getTime();
}

export interface HorarioDeParede {
  ano: number;
  mes: number; // 1-12
  dia: number;
  hora: number;
  minuto: number;
}

/** Instante real → horário de parede naquele fuso. */
export function paraHorarioDeParede(
  instante: Date,
  timezone: string,
): HorarioDeParede {
  const deslocado = new Date(instante.getTime() + deslocamentoEm(instante, timezone));
  return {
    ano: deslocado.getUTCFullYear(),
    mes: deslocado.getUTCMonth() + 1,
    dia: deslocado.getUTCDate(),
    hora: deslocado.getUTCHours(),
    minuto: deslocado.getUTCMinutes(),
  };
}

/**
 * Horário de parede → instante real.
 *
 * Duas passagens: a primeira estima o deslocamento, a segunda corrige quando a
 * estimativa caiu do outro lado de uma virada de horário de verão. Sem isso,
 * eventos marcados perto da virada saltariam uma hora.
 */
export function deHorarioDeParede(
  parede: HorarioDeParede,
  timezone: string,
): Date {
  const comoUtc = Date.UTC(
    parede.ano,
    parede.mes - 1,
    parede.dia,
    parede.hora,
    parede.minuto,
  );

  const primeiro = deslocamentoEm(new Date(comoUtc), timezone);
  const estimativa = comoUtc - primeiro;

  const segundo = deslocamentoEm(new Date(estimativa), timezone);
  if (segundo === primeiro) return new Date(estimativa);

  return new Date(comoUtc - segundo);
}

/** Converte o horário de parede em uma data "flutuante" tratada como UTC. */
export function paraDataFlutuante(parede: HorarioDeParede): Date {
  return new Date(
    Date.UTC(parede.ano, parede.mes - 1, parede.dia, parede.hora, parede.minuto),
  );
}

/** Inverso de `paraDataFlutuante`. */
export function deDataFlutuante(data: Date): HorarioDeParede {
  return {
    ano: data.getUTCFullYear(),
    mes: data.getUTCMonth() + 1,
    dia: data.getUTCDate(),
    hora: data.getUTCHours(),
    minuto: data.getUTCMinutes(),
  };
}

/** Verifica se o fuso é reconhecido, para não gravar lixo no evento. */
export function fusoValido(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
