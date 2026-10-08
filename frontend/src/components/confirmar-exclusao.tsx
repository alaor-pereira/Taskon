"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmarDialog } from "@/components/confirmar-dialog";
import { useAbas } from "@/components/tabs/tabs-context";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/messages";
import { useExcluirProjeto } from "@/lib/queries/projects";
import { useExcluirTarefa } from "@/lib/queries/tasks";
import type { Projeto, Tarefa } from "@/lib/types";

/**
 * Enviar para a Lixeira, sempre com a mesma pergunta antes.
 *
 * Cada hook devolve `pedir(item)`, que abre a confirmação, e o `dialogo`, que
 * quem chama renderiza uma vez. Confirmada a exclusão, a aba do item (e das
 * subtarefas, quando a tarefa as traz) é fechada: ela só mostraria
 * "indisponível".
 */
interface ExclusaoComConfirmacao<T> {
  pedir: (item: T) => void;
  dialogo: ReactNode;
}

/** Tarefa de lista ou detalhada: só a detalhada traz as subtarefas. */
type TarefaExcluivel = Tarefa & { subtasks?: Array<Pick<Tarefa, "id">> };

export function useExcluirProjetoComConfirmacao({
  aoExcluir,
}: { aoExcluir?: (projeto: Projeto) => void } = {}): ExclusaoComConfirmacao<Projeto> {
  const excluir = useExcluirProjeto();
  const { fecharAba } = useAbas();
  const { item, aberto, pedir, fechar } = usePedido<Projeto>();

  async function confirmar(projeto: Projeto) {
    try {
      await excluir.mutateAsync(projeto.id);
      fecharAba(`projeto:${projeto.id}`);
      toast.success("Projeto enviado para a lixeira.");
      aoExcluir?.(projeto);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  return {
    pedir,
    dialogo: (
      <ConfirmarDialog
        aberto={aberto}
        titulo={`Enviar “${item?.name ?? ""}” para a lixeira?`}
        descricao="As tarefas do projeto vão junto. Você pode restaurar tudo pela Lixeira."
        rotuloConfirmar="Enviar para a lixeira"
        aoConfirmar={() => item && confirmar(item)}
        aoFechar={fechar}
      />
    ),
  };
}

export function useExcluirTarefaComConfirmacao({
  projectId,
  aoExcluir,
}: {
  /** Projeto cujas listas devem ser recarregadas. */
  projectId?: string;
  aoExcluir?: (tarefa: TarefaExcluivel) => void;
} = {}): ExclusaoComConfirmacao<TarefaExcluivel> {
  const excluir = useExcluirTarefa(projectId);
  const { fecharAba } = useAbas();
  const { item, aberto, pedir, fechar } = usePedido<TarefaExcluivel>();

  async function confirmar(tarefa: TarefaExcluivel) {
    try {
      await excluir.mutateAsync(tarefa.id);
      fecharAba(`tarefa:${tarefa.id}`);
      for (const sub of tarefa.subtasks ?? []) fecharAba(`tarefa:${sub.id}`);
      toast.success("Tarefa enviada para a lixeira.");
      aoExcluir?.(tarefa);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  const temSubtarefas = (item?._count.subtasks ?? 0) > 0;

  return {
    pedir,
    dialogo: (
      <ConfirmarDialog
        aberto={aberto}
        titulo={`Enviar “${item?.title ?? ""}” para a lixeira?`}
        descricao={
          temSubtarefas
            ? "As subtarefas vão junto. Você pode restaurar pela Lixeira."
            : "Você pode restaurá-la pela Lixeira."
        }
        rotuloConfirmar="Enviar para a lixeira"
        aoConfirmar={() => item && confirmar(item)}
        aoFechar={fechar}
      />
    ),
  };
}

/**
 * O item continua guardado depois de fechar: o diálogo anima a saída e não
 * deve perder o título no meio dela.
 */
function usePedido<T>() {
  const [item, setItem] = useState<T | null>(null);
  const [aberto, setAberto] = useState(false);
  return {
    item,
    aberto,
    pedir: (novo: T) => {
      setItem(novo);
      setAberto(true);
    },
    fechar: () => setAberto(false),
  };
}
