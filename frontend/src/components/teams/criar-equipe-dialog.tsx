"use client";

import { useState, type FormEvent, type ReactNode } from "react";
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
import { useCriarEquipe } from "@/lib/queries/teams";
import { t } from "@/lib/messages";

export function CriarEquipeDialog({
  aberto,
  aoFechar,
  aoCriar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoCriar?: (equipe: { id: string; name: string }) => void;
}) {
  const criar = useCriarEquipe();
  const [erro, setErro] = useState<string | null>(null);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    const dados = new FormData(evento.currentTarget);
    const descricao = String(dados.get("description") ?? "").trim();

    try {
      const equipe = await criar.mutateAsync({
        name: String(dados.get("name")).trim(),
        ...(descricao && { description: descricao }),
      });
      toast.success("Equipe criada.");
      aoCriar?.(equipe);
      aoFechar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={aoEnviar} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Nova equipe</DialogTitle>
            <DialogDescription>
              Você será o gestor e poderá convidar pessoas depois.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                autoFocus
                placeholder="Desenvolvimento"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                name="description"
                maxLength={500}
                rows={3}
                placeholder="O que esta equipe faz"
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
              Criar equipe
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Invólucro para quem só precisa abrir o diálogo a partir de um gatilho. */
export function ComCriarEquipe({
  children,
}: {
  children: (abrir: () => void) => ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      {children(() => setAberto(true))}
      <CriarEquipeDialog aberto={aberto} aoFechar={() => setAberto(false)} />
    </>
  );
}
