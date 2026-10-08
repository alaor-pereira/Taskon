import { describe, expect, it } from "vitest";
import {
  deTextoRRule,
  encerrarAntesDe,
  expandirOcorrencias,
  paraTextoRRule,
} from "../src/modules/calendar/recurrence.js";
import {
  deHorarioDeParede,
  deslocamentoEm,
  paraHorarioDeParede,
} from "../src/modules/calendar/timezone.js";

/**
 * O expansor de recorrência é função pura: não toca no banco.
 *
 * É aqui que mora a aritmética de calendário e de fuso, onde os erros são
 * silenciosos — uma reunião que desliza uma hora depois do horário de verão
 * não quebra nada, só aparece na hora errada.
 */

const SP = "America/Sao_Paulo";
const NY = "America/New_York";

/** Monta um instante a partir do horário de parede, para ler melhor. */
const em = (
  tz: string,
  ano: number,
  mes: number,
  dia: number,
  hora: number,
  minuto = 0,
) => deHorarioDeParede({ ano, mes, dia, hora, minuto }, tz);

const horaLocal = (instante: Date, tz: string) =>
  paraHorarioDeParede(instante, tz).hora;

const diaLocal = (instante: Date, tz: string) =>
  paraHorarioDeParede(instante, tz).dia;

describe("conversão de fuso", () => {
  it("ida e volta preserva o horário de parede", () => {
    const parede = { ano: 2026, mes: 9, dia: 20, hora: 14, minuto: 30 };
    const instante = deHorarioDeParede(parede, SP);
    expect(paraHorarioDeParede(instante, SP)).toEqual(parede);
  });

  it("reconhece a mudança de deslocamento no horário de verão", () => {
    // Nova York: inverno em UTC-5, verão em UTC-4.
    const inverno = deslocamentoEm(new Date("2026-01-15T12:00:00Z"), NY);
    const verao = deslocamentoEm(new Date("2026-07-15T12:00:00Z"), NY);

    expect(inverno / 3_600_000).toBe(-5);
    expect(verao / 3_600_000).toBe(-4);
  });

  it("o mesmo horário de parede vira instantes diferentes conforme a estação", () => {
    const janeiro = em(NY, 2026, 1, 15, 14);
    const julho = em(NY, 2026, 7, 15, 14);

    expect(janeiro.toISOString()).toContain("T19:00");
    expect(julho.toISOString()).toContain("T18:00");
  });
});

describe("serialização da regra", () => {
  it("diária simples", () => {
    expect(paraTextoRRule({ frequencia: "DIARIA" })).toBe("FREQ=DAILY");
  });

  it("semanal com dias escolhidos", () => {
    const texto = paraTextoRRule({
      frequencia: "SEMANAL",
      diasDaSemana: [1, 3], // segunda e quarta
    });
    expect(texto).toBe("FREQ=WEEKLY;BYDAY=MO,WE");
  });

  it("intervalo e término por contagem", () => {
    const texto = paraTextoRRule({
      frequencia: "SEMANAL",
      intervalo: 2,
      termino: { tipo: "APOS", ocorrencias: 5 },
    });
    expect(texto).toBe("FREQ=WEEKLY;INTERVAL=2;COUNT=5");
  });

  it("término por data cobre o dia inteiro", () => {
    const texto = paraTextoRRule({
      frequencia: "DIARIA",
      termino: { tipo: "ATE", data: "2026-10-05" },
    });
    // Até o fim do dia: a ocorrência do dia 5 ainda entra.
    expect(texto).toBe("FREQ=DAILY;UNTIL=20261005T235959Z");
  });

  it("volta ao formato da interface", () => {
    const original = {
      frequencia: "SEMANAL" as const,
      intervalo: 2,
      diasDaSemana: [1, 5],
      termino: { tipo: "APOS" as const, ocorrencias: 3 },
    };
    const lido = deTextoRRule(paraTextoRRule(original));

    expect(lido.frequencia).toBe("SEMANAL");
    expect(lido.intervalo).toBe(2);
    expect(lido.diasDaSemana?.sort()).toEqual([1, 5]);
    expect(lido.termino).toEqual({ tipo: "APOS", ocorrencias: 3 });
  });

  it("recusa intervalo fora da faixa", () => {
    expect(() => paraTextoRRule({ frequencia: "DIARIA", intervalo: 0 })).toThrow();
  });
});

describe("expansão", () => {
  const evento = (inicio: Date, duracaoMin: number, rrule: string | null, tz = SP) => ({
    startsAt: inicio,
    endsAt: new Date(inicio.getTime() + duracaoMin * 60_000),
    timezone: tz,
    rrule,
  });

  it("evento sem regra aparece uma vez só", () => {
    const e = evento(em(SP, 2026, 9, 20, 10), 60, null);
    const r = expandirOcorrencias(e, {
      inicio: em(SP, 2026, 9, 1, 0),
      fim: em(SP, 2026, 9, 30, 23),
    });

    expect(r).toHaveLength(1);
    expect(r[0]?.inicio.getTime()).toBe(e.startsAt.getTime());
  });

  it("evento sem regra fora da janela não aparece", () => {
    const e = evento(em(SP, 2026, 8, 20, 10), 60, null);
    const r = expandirOcorrencias(e, {
      inicio: em(SP, 2026, 9, 1, 0),
      fim: em(SP, 2026, 9, 30, 23),
    });

    expect(r).toHaveLength(0);
  });

  it("diária gera um por dia e preserva a duração", () => {
    const e = evento(em(SP, 2026, 9, 1, 9), 90, "FREQ=DAILY");
    const r = expandirOcorrencias(e, {
      inicio: em(SP, 2026, 9, 1, 0),
      fim: em(SP, 2026, 9, 5, 23),
    });

    expect(r).toHaveLength(5);
    expect(r.every((o) => o.fim.getTime() - o.inicio.getTime() === 90 * 60_000)).toBe(
      true,
    );
  });

  it("semanal respeita os dias escolhidos", () => {
    // 2026-09-07 é uma segunda-feira.
    const e = evento(em(SP, 2026, 9, 7, 10), 60, "FREQ=WEEKLY;BYDAY=MO,WE");
    const r = expandirOcorrencias(e, {
      inicio: em(SP, 2026, 9, 7, 0),
      fim: em(SP, 2026, 9, 20, 23),
    });

    // Segundas e quartas de duas semanas.
    expect(r).toHaveLength(4);
    expect(r.map((o) => diaLocal(o.inicio, SP))).toEqual([7, 9, 14, 16]);
  });

  it("término por contagem para no número certo", () => {
    const e = evento(em(SP, 2026, 9, 1, 8), 30, "FREQ=DAILY;COUNT=3");
    const r = expandirOcorrencias(e, {
      inicio: em(SP, 2026, 9, 1, 0),
      fim: em(SP, 2026, 12, 31, 23),
    });

    expect(r).toHaveLength(3);
  });

  it("término por data inclui o último dia", () => {
    const e = evento(em(SP, 2026, 9, 1, 8), 30, "FREQ=DAILY;UNTIL=20260903T235959Z");
    const r = expandirOcorrencias(e, {
      inicio: em(SP, 2026, 9, 1, 0),
      fim: em(SP, 2026, 9, 30, 23),
    });

    expect(r.map((o) => diaLocal(o.inicio, SP))).toEqual([1, 2, 3]);
  });

  it("mensal cai no mesmo dia de cada mês", () => {
    const e = evento(em(SP, 2026, 1, 15, 11), 60, "FREQ=MONTHLY");
    const r = expandirOcorrencias(e, {
      inicio: em(SP, 2026, 1, 1, 0),
      fim: em(SP, 2026, 4, 30, 23),
    });

    expect(r).toHaveLength(4);
    expect(r.every((o) => diaLocal(o.inicio, SP) === 15)).toBe(true);
  });

  it("anual atravessa o ano bissexto sem perder a data", () => {
    const e = evento(em(SP, 2024, 2, 29, 12), 60, "FREQ=YEARLY");
    const r = expandirOcorrencias(e, {
      inicio: em(SP, 2024, 1, 1, 0),
      fim: em(SP, 2029, 12, 31, 23),
    });

    // 29 de fevereiro só existe em anos bissextos: 2024 e 2028.
    expect(r).toHaveLength(2);
    expect(r.map((o) => paraHorarioDeParede(o.inicio, SP).ano)).toEqual([2024, 2028]);
  });

  it("mantém o horário local ao atravessar o horário de verão", () => {
    // 4 de março de 2026 é quarta; o horário de verão de Nova York começa no
    // dia 8. A reunião das 14h precisa seguir às 14h depois da virada.
    const e = evento(em(NY, 2026, 3, 4, 14), 60, "FREQ=WEEKLY", NY);
    const r = expandirOcorrencias(
      e,
      { inicio: em(NY, 2026, 3, 1, 0), fim: em(NY, 2026, 3, 31, 23) },
    );

    // Quartas de março a partir do dia 4: 4, 11, 18 e 25.
    expect(r.map((o) => diaLocal(o.inicio, NY))).toEqual([4, 11, 18, 25]);
    expect(r.every((o) => horaLocal(o.inicio, NY) === 14)).toBe(true);

    // O instante em UTC muda de 19h para 18h logo na segunda ocorrência: é a
    // prova de que o deslocamento foi recalculado, em vez de somar sempre
    // sete dias exatos sobre o instante anterior.
    expect(r[0]!.inicio.toISOString()).toContain("T19:00");
    expect(r[1]!.inicio.toISOString()).toContain("T18:00");
    expect(r[3]!.inicio.toISOString()).toContain("T18:00");
  });
});

describe("exceções da série", () => {
  const base = {
    startsAt: em(SP, 2026, 9, 1, 9),
    endsAt: em(SP, 2026, 9, 1, 10),
    timezone: SP,
    rrule: "FREQ=DAILY;COUNT=5",
  };
  const janela = { inicio: em(SP, 2026, 9, 1, 0), fim: em(SP, 2026, 9, 10, 23) };

  it("cancelar uma ocorrência remove só ela", () => {
    const r = expandirOcorrencias(base, janela, [
      { originalStart: em(SP, 2026, 9, 3, 9), kind: "CANCELADA" },
    ]);

    expect(r).toHaveLength(4);
    expect(r.map((o) => diaLocal(o.inicio, SP))).toEqual([1, 2, 4, 5]);
  });

  it("modificar move a ocorrência sem alterar as outras", () => {
    const novoInicio = em(SP, 2026, 9, 3, 15);
    const r = expandirOcorrencias(base, janela, [
      {
        originalStart: em(SP, 2026, 9, 3, 9),
        kind: "MODIFICADA",
        overrides: { startsAt: novoInicio.toISOString() },
      },
    ]);

    const movida = r.find((o) => diaLocal(o.inicioOriginal, SP) === 3);
    expect(movida?.modificada).toBe(true);
    expect(horaLocal(movida!.inicio, SP)).toBe(15);
    // A duração é preservada quando só o início é alterado.
    expect(movida!.fim.getTime() - movida!.inicio.getTime()).toBe(60 * 60_000);

    const intacta = r.find((o) => diaLocal(o.inicioOriginal, SP) === 4);
    expect(horaLocal(intacta!.inicio, SP)).toBe(9);
  });

  it("a ocorrência movida continua identificada pelo início original", () => {
    const r = expandirOcorrencias(base, janela, [
      {
        originalStart: em(SP, 2026, 9, 2, 9),
        kind: "MODIFICADA",
        overrides: { startsAt: em(SP, 2026, 9, 2, 20).toISOString() },
      },
    ]);

    const movida = r.find((o) => o.modificada);
    // Sem isso, uma segunda edição da mesma ocorrência criaria outra exceção.
    expect(horaLocal(movida!.inicioOriginal, SP)).toBe(9);
  });
});

describe("encerrar série antes de uma ocorrência", () => {
  it("a série original para na véspera", () => {
    const novoTexto = encerrarAntesDe("FREQ=DAILY", em(SP, 2026, 9, 10, 9), SP);
    expect(novoTexto).toContain("UNTIL=20260909");

    const r = expandirOcorrencias(
      {
        startsAt: em(SP, 2026, 9, 1, 9),
        endsAt: em(SP, 2026, 9, 1, 10),
        timezone: SP,
        rrule: novoTexto,
      },
      { inicio: em(SP, 2026, 9, 1, 0), fim: em(SP, 2026, 9, 30, 23) },
    );

    expect(r.map((o) => diaLocal(o.inicio, SP)).at(-1)).toBe(9);
  });

  it("a contagem antiga é descartada ao fixar um fim", () => {
    // COUNT e UNTIL não convivem numa mesma regra.
    const texto = encerrarAntesDe("FREQ=DAILY;COUNT=10", em(SP, 2026, 9, 5, 9), SP);
    expect(texto).not.toContain("COUNT=");
    expect(texto).toContain("UNTIL=");
  });
});
