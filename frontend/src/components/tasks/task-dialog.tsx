"use client";

import { Delete02Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useExcluirTarefaComConfirmacao } from "@/components/confirmar-exclusao";
import { SeletorDePessoas } from "@/components/seletor-de-pessoas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icone } from "@/components/ui/icone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/messages";
import { useProjetosDoFiltro } from "@/lib/queries/dashboard";
import { useProjeto } from "@/lib/queries/projects";
import {
  useAtualizarTarefa,
  useCriarTarefa,
  useDefinirResponsaveis,
  useTarefa,
} from "@/lib/queries/tasks";
import type {
  Dificuldade,
  MembroDoProjeto,
  Prioridade,
  StatusTarefa,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DifficultyBadge,
  ITENS_DE_DIFICULDADE,
  ITENS_DE_PRIORIDADE,
  PriorityBadge,
  SEM_DIFICULDADE,
  StatusBadge,
} from "./task-badges";

const STATUS: StatusTarefa[] = [
  "BACKLOG",
  "A_FAZER",
  "EM_ANDAMENTO",
  "EM_REVISAO",
  "EM_PAUSA",
  "CONCLUIDO",
];
const PRIORIDADES: Prioridade[] = ["ALTA", "MEDIA", "BAIXA"];
const DIFICULDADES: Dificuldade[] = ["ROTINEIRO", "COMPLEXO", "CRITICO"];
/** Valor do select de projeto para a Caixa de entrada (projectId nulo). */
const CAIXA_DE_ENTRADA = "INBOX";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  /** Informado ao editar; ausente ao criar. */
  taskId?: string | null;
  projectId?: string | null;
  /** Preenche o status ao criar a partir de uma coluna do Kanban. */
  statusInicial?: StatusTarefa;
  parentId?: string | null;
  membros?: MembroDoProjeto[];
  podeEditar?: boolean;
  /**
   * Criação fora de um projeto (página "Todas as tarefas"): mostra o campo
   * Projeto, começando em `projectId` ou, sem ele, na Caixa de entrada. Os
   * responsáveis passam a vir dos membros do projeto escolhido.
   */
  escolherProjeto?: boolean;
}

/**
 * Criação e edição de tarefa.
 *
 * Na edição, a versão lida acompanha a gravação: se outra pessoa alterou a
 * tarefa nesse meio-tempo, o servidor recusa e o aviso aparece aqui, em vez de
 * sobrescrever o trabalho alheio em silêncio.
 */
export function TaskDialog({
  aberto,
  aoFechar,
  taskId,
  projectId,
  statusInicial,
  parentId,
  membros = [],
  podeEditar = true,
  escolherProjeto = false,
}: Props) {
  const editando = Boolean(taskId);
  const { data: tarefa } = useTarefa(aberto && taskId ? taskId : null);

  const [projetoEscolhido, setProjetoEscolhido] = useState<string>(
    projectId ?? CAIXA_DE_ENTRADA,
  );
  const escolhendo = escolherProjeto && !editando;
  const { data: projetosDisponiveis } = useProjetosDoFiltro();
  const idDoProjetoEscolhido =
    projetoEscolhido === CAIXA_DE_ENTRADA ? null : projetoEscolhido;
  const { data: detalheEscolhido } = useProjeto(
    escolhendo && aberto ? idDoProjetoEscolhido : null,
  );
  const membrosDisponiveis = escolhendo ? (detalheEscolhido?.membros ?? []) : membros;
  const projetoDaTarefa = escolhendo ? idDoProjetoEscolhido : (projectId ?? null);
  const rotulosDeProjeto: Record<string, string> = {
    [CAIXA_DE_ENTRADA]: t.secoes.caixaDeEntrada,
    ...Object.fromEntries(
      (projetosDisponiveis ?? []).filter((p) => !p.isInbox).map((p) => [p.id, p.name]),
    ),
  };

  const criar = useCriarTarefa();
  const atualizar = useAtualizarTarefa();
  const exclusao = useExcluirTarefaComConfirmacao({
    projectId: projetoDaTarefa ?? undefined,
    aoExcluir: () => aoFechar(),
  });
  const definirResponsaveis = useDefinirResponsaveis(projetoDaTarefa ?? undefined);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<StatusTarefa>(statusInicial ?? "A_FAZER");
  const [priority, setPriority] = useState<Prioridade>("MEDIA");
  const [difficulty, setDifficulty] = useState<Dificuldade | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [responsaveis, setResponsaveis] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState<string | null>(null);

  // Ao abrir, o formulário assume o estado da tarefa carregada — ou o estado
  // inicial, quando é criação.
  useEffect(() => {
    if (!aberto) return;

    if (tarefa) {
      setTitle(tarefa.title);
      setDescription(tarefa.description ?? "");
      setStatus(tarefa.status);
      setPriority(tarefa.priority);
      setDifficulty(tarefa.difficulty);
      setDueDate(tarefa.dueDate ? tarefa.dueDate.slice(0, 10) : "");
      setResponsaveis(tarefa.assignees.map((a) => a.user.id));
    } else if (!taskId) {
      setTitle("");
      setDescription("");
      setStatus(statusInicial ?? "A_FAZER");
      setPriority("MEDIA");
      setDifficulty(null);
      setDueDate("");
      setResponsaveis([]);
      setProjetoEscolhido(projectId ?? CAIXA_DE_ENTRADA);
    }
    setErro(null);
    setConflito(null);
  }, [aberto, tarefa, taskId, statusInicial, projectId]);

  async function salvar(confirmandoSubtarefas = false) {
    setErro(null);
    setConflito(null);

    if (!title.trim()) {
      setErro("Informe um título.");
      return;
    }

    try {
      if (editando && tarefa) {
        await atualizar.mutateAsync({
          taskId: tarefa.id,
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          difficulty,
          dueDate: dueDate || null,
          version: tarefa.version,
          ...(confirmandoSubtarefas && { concluirComSubtarefasAbertas: true }),
        });

        const mudou =
          responsaveis.length !== tarefa.assignees.length ||
          responsaveis.some(
            (id) => !tarefa.assignees.some((a) => a.user.id === id),
          );
        if (mudou) {
          await definirResponsaveis.mutateAsync({
            taskId: tarefa.id,
            assigneeIds: responsaveis,
          });
        }

        toast.success("Tarefa atualizada.");
      } else {
        await criar.mutateAsync({
          projectId: projetoDaTarefa,
          parentId: parentId ?? null,
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          difficulty,
          dueDate: dueDate || null,
          assigneeIds: responsaveis,
        });
        toast.success("Tarefa criada.");
      }
      aoFechar();
    } catch (e) {
      if (e instanceof ApiError && e.ehConflito) {
        setConflito(e.message);
        return;
      }
      // Concluir com subtarefas abertas exige confirmação explícita.
      const detalhes = e instanceof ApiError ? e.detalhes : null;
      if (
        detalhes &&
        typeof detalhes === "object" &&
        "subtarefasAbertas" in detalhes
      ) {
        setErro(e instanceof ApiError ? e.message : t.erros.generico);
        return;
      }
      setErro(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  const salvando = criar.isPending || atualizar.isPending;
  const pedindoConfirmacaoDeSubtarefas =
    erro?.includes("subtarefa") && status === "CONCLUIDO";

  return (
    <>
      <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Tarefa" : parentId ? "Nova subtarefa" : "Nova tarefa"}
            </DialogTitle>
            {tarefa?.parent && (
              <DialogDescription>
                Subtarefa de “{tarefa.parent.title}”
              </DialogDescription>
            )}
          </DialogHeader>

          <DialogBody>
            {escolhendo && (
              <div className="space-y-2">
                <Label htmlFor="tarefa-projeto">Projeto</Label>
                <Select
                  value={projetoEscolhido}
                  onValueChange={(v) => {
                    setProjetoEscolhido(v ?? CAIXA_DE_ENTRADA);
                    // Responsáveis são membros do projeto: trocar de projeto
                    // invalida a escolha anterior.
                    setResponsaveis([]);
                  }}
                  items={rotulosDeProjeto}
                  disabled={salvando}
                >
                  <SelectTrigger id="tarefa-projeto" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CAIXA_DE_ENTRADA}>{t.secoes.caixaDeEntrada}</SelectItem>
                    {projetosDisponiveis
                      ?.filter((p) => !p.isInbox)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tarefa-titulo">Título</Label>
              <Input
                id="tarefa-titulo"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={300}
                disabled={!podeEditar || salvando}
                autoFocus={!editando}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tarefa-descricao">Descrição</Label>
              <Textarea
                id="tarefa-descricao"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={10000}
                disabled={!podeEditar || salvando}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 *:min-w-0">
              <div className="space-y-2">
                <Label htmlFor="tarefa-status">Etapa</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as StatusTarefa)}
                  items={t.status}
                  disabled={!podeEditar || salvando}
                >
                  <SelectTrigger id="tarefa-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t.status[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tarefa-prioridade">Prioridade</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as Prioridade)}
                  items={ITENS_DE_PRIORIDADE}
                  disabled={!podeEditar || salvando}
                >
                  <SelectTrigger id="tarefa-prioridade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((p) => (
                      <SelectItem key={p} value={p}>
                        <PriorityBadge priority={p} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tarefa-dificuldade">Dificuldade</Label>
                <Select
                  value={difficulty ?? SEM_DIFICULDADE}
                  onValueChange={(v) =>
                    setDifficulty(!v || v === SEM_DIFICULDADE ? null : (v as Dificuldade))
                  }
                  items={ITENS_DE_DIFICULDADE}
                  disabled={!podeEditar || salvando}
                >
                  <SelectTrigger id="tarefa-dificuldade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_DIFICULDADE}>{t.dificuldade.naoEstimada}</SelectItem>
                    {DIFICULDADES.map((d) => (
                      <SelectItem key={d} value={d}>
                        <DifficultyBadge difficulty={d} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tarefa-vencimento">Vencimento</Label>
                {/* Data pura: o vencimento não tem hora nem fuso. */}
                <Input
                  id="tarefa-vencimento"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={!podeEditar || salvando}
                />
              </div>
            </div>

            {membrosDisponiveis.length > 0 && (
              <div className="space-y-2">
                <Label>Responsáveis</Label>
                <SeletorDePessoas
                  pessoas={membrosDisponiveis.map((m) => m.user)}
                  selecionados={responsaveis}
                  aoMudar={setResponsaveis}
                  desabilitado={!podeEditar || salvando}
                  rotuloAdicionar="Adicionar responsável"
                  vazio="Ninguém"
                />
              </div>
            )}

            {tarefa && tarefa.subtasks.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Subtarefas</Label>
                  <div className="space-y-1">
                    {tarefa.subtasks.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                      >
                        <StatusBadge status={sub.status} />
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-sm",
                            sub.status === "CONCLUIDO" &&
                              "text-muted-foreground line-through",
                          )}
                        >
                          {sub.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {conflito && (
              <div
                role="alert"
                className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
              >
                <p className="font-semibold">{t.erros.conflito}</p>
                <p className="mt-1 text-muted-foreground">{conflito}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={aoFechar}
                >
                  Fechar e recarregar
                </Button>
              </div>
            )}

            {erro && !conflito && (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}
          </DialogBody>

          <DialogFooter className="sm:justify-between">
            {editando && podeEditar && tarefa ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => exclusao.pedir(tarefa)}
              >
                <Icone icon={Delete02Icon} />
                Excluir
              </Button>
            ) : (
              <span />
            )}

            <span className="flex gap-2">
              <Button variant="ghost" onClick={aoFechar}>
                {podeEditar ? t.acoes.cancelar : t.acoes.fechar}
              </Button>
              {podeEditar && (
                <Button
                  onClick={() => salvar(Boolean(pedindoConfirmacaoDeSubtarefas))}
                  disabled={salvando || Boolean(conflito)}
                >
                  {pedindoConfirmacaoDeSubtarefas
                    ? "Concluir mesmo assim"
                    : t.acoes.salvar}
                </Button>
              )}
            </span>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {exclusao.dialogo}
    </>
  );
}

