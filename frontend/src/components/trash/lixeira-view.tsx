"use client";

import { Layers01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icone";
import { ApiError } from "@/lib/api";
import { tempoRelativo } from "@/lib/datas";
import { t } from "@/lib/messages";
import {
  useEsvaziarLixeira,
  useExcluirEmLoteDefinitivamente,
  useExcluirProjetoDefinitivamente,
  useExcluirTarefaDefinitivamente,
  useLixeira,
  useRestaurarEmLote,
  useRestaurarProjeto,
  useRestaurarTarefa,
} from "@/lib/queries/trash";
import type {
  ResultadoDoLoteDaLixeira,
  SelecaoDaLixeira,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Tipo = "projeto" | "tarefa";

/** Chave de seleção: um projeto e uma tarefa podem ter o mesmo id. */
const chave = (tipo: Tipo, id: string) => `${tipo}:${id}`;

const DIA_EM_MS = 24 * 60 * 60 * 1000;

function diasRestantes(deletedAt: string, diasAteAPurga: number) {
  const passados = Math.floor((Date.now() - new Date(deletedAt).getTime()) / DIA_EM_MS);
  return Math.max(0, diasAteAPurga - passados);
}

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

/** "2 projetos e 5 tarefas", omitindo a parte que é zero. */
function contagem(projetos: number, tarefas: number) {
  const partes = [
    projetos > 0 && plural(projetos, "projeto", "projetos"),
    tarefas > 0 && plural(tarefas, "tarefa", "tarefas"),
  ].filter(Boolean);
  return partes.join(" e ");
}

/** O que o diálogo de confirmação está prestes a fazer. */
type Confirmacao =
  | { acao: "excluir-item"; tipo: Tipo; id: string; nome: string }
  | { acao: "excluir-selecao"; selecao: SelecaoDaLixeira }
  | { acao: "esvaziar"; projetos: number; tarefas: number };

/**
 * Lixeira: projetos e tarefas excluídos, em duas seções.
 *
 * Só aparece o que o usuário poderia ter excluído. A seleção pode misturar
 * projetos e tarefas; os lotes são processados item a item no servidor, então
 * um item que falha não impede os outros — e continua selecionado, para que o
 * usuário veja o que sobrou.
 */
export function LixeiraView() {
  const { data, isPending } = useLixeira();

  const restaurarProjeto = useRestaurarProjeto();
  const restaurarTarefa = useRestaurarTarefa();
  const apagarProjeto = useExcluirProjetoDefinitivamente();
  const apagarTarefa = useExcluirTarefaDefinitivamente();
  const restaurarLote = useRestaurarEmLote();
  const excluirLote = useExcluirEmLoteDefinitivamente();
  const esvaziar = useEsvaziarLixeira();

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);

  const projetos = data?.projetos ?? [];
  const tarefas = data?.tarefas ?? [];
  const diasAteAPurga = data?.diasAteAPurga ?? 30;
  const vazia = projetos.length === 0 && tarefas.length === 0;
  const ocupado =
    restaurarLote.isPending || excluirLote.isPending || esvaziar.isPending;

  // Itens que saíram da Lixeira (por aqui ou por outra pessoa) deixam de
  // contar como selecionados.
  const existentes = new Set([
    ...projetos.map((p) => chave("projeto", p.id)),
    ...tarefas.map((t) => chave("tarefa", t.id)),
  ]);
  const selecao = [...selecionados].filter((k) => existentes.has(k));

  function selecaoAtual(): SelecaoDaLixeira {
    const resultado: SelecaoDaLixeira = { projetos: [], tarefas: [] };
    for (const k of selecao) {
      const [tipo, id] = k.split(":") as [Tipo, string];
      (tipo === "projeto" ? resultado.projetos : resultado.tarefas).push(id);
    }
    return resultado;
  }

  function alternar(k: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(k)) proximo.delete(k);
      else proximo.add(k);
      return proximo;
    });
  }

  function alternarTodos(chaves: string[], marcar: boolean) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      for (const k of chaves) {
        if (marcar) proximo.add(k);
        else proximo.delete(k);
      }
      return proximo;
    });
  }

  async function executar(acao: () => Promise<unknown>, sucesso: string) {
    try {
      await acao();
      toast.success(sucesso);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  /** Resume o lote e deixa selecionado só o que falhou. */
  function relatarLote(
    resultado: ResultadoDoLoteDaLixeira,
    verbo: { feito: string; falhou: string },
  ) {
    const feitos = contagem(resultado.projetos.length, resultado.tarefas.length);
    const falhas = resultado.falhas.length;

    setSelecionados(new Set(resultado.falhas.map((f) => chave(f.tipo, f.id))));

    if (falhas === 0) {
      toast.success(`${feitos} ${verbo.feito}.`);
    } else if (!feitos) {
      toast.error(
        `${plural(falhas, "item", "itens")} não ${falhas === 1 ? "pôde" : "puderam"} ser ${verbo.falhou}.`,
        { description: resultado.falhas[0]?.motivo },
      );
    } else {
      toast.warning(
        `${feitos} ${verbo.feito}; ${plural(falhas, "item", "itens")} não ${falhas === 1 ? "pôde" : "puderam"} ser ${verbo.falhou}.`,
        { description: resultado.falhas[0]?.motivo },
      );
    }
  }

  async function restaurarSelecao() {
    try {
      const resultado = await restaurarLote.mutateAsync(selecaoAtual());
      relatarLote(resultado, { feito: "restaurados", falhou: "restaurados" });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  async function confirmar() {
    const pedido = confirmacao;
    setConfirmacao(null);
    if (!pedido) return;

    if (pedido.acao === "excluir-item") {
      const apagar = pedido.tipo === "projeto" ? apagarProjeto : apagarTarefa;
      await executar(
        () => apagar.mutateAsync(pedido.id),
        pedido.tipo === "projeto"
          ? "Projeto excluído definitivamente."
          : "Tarefa excluída definitivamente.",
      );
      return;
    }

    if (pedido.acao === "excluir-selecao") {
      try {
        const resultado = await excluirLote.mutateAsync(pedido.selecao);
        relatarLote(resultado, {
          feito: "excluídos definitivamente",
          falhou: "excluídos",
        });
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : t.erros.generico);
      }
      return;
    }

    try {
      const r = await esvaziar.mutateAsync();
      setSelecionados(new Set());
      toast.success(
        `Lixeira esvaziada: ${contagem(r.projetosApagados, r.tarefasApagadas) || "nada a apagar"}.`,
      );
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  const selecaoResumo = selecaoAtual();

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 px-6 pt-5 pb-3">
        <div className="flex-1">
          <h1 className="heading-section">{t.paginas.lixeira}</h1>
          <p className="text-sm text-muted-foreground">
            Itens na lixeira são apagados automaticamente após {diasAteAPurga} dias.
          </p>
        </div>

        <Button
          variant="destructive"
          disabled={vazia || ocupado}
          onClick={() =>
            setConfirmacao({
              acao: "esvaziar",
              projetos: data?.totais.projetos ?? 0,
              tarefas: data?.totais.tarefas ?? 0,
            })
          }
        >
          {t.acoes.esvaziarLixeira}
        </Button>
      </header>

      {selecao.length > 0 && (
        <div
          role="toolbar"
          aria-label="Ações para os itens selecionados"
          className="surface-frost sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-3 px-6 py-2.5"
        >
          <span className="flex-1 text-sm font-semibold">
            {plural(selecao.length, "selecionado", "selecionados")}
          </span>
          <Button variant="outline" size="sm" disabled={ocupado} onClick={restaurarSelecao}>
            {t.acoes.restaurar}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={ocupado}
            onClick={() =>
              setConfirmacao({ acao: "excluir-selecao", selecao: selecaoResumo })
            }
          >
            {t.acoes.excluirDefinitivamente}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelecionados(new Set())}
          >
            {t.acoes.limparSelecao}
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-8 overflow-auto px-6 pt-2 pb-6">
        <Secao
          titulo={t.secoes.projetosExcluidos}
          total={data?.totais.projetos}
          carregando={isPending}
          vazio={t.vazio.semProjetosExcluidos}
          itens={projetos.map((p) => ({
            chave: chave("projeto", p.id),
            icone: <Icone icon={Layers01Icon} className="size-4 shrink-0 text-muted-foreground" />,
            nome: p.name,
            legenda: [
              p.team?.name,
              plural(p._count.tasks, "tarefa", "tarefas"),
              `excluído ${tempoRelativo(p.deletedAt)}`,
            ]
              .filter(Boolean)
              .join(" · "),
            diasRestantes: diasRestantes(p.deletedAt, diasAteAPurga),
            aoRestaurar: () =>
              executar(() => restaurarProjeto.mutateAsync(p.id), "Projeto restaurado."),
            aoExcluir: () =>
              setConfirmacao({ acao: "excluir-item", tipo: "projeto", id: p.id, nome: p.name }),
          }))}
          selecionados={selecionados}
          aoAlternar={alternar}
          aoAlternarTodos={alternarTodos}
        />

        <Secao
          titulo={t.secoes.tarefasExcluidas}
          total={data?.totais.tarefas}
          carregando={isPending}
          vazio={t.vazio.semTarefasExcluidas}
          itens={tarefas.map((tarefa) => ({
            chave: chave("tarefa", tarefa.id),
            nome: tarefa.title,
            legenda: `${tarefa.project.name} · excluída ${tempoRelativo(tarefa.deletedAt)}`,
            diasRestantes: diasRestantes(tarefa.deletedAt, diasAteAPurga),
            aoRestaurar: () =>
              executar(
                () => restaurarTarefa.mutateAsync(tarefa.id),
                "Tarefa restaurada.",
              ),
            aoExcluir: () =>
              setConfirmacao({
                acao: "excluir-item",
                tipo: "tarefa",
                id: tarefa.id,
                nome: tarefa.title,
              }),
          }))}
          selecionados={selecionados}
          aoAlternar={alternar}
          aoAlternarTodos={alternarTodos}
        />
      </div>

      <AlertDialog
        open={Boolean(confirmacao)}
        onOpenChange={(aberto) => !aberto && setConfirmacao(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tituloDaConfirmacao(confirmacao)}</AlertDialogTitle>
            <AlertDialogDescription>
              {descricaoDaConfirmacao(confirmacao)} Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.acoes.cancelar}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={confirmar}
            >
              {confirmacao?.acao === "esvaziar"
                ? t.acoes.esvaziarLixeira
                : t.acoes.excluirDefinitivamente}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function tituloDaConfirmacao(c: Confirmacao | null) {
  if (c?.acao === "esvaziar") return "Esvaziar a lixeira?";
  return "Excluir definitivamente?";
}

function descricaoDaConfirmacao(c: Confirmacao | null) {
  if (!c) return "";
  switch (c.acao) {
    case "excluir-item":
      return c.tipo === "projeto"
        ? `O projeto “${c.nome}” e as tarefas dele serão apagados de vez.`
        : `A tarefa “${c.nome}” será apagada de vez.`;
    case "excluir-selecao":
      return `${contagem(c.selecao.projetos.length, c.selecao.tarefas.length)} ${
        c.selecao.projetos.length + c.selecao.tarefas.length === 1
          ? "será apagado"
          : "serão apagados"
      } de vez.`;
    case "esvaziar":
      return `Todos os ${contagem(c.projetos, c.tarefas)} da lixeira serão apagados de vez.`;
  }
}

interface ItemDaSecao {
  chave: string;
  icone?: React.ReactNode;
  nome: string;
  legenda: string;
  diasRestantes: number;
  aoRestaurar: () => void;
  aoExcluir: () => void;
}

function Secao({
  titulo,
  total,
  carregando,
  vazio,
  itens,
  selecionados,
  aoAlternar,
  aoAlternarTodos,
}: {
  titulo: string;
  total?: number;
  carregando: boolean;
  vazio: string;
  itens: ItemDaSecao[];
  selecionados: Set<string>;
  aoAlternar: (chave: string) => void;
  aoAlternarTodos: (chaves: string[], marcar: boolean) => void;
}) {
  const chaves = itens.map((i) => i.chave);
  const marcados = chaves.filter((k) => selecionados.has(k)).length;
  const todos = itens.length > 0 && marcados === itens.length;
  const alguns = marcados > 0 && !todos;

  return (
    <section aria-label={titulo}>
      <div className="mb-2 flex items-center gap-3 px-3">
        <Caixa
          marcada={todos}
          indeterminada={alguns}
          desabilitada={itens.length === 0}
          rotulo={`Selecionar todos: ${titulo}`}
          aoAlternar={() => aoAlternarTodos(chaves, !todos)}
        />
        <h2 className="heading-subtle">{titulo}</h2>
        {total !== undefined && total > 0 && (
          <span className="text-xs text-muted-foreground">{total}</span>
        )}
      </div>

      {carregando ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-sm bg-muted" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {vazio}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {itens.map((item) => {
            const marcado = selecionados.has(item.chave);
            return (
              <li
                key={item.chave}
                className={cn(
                  "flex flex-wrap items-center gap-3 px-3 py-2.5",
                  marcado && "bg-accent",
                )}
              >
                <Caixa
                  marcada={marcado}
                  rotulo={`Selecionar ${item.nome}`}
                  aoAlternar={() => aoAlternar(item.chave)}
                />
                {item.icone}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.legenda}</p>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {item.diasRestantes === 0
                    ? "apagado hoje"
                    : `apagado em ${plural(item.diasRestantes, "dia", "dias")}`}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={item.aoRestaurar}>
                    {t.acoes.restaurar}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={item.aoExcluir}>
                    {t.acoes.excluirDefinitivamente}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Caixa de seleção nativa, com o estado "parcial" do selecionar-todos. */
function Caixa({
  marcada,
  indeterminada = false,
  desabilitada = false,
  rotulo,
  aoAlternar,
}: {
  marcada: boolean;
  indeterminada?: boolean;
  desabilitada?: boolean;
  rotulo: string;
  aoAlternar: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminada;
  }, [indeterminada]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={marcada}
      disabled={desabilitada}
      onChange={aoAlternar}
      aria-label={rotulo}
      className="size-4 shrink-0 accent-primary disabled:cursor-not-allowed"
    />
  );
}
