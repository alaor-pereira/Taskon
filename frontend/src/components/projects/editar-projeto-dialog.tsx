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
import { useAtualizarProjeto } from "@/lib/queries/projects";
import type { Projeto, StatusTarefa } from "@/lib/types";
import { CamposDeNiveis, type NiveisDoProjeto } from "./campos-de-niveis";

const STATUS: StatusTarefa[] = [
  "BACKLOG",
  "A_FAZER",
  "EM_ANDAMENTO",
  "EM_REVISAO",
  "EM_PAUSA",
  "CONCLUIDO",
];

/**
 * Editar projeto: nome, descrição e etapa. Sem campo de equipe — reatribuir
 * a equipe de um projeto já criado mexe em quem enxerga o quê, e fica fora
 * deste diálogo de propósito.
 */
export function EditarProjetoDialog({
  aberto,
  aoFechar,
  projeto,
}: {
  aberto: boolean;
  aoFechar: () => void;
  projeto: Pick<
    Projeto,
    "id" | "name" | "description" | "status" | "priority" | "difficulty" | "dueDate"
  > | null;
}) {
  const atualizar = useAtualizarProjeto(projeto?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<StatusTarefa>("A_FAZER");
  const [erro, setErro] = useState<string | null>(null);
  const [niveis, setNiveis] = useState<NiveisDoProjeto>({
    priority: "MEDIA",
    difficulty: null,
    dueDate: "",
  });

  // Ao abrir, o formulário assume os dados do projeto clicado — o mesmo
  // padrão do TaskDialog, para funcionar reabrindo com outro projeto sem
  // desmontar o componente.
  useEffect(() => {
    if (!aberto || !projeto) return;
    setName(projeto.name);
    setDescription(projeto.description ?? "");
    setStatus(projeto.status);
    setNiveis({
      priority: projeto.priority,
      difficulty: projeto.difficulty,
      dueDate: projeto.dueDate ? projeto.dueDate.slice(0, 10) : "",
    });
    setErro(null);
  }, [aberto, projeto]);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    try {
      await atualizar.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        status,
        priority: niveis.priority,
        difficulty: niveis.difficulty,
        dueDate: niveis.dueDate || null,
      });
      toast.success("Projeto atualizado.");
      aoFechar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  if (!projeto) return null;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={aoEnviar} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Editar projeto</DialogTitle>
            <DialogDescription>Nome, etapa, níveis, prazo e descrição.</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor="editar-projeto-nome">Nome</Label>
              <Input
                id="editar-projeto-nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editar-projeto-etapa">Etapa</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as StatusTarefa)}
                items={t.status}
              >
                <SelectTrigger id="editar-projeto-etapa">
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

            <CamposDeNiveis
              prefixo="editar-projeto"
              valor={niveis}
              aoMudar={setNiveis}
              desabilitado={atualizar.isPending}
            />

            <div className="space-y-2">
              <Label htmlFor="editar-projeto-descricao">Descrição (opcional)</Label>
              <Textarea
                id="editar-projeto-descricao"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
            <Button type="submit" disabled={atualizar.isPending}>
              {t.acoes.salvar}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
