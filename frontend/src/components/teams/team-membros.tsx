"use client";

import { CrownIcon, MoreVerticalIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmarDialog } from "@/components/confirmar-dialog";
import { SeletorSegmentado } from "@/components/seletor-segmentado";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icone } from "@/components/ui/icone";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/messages";
import {
  useAlterarPapel,
  useRemoverMembro,
  useTransferirPropriedade,
} from "@/lib/queries/teams";
import type { MembroDaEquipe, PapelEquipe } from "@/lib/types";

export const PAPEIS: PapelEquipe[] = ["GESTOR", "MEMBRO", "VISUALIZADOR"];

const ROTULO_PLURAL: Record<PapelEquipe, string> = {
  GESTOR: "Gestores",
  MEMBRO: "Membros",
  VISUALIZADOR: "Visualizadores",
};

type FiltroPapel = "TODOS" | PapelEquipe;

/** Remove acentos e caixa, para "joao" encontrar "João". */
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Membros da equipe, pensado para listas longas: busca por nome ou e-mail,
 * filtro por papel com contagem, e ordem estável (dono, gestores, membros,
 * visualizadores; alfabética dentro de cada papel).
 */
export function TeamMembros({
  teamId,
  membros,
  ownerId,
  meuId,
  podeGerenciar,
  souDono,
}: {
  teamId: string;
  membros: MembroDaEquipe[];
  ownerId: string;
  meuId?: string;
  podeGerenciar: boolean;
  souDono: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroPapel>("TODOS");

  const ordenados = [...membros].sort((a, b) => {
    const donoA = a.user.id === ownerId ? 0 : 1;
    const donoB = b.user.id === ownerId ? 0 : 1;
    if (donoA !== donoB) return donoA - donoB;
    const papel = PAPEIS.indexOf(a.role) - PAPEIS.indexOf(b.role);
    if (papel !== 0) return papel;
    return a.user.name.localeCompare(b.user.name, "pt-BR");
  });

  const termo = normalizar(busca.trim());
  const visiveis = ordenados.filter(
    (m) =>
      (filtro === "TODOS" || m.role === filtro) &&
      (!termo ||
        normalizar(m.user.name).includes(termo) ||
        normalizar(m.user.email).includes(termo)),
  );

  const contagem = (papel: FiltroPapel) =>
    papel === "TODOS" ? membros.length : membros.filter((m) => m.role === papel).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Icone icon={Search01Icon}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            aria-label="Buscar membros"
            className="h-9 pl-10 text-sm"
          />
        </div>

        <SeletorSegmentado
          opcoes={(["TODOS", ...PAPEIS] as FiltroPapel[]).map((papel) => ({
            valor: papel,
            rotulo: (
              <>
                {papel === "TODOS" ? "Todos" : ROTULO_PLURAL[papel]}{" "}
                <span className="tabular-nums opacity-70">({contagem(papel)})</span>
              </>
            ),
          }))}
          valor={filtro}
          aoMudar={setFiltro}
          rotulo="Filtrar por papel"
          className="flex-wrap"
        />
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Ninguém encontrado com esse filtro.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {visiveis.map((membro) => (
            <LinhaDeMembro
              key={membro.id}
              membro={membro}
              teamId={teamId}
              ehDono={membro.user.id === ownerId}
              souEu={membro.user.id === meuId}
              podeGerenciar={podeGerenciar}
              souDono={souDono}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function LinhaDeMembro({
  membro,
  teamId,
  ehDono,
  souEu,
  podeGerenciar,
  souDono,
}: {
  membro: MembroDaEquipe;
  teamId: string;
  ehDono: boolean;
  souEu: boolean;
  podeGerenciar: boolean;
  souDono: boolean;
}) {
  const alterarPapel = useAlterarPapel(teamId);
  const remover = useRemoverMembro(teamId);
  const transferir = useTransferirPropriedade(teamId);
  const [confirmando, setConfirmando] = useState<"remover" | "transferir" | null>(null);

  const iniciais = membro.user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  async function executar(acao: () => Promise<unknown>, sucesso: string) {
    try {
      await acao();
      toast.success(sucesso);
    } catch (e) {
      // O backend bloqueia, por exemplo, remover quem possui projetos da equipe.
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  // O dono não muda de papel nem é removido: a equipe nunca fica sem dono.
  const editavel = podeGerenciar && !ehDono;
  const podeTransferir = souDono && !ehDono;
  const temMenu = editavel || podeTransferir;

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Avatar className="size-8 shrink-0">
        {membro.user.image && <AvatarImage src={membro.user.image} alt="" />}
        <AvatarFallback className="text-xs">{iniciais || "?"}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
          <span className="truncate">{membro.user.name}</span>
          {souEu && <span className="text-xs font-normal text-muted-foreground">(você)</span>}
          {ehDono && (
            <Icone icon={CrownIcon} className="size-4 shrink-0 text-muted-foreground" aria-label="Dono" />
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">{membro.user.email}</p>
      </div>

      {editavel ? (
        <Select
          value={membro.role}
          onValueChange={(valor) =>
            executar(
              () =>
                alterarPapel.mutateAsync({
                  membroId: membro.user.id,
                  role: valor as PapelEquipe,
                }),
              "Papel atualizado.",
            )
          }
          items={t.papelEquipe}
        >
          <SelectTrigger size="sm" className="w-36" aria-label={`Papel de ${membro.user.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAPEIS.map((p) => (
              <SelectItem key={p} value={p}>
                {t.papelEquipe[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Badge variant="secondary" className="shrink-0">
          {ehDono ? "Dono" : t.papelEquipe[membro.role]}
        </Badge>
      )}

      {temMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            aria-label={`Opções: ${membro.user.name}`}
            className="relative inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring"
          >
            <Icone icon={MoreVerticalIcon} className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {podeTransferir && (
              <DropdownMenuItem onClick={() => setConfirmando("transferir")}>
                <Icone icon={CrownIcon} />
                Transferir propriedade
              </DropdownMenuItem>
            )}
            {editavel && (
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmando("remover")}>
                Remover da equipe
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        // Mantém as colunas alinhadas nas linhas sem menu.
        podeGerenciar && <span className="size-7 shrink-0" aria-hidden />
      )}

      <ConfirmarDialog
        aberto={confirmando === "remover"}
        titulo="Remover da equipe?"
        descricao={`${membro.user.name} perde o acesso aos projetos desta equipe.`}
        rotuloConfirmar="Remover"
        aoFechar={() => setConfirmando(null)}
        aoConfirmar={() =>
          executar(() => remover.mutateAsync(membro.user.id), "Membro removido.")
        }
      />
      <ConfirmarDialog
        aberto={confirmando === "transferir"}
        titulo="Transferir a propriedade?"
        descricao={`${membro.user.name} passa a ser o dono da equipe. Você continua como Gestor, mas deixa de ser o dono.`}
        rotuloConfirmar="Transferir"
        aoFechar={() => setConfirmando(null)}
        aoConfirmar={() =>
          executar(() => transferir.mutateAsync(membro.user.id), "Propriedade transferida.")
        }
      />
    </li>
  );
}
