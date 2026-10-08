"use client";

import { Cancel01Icon, Notification03Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import {
  abrirAgendaEm,
  abrirEquipeEm,
  abrirProjetoEm,
  abrirTarefaEm,
} from "@/components/layout/areas/abrir";
import { useAbas, type Aba } from "@/components/tabs/tabs-context";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icone";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError, get } from "@/lib/api";
import { hora, tempoRelativo } from "@/lib/datas";
import {
  useConvitesRecebidos,
  useMarcarNotificacaoLida,
  useMarcarTodasLidas,
  useNotificacoes,
  useResponderConvite,
} from "@/lib/queries/notifications";
import { t } from "@/lib/messages";
import type { Notificacao, PapelEquipe, PapelProjeto } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Notificações do aplicativo.
 *
 * Convites pendentes aparecem no topo, com as ações de aceitar e recusar ali
 * mesmo: eles exigem resposta, enquanto o resto é só informação.
 */
/**
 * Mora no rodapé da barra lateral: abre para cima, ou para a direita com a
 * barra recolhida (o rodapé fica no pé da tela, então cresce para cima).
 */
export function NotificationsPopover({ recolhida }: { recolhida?: boolean }) {
  const { data } = useNotificacoes();
  const { data: convites } = useConvitesRecebidos();
  const marcarTodas = useMarcarTodasLidas();
  const [aberto, setAberto] = useState(false);

  const naoLidas = data?.naoLidas ?? 0;
  const pendentes = convites?.length ?? 0;
  const total = naoLidas + pendentes;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      {/* Mesmo visual dos outros ícones do rodapé. */}
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              type="button"
              aria-label={
                total > 0 ? `${t.nav.notificacoes} (${total})` : t.nav.notificacoes
              }
              data-tour="notificacoes"
              className="relative inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
            />
          }
        >
          <Icone icon={Notification03Icon} className="size-4" />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground">
              {total > 9 ? "9+" : total}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent side={recolhida ? "right" : "top"}>
          {t.nav.notificacoes}
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        side={recolhida ? "right" : "top"}
        align={recolhida ? "end" : "start"}
        className="w-80 p-0"
      >
        <div className="flex items-center justify-between px-3 py-2">
          <p className="heading-subtle">{t.nav.notificacoes}</p>
          {naoLidas > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => marcarTodas.mutate()}
              disabled={marcarTodas.isPending}
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>

        <Separator />

        <div className="max-h-96 overflow-y-auto">
          {convites && convites.length > 0 && (
            <div className="p-2">
              {convites.map((convite) => (
                <CardDeConvite key={convite.id} convite={convite} />
              ))}
            </div>
          )}

          {data?.itens.length ? (
            <div className="p-1">
              {data.itens.map((n) => (
                <LinhaDeNotificacao
                  key={n.id}
                  notificacao={n}
                  aoNavegar={() => setAberto(false)}
                />
              ))}
            </div>
          ) : (
            !convites?.length && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nada por aqui.
              </p>
            )
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CardDeConvite({
  convite,
}: {
  convite: NonNullable<ReturnType<typeof useConvitesRecebidos>["data"]>[number];
}) {
  const responder = useResponderConvite();

  async function decidir(aceitar: boolean) {
    try {
      await responder.mutateAsync({ id: convite.id, aceitar });
      toast.success(aceitar ? "Convite aceito." : "Convite recusado.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  return (
    <div className="rounded-md border p-3">
      <p className="text-sm">
        <span className="font-semibold">{convite.invitedBy.name}</span> convidou você
        para <span className="font-semibold">{convite.team?.name}</span>.
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Expira {tempoRelativo(convite.expiresAt)}
      </p>
      <div className="mt-2.5 flex gap-2">
        <Button
          size="xs"
          onClick={() => decidir(true)}
          disabled={responder.isPending}
        >
          <Icone icon={Tick02Icon} />
          Aceitar
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => decidir(false)}
          disabled={responder.isPending}
        >
          <Icone icon={Cancel01Icon} />
          Recusar
        </Button>
      </div>
    </div>
  );
}

function LinhaDeNotificacao({
  notificacao,
  aoNavegar,
}: {
  notificacao: Notificacao;
  /** Fecha o painel quando o clique leva a outra aba. */
  aoNavegar: () => void;
}) {
  const marcar = useMarcarNotificacaoLida();
  const { abrirAba } = useAbas();
  const lida = Boolean(notificacao.readAt);
  const { titulo, contexto } = descrever(notificacao);

  async function abrir() {
    if (!lida) marcar.mutate(notificacao.id);

    const alvo = alvoDe(notificacao);
    if (!alvo) return;

    // O item pode ter sido excluído, ou o acesso retirado, depois do aviso:
    // confere antes de abrir uma aba que só diria "indisponível".
    if (alvo.caminho) {
      try {
        await get(alvo.caminho);
      } catch {
        toast.error("Este item não está mais disponível.");
        return;
      }
    }

    alvo.abrir(abrirAba);
    aoNavegar();
  }

  return (
    <button
      type="button"
      onClick={abrir}
      className={cn(
        "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/60",
        !lida && "bg-accent/30",
      )}
    >
      {!lida && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
      <span className={cn("min-w-0 flex-1", lida && "pl-3.5")}>
        <span className="block text-sm leading-snug">{titulo}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {contexto && <>{contexto} · </>}
          {tempoRelativo(notificacao.createdAt)}
        </span>
      </span>
    </button>
  );
}

// --- Texto e destino de cada notificação -------------------------------------

/** Lê um texto do payload; o que não for texto vira `null`. */
const texto = (valor: unknown) => (typeof valor === "string" && valor ? valor : null);

const maiuscula = (frase: string) => frase.charAt(0).toUpperCase() + frase.slice(1);

/** "12/09 às 14:00" */
const quando = (iso: string) => `${format(parseISO(iso), "dd/MM")} às ${hora(iso)}`;

/**
 * Texto de cada notificação: a frase principal e, quando houver, o contexto
 * da segunda linha (projeto, novo horário…).
 *
 * O backend guarda um payload genérico, e a redação fica aqui — assim mudar a
 * frase não exige migrar dados já gravados. Avisos antigos não guardavam quem
 * agiu: sem `autorNome`, a frase fica impessoal.
 */
function descrever(n: Notificacao): { titulo: string; contexto: string | null } {
  const p = n.payload;
  const autor = texto(p.autorNome);
  const nomeDaTarefa = texto(p.taskTitle);
  const tarefa = nomeDaTarefa ? `“${nomeDaTarefa}”` : "uma tarefa";
  const projetoDaTarefa = texto(p.projectName);

  switch (n.type) {
    case "TAREFA_ATRIBUIDA":
      return {
        titulo: autor
          ? `${autor} atribuiu ${tarefa} a você`
          : `${maiuscula(tarefa)} foi atribuída a você`,
        contexto: projetoDaTarefa,
      };
    case "TAREFA_DESATRIBUIDA":
      return {
        titulo: autor
          ? `${autor} tirou você de ${tarefa}`
          : `Você não é mais responsável por ${tarefa}`,
        contexto: projetoDaTarefa,
      };
    case "MENCAO_COMENTARIO":
      return {
        titulo: autor
          ? `${autor} mencionou você em ${tarefa}`
          : `Você foi mencionado em ${tarefa}`,
        contexto: projetoDaTarefa,
      };
    case "COMENTARIO_NA_TAREFA": {
      const quantidade = typeof p.quantidade === "number" ? p.quantidade : 1;
      return {
        titulo:
          quantidade > 1
            ? `${quantidade} novos comentários em ${tarefa}`
            : autor
              ? `${autor} comentou em ${tarefa}`
              : `Novo comentário em ${tarefa}`,
        contexto: projetoDaTarefa,
      };
    }
    case "TAREFA_VENCENDO":
      return { titulo: `${maiuscula(tarefa)} vence hoje`, contexto: projetoDaTarefa };
    case "TAREFA_ATRASADA":
      return { titulo: `${maiuscula(tarefa)} está atrasada`, contexto: projetoDaTarefa };

    case "REUNIAO_AGENDADA":
    case "REUNIAO_ALTERADA":
    case "REUNIAO_CANCELADA":
      return descreverReuniao(n.type, p, autor);

    case "CONVITE_EQUIPE":
      return descreverEquipe(p, autor);
    case "CONVITE_PROJETO":
      return descreverProjeto(p, autor);

    case "INTEGRACAO_DESCONECTADA": {
      const conta = texto(p.googleEmail);
      return {
        titulo: "O Google Agenda parou de sincronizar",
        contexto: conta
          ? `O Google não aceita mais o acesso de ${conta}. Reconecte na Agenda.`
          : "Reconecte na Agenda para voltar a sincronizar.",
      };
    }

    default:
      return { titulo: "Você tem uma nova notificação.", contexto: null };
  }
}

function descreverReuniao(
  tipo: "REUNIAO_AGENDADA" | "REUNIAO_ALTERADA" | "REUNIAO_CANCELADA",
  p: Record<string, unknown>,
  autor: string | null,
) {
  const titulo = texto(p.title);
  const reuniao = titulo ? `a reunião “${titulo}”` : "uma reunião";
  const inicio = texto(p.startsAt);
  const ocorrencia = texto(p.ocorrencia);

  // Numa série, diz qual parte mudou.
  const parte =
    p.escopo === "SO_ESTA" && ocorrencia
      ? ` (só a de ${format(parseISO(ocorrencia), "dd/MM")})`
      : p.escopo === "ESTA_E_SEGUINTES" && ocorrencia
        ? ` (a partir de ${format(parseISO(ocorrencia), "dd/MM")})`
        : "";

  if (tipo === "REUNIAO_AGENDADA") {
    const para = inicio ? ` para ${quando(inicio)}` : "";
    return {
      titulo: autor
        ? `${autor} marcou ${reuniao}${para}`
        : `${maiuscula(reuniao)} foi marcada${para}`,
      contexto: null,
    };
  }

  if (tipo === "REUNIAO_CANCELADA") {
    return {
      titulo: autor
        ? `${autor} cancelou ${reuniao}${parte}`
        : `${maiuscula(reuniao)} foi cancelada${parte}`,
      contexto: null,
    };
  }

  // O organizador desconectou o Google: o Meet some, o resto fica igual.
  if (p.motivo === "MEET_REMOVIDO") {
    return {
      titulo: autor
        ? `${autor} removeu o link do Google Meet de ${reuniao}`
        : `${maiuscula(reuniao)} ficou sem o link do Google Meet`,
      contexto: null,
    };
  }

  // Numa série alterada inteira, o início guardado é o da série, que pode já
  // ter passado: aí o novo horário não diz nada de útil.
  const mostraHorario = inicio && (p.recorrente !== true || p.escopo === "SO_ESTA");
  return {
    titulo: autor
      ? `${autor} alterou ${reuniao}${parte}`
      : `${maiuscula(reuniao)} mudou${parte}`,
    contexto: mostraHorario ? `Agora: ${quando(inicio)}` : null,
  };
}

function descreverEquipe(p: Record<string, unknown>, autor: string | null) {
  const nome = texto(p.teamName);
  const equipe = nome ? `a equipe ${nome}` : "uma equipe";
  const daEquipe = nome ? `da equipe ${nome}` : "de uma equipe";
  const naEquipe = nome ? `na equipe ${nome}` : "numa equipe";
  const papel = texto(p.role) as PapelEquipe | null;

  switch (p.evento) {
    case "CONVITE_ACEITO": {
      const por = texto(p.porNome);
      return {
        titulo: por ? `${por} aceitou seu convite para ${equipe}` : "Seu convite foi aceito.",
        contexto: null,
      };
    }
    case "CONVITE_RECUSADO": {
      const por = texto(p.porNome);
      return {
        titulo: por ? `${por} recusou seu convite para ${equipe}` : "Seu convite foi recusado.",
        contexto: null,
      };
    }
    case "REMOVIDO_DA_EQUIPE":
      return {
        titulo: autor ? `${autor} removeu você ${daEquipe}` : `Você foi removido ${daEquipe}`,
        contexto: null,
      };
    case "PROPRIEDADE_RECEBIDA":
      return {
        titulo: `Você agora é dono ${daEquipe}`,
        contexto: autor ? `Transferida por ${autor}` : null,
      };
    case "EQUIPE_EXCLUIDA":
      return {
        titulo: autor ? `${autor} excluiu ${equipe}` : `${maiuscula(equipe)} foi excluída`,
        contexto: null,
      };
    case "PAPEL_ALTERADO":
      return {
        titulo: papel
          ? `Seu papel ${naEquipe} agora é ${t.papelEquipe[papel]}`
          : `Seu papel ${naEquipe} mudou`,
        contexto: autor ? `Alterado por ${autor}` : null,
      };
    default: {
      const por = texto(p.convidadoPor);
      return {
        titulo: por ? `${por} convidou você para ${equipe}` : `Convite para ${equipe}`,
        contexto: null,
      };
    }
  }
}

function descreverProjeto(p: Record<string, unknown>, autor: string | null) {
  const nome = texto(p.projectName);
  const aoProjeto = nome ? `ao projeto ${nome}` : "a um projeto";
  const doProjeto = nome ? `do projeto ${nome}` : "de um projeto";
  const noProjeto = nome ? `no projeto ${nome}` : "num projeto";
  const papel = texto(p.role) as PapelProjeto | null;
  const como = papel ? ` como ${t.papelProjeto[papel]}` : "";

  switch (p.evento) {
    case "ADICIONADO_AO_PROJETO":
      return {
        titulo: autor
          ? `${autor} adicionou você ${aoProjeto}${como}`
          : `Você foi adicionado ${aoProjeto}${como}`,
        contexto: null,
      };
    case "PROPRIEDADE_RECEBIDA":
      return {
        titulo: `Você agora é dono ${doProjeto}`,
        contexto: autor ? `Transferido por ${autor}` : null,
      };
    case "REMOVIDO_DO_PROJETO":
      return {
        titulo: autor ? `${autor} removeu você ${doProjeto}` : `Você foi removido ${doProjeto}`,
        contexto: null,
      };
    case "PAPEL_ALTERADO":
      return {
        titulo: papel
          ? `Seu papel ${noProjeto} agora é ${t.papelProjeto[papel]}`
          : `Seu papel ${noProjeto} mudou`,
        contexto: autor ? `Alterado por ${autor}` : null,
      };
    default:
      return { titulo: `Novidade ${noProjeto}`, contexto: null };
  }
}

/**
 * Para onde o clique leva. Avisos só informativos (equipe excluída, removido,
 * reunião cancelada, convite ainda pendente — respondido no cartão acima) não
 * têm destino. `caminho` é o endpoint usado para conferir o acesso antes.
 */
function alvoDe(
  n: Notificacao,
): { caminho: string | null; abrir: (abrirAba: (aba: Aba) => void) => void } | null {
  const p = n.payload;

  switch (n.type) {
    case "TAREFA_ATRIBUIDA":
    case "TAREFA_DESATRIBUIDA":
    case "MENCAO_COMENTARIO":
    case "COMENTARIO_NA_TAREFA":
    case "TAREFA_VENCENDO":
    case "TAREFA_ATRASADA": {
      const id = texto(p.taskId);
      if (!id) return null;
      return {
        caminho: `/api/tarefas/${id}`,
        abrir: (abrirAba) =>
          abrirTarefaEm(abrirAba, { id, title: texto(p.taskTitle) ?? "Tarefa" }),
      };
    }

    case "REUNIAO_AGENDADA":
    case "REUNIAO_ALTERADA":
    case "INTEGRACAO_DESCONECTADA":
      return { caminho: null, abrir: (abrirAba) => abrirAgendaEm(abrirAba) };

    case "CONVITE_EQUIPE": {
      const id = texto(p.teamId);
      const comDestino = [
        "CONVITE_ACEITO",
        "CONVITE_RECUSADO",
        "PROPRIEDADE_RECEBIDA",
        "PAPEL_ALTERADO",
      ];
      if (!id || !comDestino.includes(String(p.evento))) return null;
      return {
        caminho: `/api/equipes/${id}`,
        abrir: (abrirAba) =>
          abrirEquipeEm(abrirAba, { id, name: texto(p.teamName) ?? "Equipe" }),
      };
    }

    case "CONVITE_PROJETO": {
      const id = texto(p.projectId);
      if (!id || p.evento === "REMOVIDO_DO_PROJETO") return null;
      return {
        caminho: `/api/projetos/${id}`,
        abrir: (abrirAba) =>
          abrirProjetoEm(abrirAba, { id, name: texto(p.projectName) ?? "Projeto" }),
      };
    }

    default:
      return null;
  }
}
