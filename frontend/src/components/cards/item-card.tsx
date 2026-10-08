"use client";

import {
  ArrowRight02Icon,
  Calendar03Icon,
  Delete02Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import {
  DifficultyBadge,
  PriorityBadge,
  prazoVencido,
  Responsaveis,
  StatusDot,
} from "@/components/tasks/task-badges";
import { Icone } from "@/components/ui/icone";
import { dataCurta } from "@/lib/datas";
import type { Dificuldade, Prioridade, StatusTarefa, UsuarioResumo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BotaoDeIcone } from "./botao-de-icone";

/**
 * Cartão de tarefa ou projeto — o mesmo molde nas visualizações Cards e
 * Kanban:
 *
 *   título                                    ● (etapa)
 *   descrição, cortada com "…"
 *   prioridade · dificuldade · prazo · contagem
 *   ───────────────
 *   avatares (até 3, depois "+N")   [editar] [excluir] ([ir para])
 *
 * Na visualização Cards o corpo inteiro é clicável e abre o item. Para teclado
 * e leitor de tela, o título é o botão que abre (com o anel de foco desenhado
 * no cartão); os botões do rodapé param a propagação do clique, então não
 * abrem o cartão. Assim não há botão dentro de botão. No Kanban
 * (`arrastavel`) o corpo só arrasta, e a seta "Ir para" volta ao rodapé
 * (`irParaNoRodape`).
 */
export function ItemCard({
  titulo,
  descricao,
  status,
  prioridade,
  dificuldade,
  prazo,
  contagem,
  pessoas,
  semPessoas,
  rotuloIrPara,
  rotuloEditar,
  rotuloExcluir,
  onIrPara,
  onEditar,
  onExcluir,
  arrastavel = false,
  irParaNoRodape = false,
  className,
}: {
  titulo: string;
  descricao: string | null;
  status: StatusTarefa;
  prioridade: Prioridade;
  dificuldade: Dificuldade | null;
  prazo: string | null;
  /** Ícone e número extra (subtarefas, tarefas do projeto). */
  contagem?: ReactNode;
  pessoas: UsuarioResumo[];
  /** Texto quando não há ninguém; sem ele, o espaço fica vazio. */
  semPessoas?: string;
  rotuloIrPara: string;
  rotuloEditar: string;
  rotuloExcluir: string;
  onIrPara: () => void;
  /** Ausente quando o usuário não pode editar: o botão some. */
  onEditar?: () => void;
  /** Ausente quando o usuário não pode excluir: a lixeira some. */
  onExcluir?: () => void;
  /**
   * Cartão do Kanban: o corpo serve para arrastar, então não navega. Só a
   * seta do rodapé leva à página; o cursor vira "grab".
   */
  arrastavel?: boolean;
  /** Mostra a seta "Ir para" no rodapé — no Kanban, onde o corpo não abre. */
  irParaNoRodape?: boolean;
  className?: string;
}) {
  const concluido = status === "CONCLUIDO";
  const atrasado = prazoVencido(status, prazo);

  return (
    <article
      onClick={arrastavel ? undefined : onIrPara}
      className={cn(
        "relative flex w-full flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:border-ring/40",
        arrastavel
          ? "cursor-grab active:cursor-grabbing"
          : "cursor-pointer has-[[data-titulo]:focus-visible]:outline-2 has-[[data-titulo]:focus-visible]:outline-offset-2 has-[[data-titulo]:focus-visible]:outline-ring has-[[data-titulo]:focus-visible]:outline-solid",
        concluido && "opacity-70",
        className,
      )}
    >
      {/* Título e descrição juntos, com respiro menor que o resto do cartão. */}
      <div className="space-y-0.5">
        {/*
         * Título à esquerda; o ponto da etapa no canto superior direito. O
         * ponto mora numa caixa da altura exata de uma linha do título
         * (leading-5 = 20px) e é centrado nela: sem isso ele herdaria a
         * entrelinha do corpo (17px), cairia abaixo do título e ainda
         * esticaria a linha, afastando a descrição.
         */}
        <div className="flex items-start gap-2">
          {arrastavel ? (
            <p
              className={cn(
                "line-clamp-2 min-w-0 flex-1 text-sm leading-5 font-semibold",
                concluido && "line-through",
              )}
            >
              {titulo}
            </p>
          ) : (
            <button
              type="button"
              data-titulo
              onClick={(e) => {
                // O cartão também abre no clique; sem isso abriria duas vezes.
                e.stopPropagation();
                onIrPara();
              }}
              className="min-w-0 flex-1 text-left outline-none"
            >
              <span
                className={cn(
                  "line-clamp-2 text-sm leading-5 font-semibold",
                  concluido && "line-through",
                )}
              >
                {titulo}
              </span>
            </button>
          )}
          <span className="ml-auto flex h-5 shrink-0 items-center leading-none">
            <StatusDot status={status} />
          </span>
        </div>

        {descricao && (
          <p className="line-clamp-2 text-xs leading-4 text-muted-foreground" title={descricao}>
            {descricao}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <PriorityBadge priority={prioridade} compacto />
        <DifficultyBadge difficulty={dificuldade} compacto />
        {prazo && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px]",
              atrasado ? "font-semibold text-destructive" : "text-muted-foreground",
            )}
          >
            <Icone icon={Calendar03Icon} className="size-4" aria-hidden />
            {dataCurta(prazo)}
            {atrasado && <span className="sr-only">(atrasado)</span>}
          </span>
        )}
        {contagem}
      </div>

      <div className="border-t" />

      <div className="flex min-h-6 items-center gap-2">
        {pessoas.length > 0 ? (
          <Responsaveis usuarios={pessoas} max={3} tamanho="md" />
        ) : (
          semPessoas && <span className="text-[11px] text-muted-foreground">{semPessoas}</span>
        )}

        {/* Os botões param a propagação: não abrem o cartão ao serem clicados. */}
        <span className="ml-auto flex items-center gap-0.5">
          {onEditar && (
            <BotaoDeIcone rotulo={rotuloEditar} onClick={onEditar}>
              <Icone icon={PencilEdit02Icon} className="size-4" />
            </BotaoDeIcone>
          )}
          {onExcluir && (
            <BotaoDeIcone rotulo={rotuloExcluir} onClick={onExcluir} destrutivo>
              <Icone icon={Delete02Icon} className="size-4" />
            </BotaoDeIcone>
          )}
          {irParaNoRodape && (
            <BotaoDeIcone rotulo={rotuloIrPara} onClick={onIrPara}>
              <Icone icon={ArrowRight02Icon} className="size-4" />
            </BotaoDeIcone>
          )}
        </span>
      </div>
    </article>
  );
}
