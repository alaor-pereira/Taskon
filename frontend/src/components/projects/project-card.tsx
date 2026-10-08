"use client";

import { Calendar03Icon, Task01Icon } from "@hugeicons/core-free-icons";
import { GradeDeCards, porAlteracaoRecente } from "@/components/cards/grade-de-cards";
import { ItemCard } from "@/components/cards/item-card";
import {
  DifficultyBadge,
  PriorityBadge,
  prazoVencido,
  Responsaveis,
  StatusBadge,
} from "@/components/tasks/task-badges";
import {
  AcoesDaLinha,
  ColunaDaLista,
  LINHA_DA_LISTA,
  TITULO_DA_LINHA,
} from "@/components/tasks/task-list";
import { Icone } from "@/components/ui/icone";
import { useSession } from "@/lib/auth-client";
import { dataCurta } from "@/lib/datas";
import { t } from "@/lib/messages";
import type { Projeto } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Pode editar quem é OWNER ou EDITOR do projeto — a mesma regra do servidor.
 * O Gestor da equipe que não é membro direto também pode, mas a listagem não
 * traz esse vínculo; para ele o botão fica escondido e a edição continua
 * disponível na página do projeto.
 */
export function podeEditarProjeto(projeto: Projeto, meuId: string | undefined) {
  if (!meuId) return false;
  const papel = projeto.members?.find((m) => m.user.id === meuId)?.role;
  return papel === "OWNER" || papel === "EDITOR";
}

/**
 * Excluir é só do OWNER — a mesma regra do servidor. A Caixa de entrada nunca
 * sai: é o projeto pessoal fixo do usuário.
 */
export function podeExcluirProjeto(projeto: Projeto, meuId: string | undefined) {
  if (!meuId || projeto.isInbox) return false;
  return projeto.members?.find((m) => m.user.id === meuId)?.role === "OWNER";
}

/** Id do usuário logado, para decidir quais cartões mostram "Editar". */
export function useMeuId() {
  const { data } = useSession();
  return data?.user?.id;
}

/** Cartão de projeto — o mesmo molde do cartão de tarefa. */
export function ProjectCard({
  projeto,
  onIrPara,
  onEditar,
  onExcluir,
  arrastavel,
  irParaNoRodape,
  className,
}: {
  projeto: Projeto;
  onIrPara: () => void;
  onEditar?: () => void;
  onExcluir?: () => void;
  /** Cartão do Kanban: o corpo só arrasta. */
  arrastavel?: boolean;
  /** Seta "Ir para" no rodapé, no Kanban. */
  irParaNoRodape?: boolean;
  className?: string;
}) {
  const tarefas = projeto._count?.tasks ?? 0;

  return (
    <ItemCard
      titulo={projeto.name}
      descricao={projeto.description}
      status={projeto.status}
      prioridade={projeto.priority}
      dificuldade={projeto.difficulty}
      prazo={projeto.dueDate}
      contagem={
        projeto._count && (
          <span
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
            title={`${tarefas} ${tarefas === 1 ? "tarefa" : "tarefas"}`}
          >
            <Icone icon={Task01Icon} className="size-4" aria-hidden />
            {tarefas}
            <span className="sr-only">{tarefas === 1 ? "tarefa" : "tarefas"}</span>
          </span>
        )
      }
      pessoas={(projeto.members ?? []).map((m) => m.user)}
      rotuloIrPara={`Abrir o projeto “${projeto.name}”`}
      rotuloEditar={`Editar o projeto “${projeto.name}”`}
      rotuloExcluir={`Excluir o projeto “${projeto.name}”`}
      onIrPara={onIrPara}
      onEditar={onEditar}
      onExcluir={onExcluir}
      arrastavel={arrastavel}
      irParaNoRodape={irParaNoRodape}
      className={className}
    />
  );
}

export function ProjectCardVazio({ mensagem = t.vazio.semProjetos }: { mensagem?: string }) {
  return (
    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {mensagem}
    </p>
  );
}

/** Visualização em Lista: densa, uma linha por projeto. */
export function ProjectList({
  projetos,
  onAbrirProjeto,
  onEditarProjeto,
  onExcluirProjeto,
}: {
  projetos: Projeto[];
  /** Abre o projeto numa aba: o clique em qualquer ponto da linha. */
  onAbrirProjeto: (projeto: Projeto) => void;
  /** Cada linha só mostra a ação que o usuário pode fazer naquele projeto. */
  onEditarProjeto?: (projeto: Projeto) => void;
  onExcluirProjeto?: (projeto: Projeto) => void;
}) {
  const meuId = useMeuId();
  if (projetos.length === 0) return <ProjectCardVazio />;

  const comAcoes = Boolean(onEditarProjeto || onExcluirProjeto);

  return (
    <div className="divide-y rounded-lg border">
      {projetos.map((projeto) => {
        const atrasado = prazoVencido(projeto.status, projeto.dueDate);
        return (
          <div key={projeto.id} className={LINHA_DA_LISTA}>
            <ColunaDaLista largura="w-24">
              <StatusBadge status={projeto.status} className="w-full justify-center" />
            </ColunaDaLista>

            <button
              type="button"
              onClick={() => onAbrirProjeto(projeto)}
              className={TITULO_DA_LINHA}
            >
              {projeto.name}
            </button>

            <ColunaDaLista largura="w-10" alinhar="fim">
              {projeto._count && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums"
                  title={`${projeto._count.tasks} ${projeto._count.tasks === 1 ? "tarefa" : "tarefas"}`}
                >
                  <Icone icon={Task01Icon} className="size-4" aria-hidden />
                  {projeto._count.tasks}
                </span>
              )}
            </ColunaDaLista>

            <ColunaDaLista largura="w-20">
              <PriorityBadge priority={projeto.priority} />
            </ColunaDaLista>

            <ColunaDaLista largura="w-24">
              <DifficultyBadge difficulty={projeto.difficulty} mostrarVazio />
            </ColunaDaLista>

            <ColunaDaLista largura="w-24">
              {projeto.dueDate && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px]",
                    atrasado ? "font-semibold text-destructive" : "text-muted-foreground",
                  )}
                >
                  <Icone icon={Calendar03Icon} className="size-4" aria-hidden />
                  {dataCurta(projeto.dueDate)}
                </span>
              )}
            </ColunaDaLista>

            <ColunaDaLista largura="w-16" alinhar="fim">
              <Responsaveis usuarios={(projeto.members ?? []).map((m) => m.user)} max={2} />
            </ColunaDaLista>

            {comAcoes && (
              <AcoesDaLinha
                rotuloEditar={`Editar o projeto “${projeto.name}”`}
                rotuloExcluir={`Excluir o projeto “${projeto.name}”`}
                onEditar={
                  onEditarProjeto && podeEditarProjeto(projeto, meuId)
                    ? () => onEditarProjeto(projeto)
                    : undefined
                }
                onExcluir={
                  onExcluirProjeto && podeExcluirProjeto(projeto, meuId)
                    ? () => onExcluirProjeto(projeto)
                    : undefined
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Visualização em Cards: etapas misturadas, o mais recente primeiro. A etapa
 * de cada projeto fica no próprio cartão; separar por etapa é papel do Kanban.
 */
export function ProjectCards({
  projetos,
  onAbrirProjeto,
  onEditarProjeto,
  onExcluirProjeto,
}: {
  projetos: Projeto[];
  onAbrirProjeto: (projeto: Projeto) => void;
  onEditarProjeto?: (projeto: Projeto) => void;
  onExcluirProjeto?: (projeto: Projeto) => void;
}) {
  const meuId = useMeuId();
  if (projetos.length === 0) return <ProjectCardVazio />;

  return (
    <GradeDeCards>
      {porAlteracaoRecente(projetos).map((projeto) => (
        <ProjectCard
          key={projeto.id}
          projeto={projeto}
          onIrPara={() => onAbrirProjeto(projeto)}
          onEditar={
            onEditarProjeto && podeEditarProjeto(projeto, meuId)
              ? () => onEditarProjeto(projeto)
              : undefined
          }
          onExcluir={
            onExcluirProjeto && podeExcluirProjeto(projeto, meuId)
              ? () => onExcluirProjeto(projeto)
              : undefined
          }
        />
      ))}
    </GradeDeCards>
  );
}
