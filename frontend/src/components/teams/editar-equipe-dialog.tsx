"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/messages";
import { useAtualizarEquipe } from "@/lib/queries/teams";
import type { Equipe } from "@/lib/types";

/** Editar equipe: só nome e descrição — membros continuam geridos na TeamView. */
export function EditarEquipeDialog({
  aberto,
  aoFechar,
  equipe,
}: {
  aberto: boolean;
  aoFechar: () => void;
  equipe: Pick<Equipe, "id" | "name" | "description"> | null;
}) {
  const atualizar = useAtualizarEquipe(equipe?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto || !equipe) return;
    setName(equipe.name);
    setDescription(equipe.description ?? "");
    setErro(null);
  }, [aberto, equipe]);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    try {
      await atualizar.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
      });
      toast.success("Equipe atualizada.");
      aoFechar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  if (!equipe) return null;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={aoEnviar} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Editar equipe</DialogTitle>
            <DialogDescription>Nome e descrição.</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor="editar-equipe-nome">Nome</Label>
              <Input
                id="editar-equipe-nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editar-equipe-descricao">Descrição (opcional)</Label>
              <Textarea
                id="editar-equipe-descricao"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
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
            <Button type="submit" disabled={atualizar.isPending}>
              {t.acoes.salvar}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
