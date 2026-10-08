"use client";

import { RepeatIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { toast } from "sonner";
import { EventDialog } from "@/components/calendar/event-dialog";
import { ConfirmarDialog } from "@/components/confirmar-dialog";
import { ICONE_DO_TIPO } from "@/components/calendar/icone-do-tipo";
import { Icone } from "@/components/ui/icone";
import { ApiError } from "@/lib/api";
import { dataCurta } from "@/lib/datas";
import { urlExterna } from "@/lib/links";
import { t } from "@/lib/messages";
import { LIMITE_SECAO } from "@/lib/nav";
import {
  useAtividadesDeHoje,
  useExcluirEvento,
  useProximasAtividades,
  useReunioesAgendadas,
} from "@/lib/queries/calendar";
import type { OcorrenciaDeAgenda } from "@/lib/types";
import {
  SidebarEsqueleto,
  SidebarItem,
  SidebarSection,
  SidebarVazio,
} from "../sidebar-section";
import { ItemAcoesMenu } from "./item-acoes-menu";

/**
 * Agenda: Atividade para Hoje, Próximas Atividades e Reuniões Agendadas.
 *
 * As ocorrências de séries recorrentes não existem no banco — são calculadas a
 * cada consulta —, então a mesma série pode aparecer várias vezes na lista.
 */
export function AreaAgenda() {
  const hoje = useAtividadesDeHoje();
  const proximas = useProximasAtividades();
  const reunioes = useReunioesAgendadas();
  const excluir = useExcluirEvento();

  const [abrindo, setAbrindo] = useState<OcorrenciaDeAgenda | null>(null);

  const [confirmando, setConfirmando] = useState<OcorrenciaDeAgenda | null>(null);

  function excluirOcorrencia(ocorrencia: OcorrenciaDeAgenda) {
    setConfirmando(ocorrencia);
  }

  async function confirmarExclusao(ocorrencia: OcorrenciaDeAgenda) {
    try {
      await excluir.mutateAsync({
        eventId: ocorrencia.evento.id,
        escopo: "TODAS",
      });
      toast.success("Evento excluído.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  return (
    <>
      <SidebarSection titulo={t.secoes.atividadeParaHoje}>
        <ListaDeOcorrencias
          consulta={hoje}
          vazio={t.vazio.semAtividades}
          mostrarData={false}
          aoAbrir={setAbrindo}
          aoExcluir={excluirOcorrencia}
        />
      </SidebarSection>

      <SidebarSection titulo={t.secoes.proximasAtividades}>
        <ListaDeOcorrencias
          consulta={proximas}
          vazio={t.vazio.semAtividades}
          aoAbrir={setAbrindo}
          aoExcluir={excluirOcorrencia}
        />
      </SidebarSection>

      <SidebarSection titulo={t.secoes.reunioesAgendadas}>
        <ListaDeOcorrencias
          consulta={reunioes}
          vazio={t.vazio.semReunioes}
          ehReuniao
          aoAbrir={setAbrindo}
          aoExcluir={excluirOcorrencia}
        />
      </SidebarSection>

      <EventDialog
        aberto={Boolean(abrindo)}
        aoFechar={() => setAbrindo(null)}
        kind={abrindo?.evento.kind ?? "ATIVIDADE"}
        eventId={abrindo?.evento.id ?? null}
        // O início original identifica a ocorrência dentro da série.
        ocorrencia={abrindo?.inicioOriginal ?? null}
      />

      <ConfirmarDialog
        aberto={Boolean(confirmando)}
        titulo={`Excluir “${confirmando?.evento.title ?? ""}” definitivamente?`}
        descricao="Todas as datas do evento saem da agenda."
        rotuloConfirmar="Excluir"
        aoConfirmar={() => confirmando && confirmarExclusao(confirmando)}
        aoFechar={() => setConfirmando(null)}
      />
    </>
  );
}

function ListaDeOcorrencias({
  consulta,
  vazio,
  mostrarData = true,
  ehReuniao = false,
  aoAbrir,
  aoExcluir,
}: {
  consulta: { data?: OcorrenciaDeAgenda[]; isPending: boolean };
  vazio: string;
  mostrarData?: boolean;
  ehReuniao?: boolean;
  aoAbrir: (ocorrencia: OcorrenciaDeAgenda) => void;
  aoExcluir: (ocorrencia: OcorrenciaDeAgenda) => void;
}) {
  if (consulta.isPending) return <SidebarEsqueleto linhas={2} />;
  if (!consulta.data || consulta.data.length === 0) {
    return <SidebarVazio mensagem={vazio} />;
  }

  return (
    <>
      {consulta.data.slice(0, LIMITE_SECAO).map((ocorrencia) => {
        const inicio = new Date(ocorrencia.inicio);
        const participantes = ocorrencia.evento.participants.length;
        // Reunião com endereço de videochamada ganha "Ir para a reunião" no
        // menu; um local físico ("Sala 3") não vira link.
        const linkDaReuniao =
          ocorrencia.evento.kind === "REUNIAO"
            ? urlExterna(ocorrencia.evento.locationOrLink)
            : null;

        return (
          <SidebarItem
            // A mesma série rende várias linhas; a chave precisa do horário.
            key={`${ocorrencia.evento.id}:${ocorrencia.inicioOriginal}`}
            icone={<Icone icon={ICONE_DO_TIPO[ocorrencia.evento.kind]} className="size-4" />}
            titulo={ocorrencia.evento.title}
            indicador={
              ocorrencia.evento.rrule ? (
                <Icone icon={RepeatIcon}
                  aria-label="Evento que se repete"
                  className="size-3 shrink-0 text-muted-foreground"
                />
              ) : undefined
            }
            legenda={
              [
                mostrarData ? dataCurta(ocorrencia.inicio) : null,
                ehReuniao && participantes > 0
                  ? `${participantes} ${participantes === 1 ? "pessoa" : "pessoas"}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || undefined
            }
            detalhe={hora(inicio)}
            onClick={() => aoAbrir(ocorrencia)}
            acoes={
              <ItemAcoesMenu
                rotulo={ocorrencia.evento.title}
                onEditar={() => aoAbrir(ocorrencia)}
                onExcluir={() => aoExcluir(ocorrencia)}
                link={
                  linkDaReuniao
                    ? { rotulo: "Ir para a reunião", href: linkDaReuniao }
                    : undefined
                }
              />
            }
          />
        );
      })}
    </>
  );
}

function hora(data: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(data.getHours())}:${p(data.getMinutes())}`;
}
