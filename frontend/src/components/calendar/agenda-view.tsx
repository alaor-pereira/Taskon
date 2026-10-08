"use client";

import FullCalendar, {
  useCalendarController,
  type EventDisplayInfo,
  type ViewApi,
} from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import multiMonthPlugin from "@fullcalendar/react/multimonth";
import ptBrLocale from "@fullcalendar/react/locales/pt-br";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  PlusSignIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";
import { EventDialog } from "./event-dialog";
import { EventDrawer } from "./event-drawer";
import { ICONE_DO_TIPO } from "./icone-do-tipo";
import { SeletorSegmentado } from "@/components/seletor-segmentado";
import { Button } from "@/components/ui/button";
import { Icone, type IconSvgElement } from "@/components/ui/icone";
import { hora, mesmoDia } from "@/lib/datas";
import { t } from "@/lib/messages";
import { useAgendaDoPeriodo } from "@/lib/queries/calendar";
import type { OcorrenciaDeAgenda, TipoDeEvento } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SincronizacaoGoogle } from "@/components/integracoes/google-agenda";

type Visao = "timeGridDay" | "timeGridWeek" | "dayGridMonth" | "multiMonthYear";

const VISOES: Array<{ valor: Visao; rotulo: string }> = [
  { valor: "timeGridDay", rotulo: "Dia" },
  { valor: "timeGridWeek", rotulo: "Semana" },
  { valor: "dayGridMonth", rotulo: "Mês" },
  { valor: "multiMonthYear", rotulo: "Ano" },
];

interface EventoDoCalendario {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  extendedProps: { ocorrencia: OcorrenciaDeAgenda };
}

/**
 * Calendário completo (dia/semana/mês/ano), estilo Google Agenda.
 *
 * O intervalo visível vem do próprio FullCalendar (`datesSet`) e alimenta a
 * busca — trocar de mês/semana busca só o que está na tela, sem carregar a
 * agenda inteira de uma vez.
 *
 * Criar é pelos botões do cabeçalho ou clicando num dia/horário vazio, que já
 * abre "Nova atividade" naquela data.
 *
 * A barra de navegação é nossa, não a do FullCalendar: com o `controller`, os
 * chevrons, o "Hoje" e as visões usam os componentes do sistema. A moldura
 * arredondada também é nossa (o calendário vem `borderless`); na visão Ano ela
 * some, e cada mês vira um cartão próprio.
 */
export function AgendaView() {
  const [intervalo, setIntervalo] = useState<{ inicio: string; fim: string } | null>(
    null,
  );
  const { data } = useAgendaDoPeriodo(intervalo?.inicio ?? null, intervalo?.fim ?? null);
  const [abrindo, setAbrindo] = useState<OcorrenciaDeAgenda | null>(null);
  const [editando, setEditando] = useState<OcorrenciaDeAgenda | null>(null);
  const [criando, setCriando] = useState<{
    kind: TipoDeEvento;
    inicio: { data: Date; comHorario: boolean } | null;
  } | null>(null);

  const eventos = useMemo<EventoDoCalendario[]>(
    () =>
      (data ?? []).map((ocorrencia) => ({
        // A mesma série rende várias ocorrências — a chave precisa do horário.
        id: `${ocorrencia.evento.id}:${ocorrencia.inicioOriginal}`,
        title: ocorrencia.evento.title,
        start: ocorrencia.inicio,
        end: ocorrencia.fim,
        allDay: ocorrencia.evento.allDay,
        extendedProps: { ocorrencia },
      })),
    [data],
  );

  const controller = useCalendarController();
  const visao = controller.view?.type as Visao | undefined;
  const titulo = controller.view?.title ?? "";
  const hojeVisivel = controller.view
    ? controller.getButtonState().today.isDisabled
    : true;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-3 px-6 pt-5 pb-3">
        <h1 className="heading-section flex-1">{t.paginas.agenda}</h1>

        <SincronizacaoGoogle />

        <Button
          variant="outline"
          onClick={() => setCriando({ kind: "REUNIAO", inicio: null })}
        >
          <Icone icon={Video01Icon} />
          Nova reunião
        </Button>
        <Button onClick={() => setCriando({ kind: "ATIVIDADE", inicio: null })}>
          <Icone icon={PlusSignIcon} />
          Nova atividade
        </Button>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-3 px-6 pb-3">
        <div className="flex items-center gap-0.5 rounded-full border p-0.5">
          <BotaoDeNavegacao
            rotulo="Período anterior"
            icone={ArrowLeft01Icon}
            onClick={() => controller.prev()}
          />
          <BotaoDeNavegacao
            rotulo="Próximo período"
            icone={ArrowRight01Icon}
            onClick={() => controller.next()}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={hojeVisivel}
          onClick={() => controller.today()}
        >
          Hoje
        </Button>

        <h2 className="text-sm font-semibold" aria-live="polite">
          {titulo.charAt(0).toUpperCase() + titulo.slice(1)}
        </h2>

        <SeletorSegmentado
          opcoes={VISOES}
          valor={visao}
          aoMudar={(nova) => controller.changeView(nova)}
          rotulo="Visualização da agenda"
          className="ml-auto"
        />
      </div>

      <div className="min-h-0 flex-1 px-6 pb-6">
        <div
          className={cn(
            "h-full",
            visao !== "multiMonthYear" && "overflow-hidden rounded-lg border",
          )}
        >
          <FullCalendar
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              listPlugin,
              multiMonthPlugin,
              interactionPlugin,
              classicThemePlugin,
            ]}
            controller={controller}
            locale={ptBrLocale}
            initialView="dayGridMonth"
            height="100%"
            headerToolbar={false}
            borderless
            // As classes abaixo somam às do tema; a aparência está em
            // fullcalendar-theme.css, fora das camadas do Tailwind.
            tableClass={(info) => (info.multiMonthColumns > 1 ? "agenda-mes-card" : "")}
            dayCellTopInnerClass={(info) =>
              cn(
                info.isToday && "agenda-hoje-numero",
                info.isOther && info.view.type === "dayGridMonth" && "agenda-outro-mes-numero",
              )
            }
            dayHeaderInnerClass={(info) =>
              info.isToday && info.view.type.startsWith("timeGrid") ? "agenda-hoje-numero" : ""
            }
            // Mês: os dias de fora do mês ficam levemente apagados — fundo,
            // número e eventos.
            dayCellClass={(info) =>
              info.isOther && info.view.type === "dayGridMonth" ? "agenda-outro-mes" : ""
            }
            eventClass={(info) =>
              info.view.type === "dayGridMonth" && foraDoMes(info.event.start, info.view)
                ? "agenda-evento-outro-mes"
                : ""
            }
            // No Mês o ícone do tipo toma o lugar da bolinha; no Ano, fica a bolinha.
            listItemEventBeforeClass={(info) =>
              info.view.type === "dayGridMonth" ? "agenda-sem-bolinha" : ""
            }
            eventContent={(info) =>
              info.view.type === "multiMonthYear" ? true : <ConteudoDoEvento info={info} />
            }
            events={eventos}
            eventClick={(info) => {
              setAbrindo(
                (info.event.extendedProps as EventoDoCalendario["extendedProps"])
                  .ocorrencia,
              );
            }}
            dateClick={(info) => {
              // Na visão Mês (e na faixa "dia inteiro") o clique não tem horário.
              setCriando({
                kind: "ATIVIDADE",
                inicio: { data: info.date, comHorario: !info.allDay },
              });
            }}
            datesSet={(info) => {
              setIntervalo({
                inicio: info.start.toISOString(),
                fim: info.end.toISOString(),
              });
            }}
          />
        </div>
      </div>

      <EventDialog
        aberto={Boolean(criando)}
        aoFechar={() => setCriando(null)}
        kind={criando?.kind ?? "ATIVIDADE"}
        inicioSugerido={criando?.inicio ?? null}
      />

      <EventDrawer
        ocorrencia={abrindo}
        aoFechar={() => setAbrindo(null)}
        aoEditar={() => {
          setEditando(abrindo);
          setAbrindo(null);
        }}
      />

      <EventDialog
        aberto={Boolean(editando)}
        aoFechar={() => setEditando(null)}
        kind={editando?.evento.kind ?? "ATIVIDADE"}
        eventId={editando?.evento.id ?? null}
        ocorrencia={editando?.inicioOriginal ?? null}
      />
    </div>
  );
}

/**
 * O evento na grade: o ícone do tipo (reunião ou atividade) antes do horário.
 *
 * - Dia/Semana: "[ícone] 13:00 - 14:00" e o título embaixo; num evento curto,
 *   tudo numa linha.
 * - Mês: "[ícone] 09:00 Título", com o ícone azul no lugar da bolinha — a hora
 *   sempre com minutos (o padrão do FullCalendar mostraria só "09").
 * - Dia inteiro (barra): "[ícone] Título".
 */
function ConteudoDoEvento({ info }: { info: EventDisplayInfo }) {
  const { evento } = (info.event.extendedProps as EventoDoCalendario["extendedProps"])
    .ocorrencia;
  const icone = ICONE_DO_TIPO[evento.kind];
  const titulo = info.event.title || " ";

  if (info.view.type.startsWith("timeGrid") && !info.event.allDay) {
    const horario = (
      <span className="flex min-w-0 items-center gap-1">
        <Icone icon={icone} className="size-3 shrink-0" aria-hidden />
        <span className="truncate">{info.timeText}</span>
      </span>
    );
    if (info.isShort) {
      return (
        <span className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
          {horario}
          <span className={cn(info.titleClass, "truncate")}>{titulo}</span>
        </span>
      );
    }
    return (
      <>
        <div className={info.timeClass}>{horario}</div>
        <div className={info.titleClass}>{titulo}</div>
      </>
    );
  }

  // Mês e faixas de dia inteiro. Sem fundo (item com horário de um dia só),
  // o ícone é azul; sobre a barra colorida, acompanha a cor do texto.
  const semFundo =
    !info.event.allDay && info.event.start && info.event.end
      ? mesmoDia(info.event.start, info.event.end)
      : !info.event.allDay;
  const horario = info.timeText && info.event.start ? hora(info.event.start) : "";

  return (
    <span className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
      <Icone
        icon={icone}
        className={cn("size-3.5 shrink-0", semFundo && "text-primary")}
        aria-hidden
      />
      {horario && <span className={info.timeClass}>{horario}</span>}
      <span className={cn(info.titleClass, "truncate")}>{titulo}</span>
    </span>
  );
}

/** O evento começa fora do mês exibido (nos dias de borda da grade)? */
function foraDoMes(inicio: Date | null, view: ViewApi) {
  return Boolean(inicio && (inicio < view.currentStart || inicio >= view.currentEnd));
}

/** Chevron da cápsula de navegação: só ícone, com fundo suave no hover. */
function BotaoDeNavegacao({
  rotulo,
  icone,
  onClick,
}: {
  rotulo: string;
  icone: IconSvgElement;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      onClick={onClick}
      className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
    >
      <Icone icon={icone} className="size-4" />
    </button>
  );
}
