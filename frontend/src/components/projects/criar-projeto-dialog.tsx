"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/messages";
import { useCriarProjeto } from "@/lib/queries/projects";
import { useEquipes } from "@/lib/queries/teams";
import { CamposDeNiveis, type NiveisDoProjeto } from "./campos-de-niveis";

const PESSOAL = "pessoal";

/**
 * Criação de projeto.
 *
 * O projeto pode ser pessoal ou de uma equipe. Só aparecem as equipes onde o
 * usuário pode criar projetos — ou seja, onde é Gestor ou Membro.
 */
export function CriarProjetoDialog({
  aberto,
  aoFechar,
  equipeInicial,
}: {
  aberto: boolean;
  aoFechar: () => void;
  equipeInicial?: string;
}) {
  const criar = useCriarProjeto();
  const { data: equipes } = useEquipes();
  const [teamId, setTeamId] = useState<string>(equipeInicial ?? PESSOAL);
  const [erro, setErro] = useState<string | null>(null);
  const [niveis, setNiveis] = useState<NiveisDoProjeto>({
    priority: "MEDIA",
    difficulty: null,
    dueDate: "",
  });

  // VISUALIZADOR não cria projeto, então a equipe não entra na lista.
  const disponiveis = [
    ...(equipes?.administro ?? []),
    ...(equipes?.participo ?? []),
  ];

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    const dados = new FormData(evento.currentTarget);
    const descricao = String(dados.get("description") ?? "").trim();

    try {
      await criar.mutateAsync({
        name: String(dados.get("name")).trim(),
        ...(descricao && { description: descricao }),
        teamId: teamId === PESSOAL ? null : teamId,
        priority: niveis.priority,
        difficulty: niveis.difficulty,
        dueDate: niveis.dueDate || null,
      });
      toast.success("Projeto criado.");
      setNiveis({ priority: "MEDIA", difficulty: null, dueDate: "" });
      aoFechar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={aoEnviar} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>
              Você será o proprietário e poderá incluir pessoas depois.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor="projeto-nome">Nome</Label>
              <Input
                id="projeto-nome"
                name="name"
                required
                maxLength={120}
                autoFocus
                placeholder="Sistema ERP"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="projeto-equipe">Equipe</Label>
              {/* O Base UI emite null ao limpar; aqui sempre há uma opção. */}
              <Select
                value={teamId}
                onValueChange={(v) => setTeamId(v ?? PESSOAL)}
                items={{
                  [PESSOAL]: "Projeto pessoal",
                  ...Object.fromEntries(disponiveis.map((e) => [e.id, e.name])),
                }}
              >
                <SelectTrigger id="projeto-equipe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PESSOAL}>Projeto pessoal</SelectItem>
                  {disponiveis.map((equipe) => (
                    <SelectItem key={equipe.id} value={equipe.id}>
                      {equipe.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Em projeto de equipe, só membros dela podem participar.
              </p>
            </div>

            <CamposDeNiveis
              prefixo="projeto"
              valor={niveis}
              aoMudar={setNiveis}
              desabilitado={criar.isPending}
            />

            <div className="space-y-2">
              <Label htmlFor="projeto-descricao">Descrição (opcional)</Label>
              <Textarea
                id="projeto-descricao"
                name="description"
                rows={3}
                maxLength={2000}
              />
            </div>

            {erro && (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar}>
              {t.acoes.cancelar}
            </Button>
            <Button type="submit" disabled={criar.isPending}>
              Criar projeto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
