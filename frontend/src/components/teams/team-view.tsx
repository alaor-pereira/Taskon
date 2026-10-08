"use client";

import { UserAdd01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useAbas } from "@/components/tabs/tabs-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icone";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { dataCurta } from "@/lib/datas";
import { t } from "@/lib/messages";
import { useTodosOsProjetos } from "@/lib/queries/projects";
import { useEquipe } from "@/lib/queries/teams";
import { cn } from "@/lib/utils";
import { TeamConfiguracoes } from "./team-configuracoes";
import { ConvidarDialog, TeamConvites } from "./team-convites";
import { TeamMembros } from "./team-membros";
import { TeamProjetos } from "./team-projetos";

type AbaInterna = "membros" | "projetos" | "convites" | "configuracoes";

const ROTULOS: Record<AbaInterna, string> = {
  membros: "Membros",
  projetos: "Projetos",
  convites: "Convites",
  configuracoes: "Configurações",
};

/** A aba interna é lembrada por equipe, só neste navegador. */
const chaveDaAba = (teamId: string) => `taskon:equipe-aba:${teamId}`;

function abaSalva(teamId: string): AbaInterna {
  try {
    const salva = localStorage.getItem(chaveDaAba(teamId)) as AbaInterna | null;
    if (salva && salva in ROTULOS) return salva;
  } catch {
    // localStorage bloqueado: abre em Membros.
  }
  return "membros";
}

/**
 * Página de uma equipe, aberta como aba.
 *
 * O cabeçalho fica fixo e o conteúdo se divide em abas internas, para que uma
 * lista longa de membros não empurre convites e configurações para o fim de
 * uma rolagem sem fim.
 */
export function TeamView({ teamId }: { teamId: string }) {
  const { data, isPending, error } = useEquipe(teamId);
  const { data: sessao } = useSession();
  const { fecharAba } = useAbas();
  const { data: todosOsProjetos, isPending: carregandoProjetos } = useTodosOsProjetos();

  const [aba, setAba] = useState<AbaInterna>(() => abaSalva(teamId));
  const [convidando, setConvidando] = useState(false);

  function trocarAba(proxima: AbaInterna) {
    setAba(proxima);
    try {
      localStorage.setItem(chaveDaAba(teamId), proxima);
    } catch {}
  }

  if (isPending) return <Carregando />;

  if (error) {
    return (
      <Aviso
        titulo="Equipe indisponível"
        texto={error instanceof ApiError ? error.message : t.erros.generico}
      />
    );
  }
  if (!data) return null;

  const meuId = sessao?.user?.id;
  const podeGerenciar = data.meuPapel === "GESTOR";
  const souMembro = data.membros.some((m) => m.user.id === meuId);
  const projetos = (todosOsProjetos ?? []).filter((p) => p.teamId === teamId);

  const abas: AbaInterna[] = podeGerenciar
    ? ["membros", "projetos", "convites", "configuracoes"]
    : ["membros", "projetos", "configuracoes"];
  // Quem deixou de gerenciar não fica preso numa aba que não vê mais.
  const abaAtual = abas.includes(aba) ? aba : "membros";

  const total = data.membros.length;

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 space-y-3 px-6 pt-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-semibold">{data.equipe.name}</h1>
              <Badge variant="secondary" className="shrink-0">
                {data.souDono ? "Dono" : t.papelEquipe[data.meuPapel]}
              </Badge>
            </div>
            {data.equipe.description && (
              <p
                className="mt-1 line-clamp-2 text-sm text-muted-foreground"
                title={data.equipe.description}
              >
                {data.equipe.description}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {total} {total === 1 ? "membro" : "membros"} · {projetos.length}{" "}
              {projetos.length === 1 ? "projeto" : "projetos"} · criada em{" "}
              {dataCurta(data.equipe.createdAt)}
            </p>
          </div>

          {podeGerenciar && (
            <Button onClick={() => setConvidando(true)}>
              <Icone icon={UserAdd01Icon} />
              Convidar
            </Button>
          )}
        </div>

        <div role="tablist" aria-label="Seções da equipe" className="flex gap-1 overflow-x-auto border-b">
          {abas.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`equipe-aba-${id}`}
              aria-selected={abaAtual === id}
              aria-controls={`equipe-painel-${id}`}
              onClick={() => trocarAba(id)}
              className={cn(
                "relative shrink-0 px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring",
                abaAtual === id
                  ? "font-semibold text-foreground before:absolute before:inset-x-0 before:bottom-0 before:h-0.5 before:bg-ring"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ROTULOS[id]}
            </button>
          ))}
        </div>
      </header>

      <div
        role="tabpanel"
        id={`equipe-painel-${abaAtual}`}
        aria-labelledby={`equipe-aba-${abaAtual}`}
        className="min-h-0 flex-1 overflow-auto px-6 py-5"
      >
        <div className="mx-auto max-w-4xl">
          {abaAtual === "membros" && (
            <TeamMembros
              teamId={teamId}
              membros={data.membros}
              ownerId={data.equipe.ownerId}
              meuId={meuId}
              podeGerenciar={podeGerenciar}
              souDono={data.souDono}
            />
          )}
          {abaAtual === "projetos" && (
            <TeamProjetos
              teamId={teamId}
              projetos={projetos}
              carregando={carregandoProjetos}
              podeCriar={data.meuPapel !== "VISUALIZADOR"}
            />
          )}
          {abaAtual === "convites" && <TeamConvites teamId={teamId} />}
          {abaAtual === "configuracoes" && (
            <TeamConfiguracoes
              equipe={data.equipe}
              podeGerenciar={podeGerenciar}
              souDono={data.souDono}
              souMembro={souMembro}
              aoSair={() => fecharAba(`equipe:${teamId}`)}
            />
          )}
        </div>
      </div>

      {/* Montado só quando aberto: o formulário recomeça limpo a cada convite. */}
      {convidando && (
        <ConvidarDialog teamId={teamId} aberto aoFechar={() => setConvidando(false)} />
      )}
    </div>
  );
}

function Carregando() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-7 w-56 animate-pulse rounded-sm bg-muted" />
      <div className="h-4 w-80 animate-pulse rounded-sm bg-muted" />
      <div className="h-9 w-96 animate-pulse rounded-sm bg-muted" />
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <p className="heading-section">{titulo}</p>
        <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
      </div>
    </div>
  );
}
