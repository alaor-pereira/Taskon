"use client";

import { Delete02Icon, Logout03Icon } from "@hugeicons/core-free-icons";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ConfirmarDialog } from "@/components/confirmar-dialog";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/messages";
import {
  useAtualizarEquipe,
  useExcluirEquipe,
  useSairDaEquipe,
} from "@/lib/queries/teams";
import type { Equipe } from "@/lib/types";

/**
 * Configurações: dados da equipe (editáveis para quem gerencia, só leitura
 * para os demais) e a Zona de risco — sair, para quem não é dono; excluir,
 * para o dono.
 */
export function TeamConfiguracoes({
  equipe,
  podeGerenciar,
  souDono,
  souMembro,
  aoSair,
}: {
  equipe: Equipe;
  podeGerenciar: boolean;
  souDono: boolean;
  souMembro: boolean;
  aoSair: () => void;
}) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="heading-subtle">Dados da equipe</h2>
        {podeGerenciar ? (
          // A key remonta o formulário quando os dados mudam no servidor, para
          // não editar sobre um valor desatualizado.
          <FormularioDaEquipe key={`${equipe.name}|${equipe.description}`} equipe={equipe} />
        ) : (
          <dl className="space-y-3 rounded-lg border p-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Nome</dt>
              <dd>{equipe.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Descrição</dt>
              <dd className="whitespace-pre-line">{equipe.description || "—"}</dd>
            </div>
          </dl>
        )}
      </section>

      {(souDono || souMembro) && (
        <ZonaDeRisco teamId={equipe.id} nome={equipe.name} souDono={souDono} aoSair={aoSair} />
      )}
    </div>
  );
}

function FormularioDaEquipe({ equipe }: { equipe: Equipe }) {
  const atualizar = useAtualizarEquipe(equipe.id);
  const [nome, setNome] = useState(equipe.name);
  const [descricao, setDescricao] = useState(equipe.description ?? "");

  const alterado =
    nome.trim() !== equipe.name || descricao.trim() !== (equipe.description ?? "");

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    try {
      await atualizar.mutateAsync({
        name: nome.trim(),
        description: descricao.trim() || null,
      });
      toast.success("Equipe atualizada.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  return (
    <form onSubmit={aoEnviar} className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="equipe-nome">Nome</Label>
        <Input
          id="equipe-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          maxLength={120}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="equipe-descricao">Descrição (opcional)</Label>
        <Textarea
          id="equipe-descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="O que esta equipe faz"
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={!alterado || !nome.trim() || atualizar.isPending}>
          {t.acoes.salvar}
        </Button>
      </div>
    </form>
  );
}

function ZonaDeRisco({
  teamId,
  nome,
  souDono,
  aoSair,
}: {
  teamId: string;
  nome: string;
  souDono: boolean;
  aoSair: () => void;
}) {
  const sair = useSairDaEquipe();
  const excluir = useExcluirEquipe();
  const [confirmando, setConfirmando] = useState(false);

  async function executar() {
    try {
      if (souDono) {
        await excluir.mutateAsync(teamId);
        toast.success("Equipe excluída.");
      } else {
        await sair.mutateAsync(teamId);
        toast.success("Você saiu da equipe.");
      }
      aoSair();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="heading-subtle">Zona de risco</h2>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 p-4">
        <div>
          <p className="text-sm font-semibold">{souDono ? "Excluir equipe" : "Sair da equipe"}</p>
          <p className="text-xs text-muted-foreground">
            {souDono
              ? "Só é possível quando não há projetos ativos. Não tem como desfazer."
              : "Você perde o acesso a todos os projetos desta equipe."}
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={sair.isPending || excluir.isPending}
          onClick={() => setConfirmando(true)}
        >
          {souDono ? <Icone icon={Delete02Icon} /> : <Icone icon={Logout03Icon} />}
          {souDono ? "Excluir" : "Sair"}
        </Button>
      </div>

      <ConfirmarDialog
        aberto={confirmando}
        titulo={souDono ? "Excluir a equipe?" : "Sair da equipe?"}
        descricao={
          souDono
            ? `A equipe “${nome}” será excluída definitivamente. Não é possível desfazer.`
            : `Você perde o acesso a todos os projetos de “${nome}”.`
        }
        rotuloConfirmar={souDono ? "Excluir equipe" : "Sair"}
        aoFechar={() => setConfirmando(false)}
        aoConfirmar={executar}
      />
    </section>
  );
}
