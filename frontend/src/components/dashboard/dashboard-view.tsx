"use client";

import { Video01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { FiltroSelect, type OpcaoDeFiltro } from "@/components/filtro-select";
import { Icone } from "@/components/ui/icone";
import { ApiError } from "@/lib/api";
import { dataCurta } from "@/lib/datas";
import { t } from "@/lib/messages";
import {
  useDashboard,
  useProjetosDoFiltro,
  type DadosDoDashboard,
  type EscopoDoDashboard,
} from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";
import { BlocoDeNumero, ChartCard, Medida } from "./chart-primitives";
import {
  FiltroPeriodo,
  intervaloDoPeriodo,
  PERIODO_PADRAO,
  rotuloDoPeriodo,
  type Periodo,
} from "./filtro-periodo";
import { CargaPorResponsavel } from "./graficos/carga-por-responsavel";
import { COR_DA_DIFICULDADE, COR_DA_ETAPA, COR_DA_PRIORIDADE } from "./graficos/cores";
import { Fluxo, rotulosDoBalde } from "./graficos/fluxo";
import { MapaDeCalor } from "./graficos/mapa-de-calor";
import { MedidorNoPrazo } from "./graficos/medidor-no-prazo";
import { RadarEtapas } from "./graficos/radar-etapas";
import { Rosca, type Fatia } from "./graficos/rosca";

const TODOS = "todos";

const ESCOPOS: OpcaoDeFiltro<EscopoDoDashboard>[] = [
  { valor: "MINHAS", rotulo: "Só as minhas" },
  { valor: "TODAS", rotulo: "Todas que acesso" },
];

/** Sufixo do título do fluxo, conforme o tamanho da barra. */
const POR_GRANULARIDADE = { dia: "por dia", semana: "por semana", mes: "por mês" } as const;

const ROTULO_DA_DIFICULDADE = {
  ROTINEIRO: t.dificuldade.ROTINEIRO,
  COMPLEXO: t.dificuldade.COMPLEXO,
  CRITICO: t.dificuldade.CRITICO,
  NAO_ESTIMADA: t.dificuldade.naoEstimada,
} as const;

/**
 * Dashboard, do resumo ao detalhe: números de prazo; onde o trabalho está
 * (radar por projeto e roscas de composição); o ritmo (fluxo semanal e
 * entregas no prazo); quem carrega o quê; e o histórico de entregas.
 *
 * Os filtros ficam no cabeçalho, acima de tudo o que eles recortam — e não
 * dentro de cada cartão: todos os gráficos respondem ao mesmo recorte (a carga
 * por responsável, de propósito, ignora o escopo; o cartão avisa). O período
 * vale para tudo, menos os prazos e as reuniões, que olham a partir de hoje.
 */
export function DashboardView() {
  const [escopo, setEscopo] = useState<EscopoDoDashboard>("MINHAS");
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_PADRAO);
  const [projectId, setProjectId] = useState<string>(TODOS);

  const { data: projetos } = useProjetosDoFiltro();
  const { data, isPending, isFetching, error } = useDashboard({
    escopo,
    ...intervaloDoPeriodo(periodo),
    ...(projectId !== TODOS && { projectId }),
  });

  return (
    <div className="flex h-full flex-col">
      {/* O cabeçalho fica de fora do carregamento: título e filtros não piscam. */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 px-6 pt-5 pb-3">
        <h1 className="heading-section flex-1">{t.paginas.dashboard}</h1>

        <div className="flex flex-wrap items-center gap-2">
          <FiltroSelect
            rotulo="Tarefas"
            valor={escopo}
            padrao="MINHAS"
            opcoes={ESCOPOS}
            aoMudar={setEscopo}
          />
          <FiltroSelect
            rotulo="Projeto"
            valor={projectId}
            padrao={TODOS}
            opcoes={[
              { valor: TODOS, rotulo: "Todos" },
              ...(projetos ?? []).map((p) => ({ valor: p.id, rotulo: p.name })),
            ]}
            aoMudar={setProjectId}
          />
          <FiltroPeriodo valor={periodo} aoMudar={setPeriodo} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
        {error ? (
          <div className="flex h-full items-center justify-center p-8">
            <p className="max-w-sm text-center text-sm text-muted-foreground">
              {error instanceof ApiError ? error.message : t.erros.generico}
            </p>
          </div>
        ) : isPending || !data ? (
          <Carregando />
        ) : (
          <Painel dados={data} periodo={periodo} atualizando={isFetching} />
        )}
      </div>
    </div>
  );
}

function Painel({
  dados: data,
  periodo,
  atualizando,
}: {
  dados: DadosDoDashboard;
  periodo: Periodo;
  atualizando: boolean;
}) {
  const noPeriodo = rotuloDoPeriodo(periodo);
  // Os retratos contam as tarefas criadas no período; sem período, todas.
  const todoOPeriodo = data.filtros.de === null;
  const tarefasDoRecorte = todoOPeriodo ? "Todas as tarefas" : "Tarefas criadas no período";
  const abertasDoRecorte = todoOPeriodo
    ? "Ainda não concluídas"
    : "Criadas no período e ainda não concluídas";
  const { granularidade, baldes } = data.fluxo;

  return (
    // Ao trocar um filtro, o conteúdo anterior fica em opacidade reduzida em
    // vez de virar esqueleto: nada salta de lugar.
    <div className={cn("space-y-4 transition-opacity", atualizando && "opacity-60")}>
      <Numeros dados={data} noPeriodo={noPeriodo} />

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          titulo="Etapas por projeto"
          descricao={`${tarefasDoRecorte} em cada etapa — os três projetos com mais`}
          tabela={{
            colunas: ["Projeto", ...ETAPAS.map((e) => t.status[e])],
            linhas: data.etapasPorProjeto.map((p) => [
              p.nome,
              ...ETAPAS.map((e) => p.porStatus[e] ?? 0),
            ]),
          }}
        >
          <RadarEtapas projetos={data.etapasPorProjeto} />
        </ChartCard>

        <div className="grid gap-4 sm:grid-cols-2">
          <CartaoDeRosca
            titulo="Tarefas por etapa"
            descricao={tarefasDoRecorte}
            unidade="tarefas"
            fatias={data.porStatus.map((s) => ({
              chave: s.status,
              rotulo: t.status[s.status],
              valor: s.total,
              cor: COR_DA_ETAPA[s.status],
            }))}
          />
          <CartaoDeRosca
            titulo="Abertas por prioridade"
            descricao={abertasDoRecorte}
            unidade="abertas"
            fatias={data.porPrioridade.map((p) => ({
              chave: p.priority,
              rotulo: t.prioridade[p.priority],
              valor: p.total,
              cor: COR_DA_PRIORIDADE[p.priority],
            }))}
          />
          <CartaoDeRosca
            titulo="Abertas por dificuldade"
            descricao={abertasDoRecorte}
            unidade="abertas"
            fatias={data.porDificuldade.map((d) => ({
              chave: d.difficulty,
              rotulo: ROTULO_DA_DIFICULDADE[d.difficulty],
              valor: d.total,
              cor: COR_DA_DIFICULDADE[d.difficulty],
            }))}
          />
          <CartaoDeRosca
            titulo="Projetos por etapa"
            descricao={
              todoOPeriodo ? "Etapa do próprio projeto" : "Projetos criados no período, pela etapa"
            }
            unidade="projetos"
            fatias={data.projetosPorEtapa.map((p) => ({
              chave: p.status,
              rotulo: t.status[p.status],
              valor: p.total,
              cor: COR_DA_ETAPA[p.status],
            }))}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          titulo={`Criadas × concluídas ${POR_GRANULARIDADE[granularidade]}`}
          descricao={noPeriodo}
          className="lg:col-span-2"
          vazio={baldes.every((b) => b.criadas === 0 && b.concluidas === 0)}
          tabela={{
            colunas: ["Período", "Criadas", "Concluídas"],
            linhas: baldes.map((b) => [
              rotulosDoBalde(b.inicio, granularidade).completo,
              b.criadas,
              b.concluidas,
            ]),
          }}
        >
          <Fluxo fluxo={data.fluxo} />
        </ChartCard>

        <ChartCard
          titulo="Concluídas no prazo"
          descricao={`Entregas · ${noPeriodo}`}
          tabela={{
            colunas: ["Medida", "Tarefas"],
            linhas: [
              ["Concluídas no período", data.noPrazo.concluidas],
              ["Com prazo", data.noPrazo.comPrazo],
              ["Dentro do prazo", data.noPrazo.dentroDoPrazo],
            ],
          }}
        >
          <MedidorNoPrazo noPrazo={data.noPrazo} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          titulo="Carga por responsável"
          descricao={
            todoOPeriodo
              ? "Tarefas abertas de cada pessoa, por prioridade"
              : "Tarefas abertas criadas no período, de cada pessoa, por prioridade"
          }
          tabela={{
            colunas: ["Pessoa", t.prioridade.ALTA, t.prioridade.MEDIA, t.prioridade.BAIXA],
            linhas: data.cargaPorResponsavel.pessoas.map((p) => [
              p.nome,
              p.ALTA,
              p.MEDIA,
              p.BAIXA,
            ]),
          }}
        >
          <CargaPorResponsavel carga={data.cargaPorResponsavel} />
        </ChartCard>

        <ChartCard
          titulo="Progresso por projeto"
          descricao={
            todoOPeriodo
              ? "Proporção concluída em cada projeto"
              : "Proporção concluída das tarefas criadas no período"
          }
          tabela={{
            colunas: ["Projeto", "Concluídas", "Total", "%"],
            linhas: data.progressoPorProjeto.map((p) => [
              p.nome,
              p.concluidas,
              p.total,
              `${p.percentual}%`,
            ]),
          }}
        >
          <ul className="space-y-3">
            {data.progressoPorProjeto.map((p) => (
              <Medida
                key={p.projectId}
                rotulo={p.nome}
                concluidas={p.concluidas}
                total={p.total}
                percentual={p.percentual}
              />
            ))}
          </ul>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          titulo="Ritmo de entregas"
          descricao={`Tarefas concluídas por dia · ${noPeriodo}`}
          tabela={{
            colunas: ["Dia", "Concluídas"],
            linhas: data.mapaDeEntregas.dias.map((d) => [dataCurta(d.dia), d.total]),
          }}
        >
          <MapaDeCalor mapa={data.mapaDeEntregas} />
        </ChartCard>

        <ChartCard
          titulo="Próximas reuniões"
          descricao="As cinco mais próximas"
          tabela={{
            colunas: ["Reunião", "Quando", "Pessoas"],
            linhas: data.proximasReunioes.map((r) => [
              r.title,
              dataEHoraCurta(r.inicio),
              r.participantes,
            ]),
          }}
        >
          <ul className="space-y-2">
            {data.proximasReunioes.map((reuniao) => (
              <li
                key={`${reuniao.eventId}:${reuniao.inicio}`}
                className="flex items-center gap-2.5 rounded-md border px-3 py-2"
              >
                <Icone
                  icon={Video01Icon}
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{reuniao.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {dataEHoraCurta(reuniao.inicio)}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {reuniao.participantes}
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
    </div>
  );
}

const ETAPAS = ["BACKLOG", "A_FAZER", "EM_ANDAMENTO", "EM_REVISAO", "EM_PAUSA", "CONCLUIDO"] as const;

/** Prazos olham a partir de hoje, seja qual for o período; só o último bloco o segue. */
function Numeros({ dados, noPeriodo }: { dados: DadosDoDashboard; noPeriodo: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <BlocoDeNumero
        rotulo="Atrasadas"
        valor={dados.prazos.atrasadas}
        tom="alerta"
        detalhe="Venceram e ainda estão ativas"
      />
      <BlocoDeNumero
        rotulo="Vencem em 7 dias"
        valor={dados.prazos.proximosSeteDias}
        detalhe="Inclui as de hoje"
      />
      <BlocoDeNumero
        rotulo="Sem prazo"
        valor={dados.prazos.semTerminoDefinido}
        detalhe="Ainda não concluídas"
      />
      <BlocoDeNumero
        rotulo="Concluídas no período"
        valor={dados.noPrazo.concluidas}
        detalhe={noPeriodo}
      />
    </div>
  );
}

function CartaoDeRosca({
  titulo,
  descricao,
  unidade,
  fatias,
}: {
  titulo: string;
  descricao: string;
  unidade: string;
  fatias: Fatia[];
}) {
  return (
    <ChartCard
      titulo={titulo}
      descricao={descricao}
      vazio={fatias.every((f) => f.valor === 0)}
      tabela={{ colunas: ["Categoria", "Quantidade"], linhas: fatias.map((f) => [f.rotulo, f.valor]) }}
    >
      <Rosca fatias={fatias} unidade={unidade} />
    </ChartCard>
  );
}

function dataEHoraCurta(iso: string): string {
  const data = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dataCurta(iso)} às ${p(data.getHours())}:${p(data.getMinutes())}`;
}

function Carregando() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-lg bg-muted lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
