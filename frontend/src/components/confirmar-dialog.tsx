"use client";

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
import { t } from "@/lib/messages";
import { cn } from "@/lib/utils";

/**
 * Confirmação no padrão do sistema, no lugar do `window.confirm`: mesmo
 * visual do resto da interface e texto que diz exatamente o que vai acontecer.
 */
export function ConfirmarDialog({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar,
  destrutivo = true,
  aoConfirmar,
  aoFechar,
}: {
  aberto: boolean;
  titulo: string;
  descricao: string;
  rotuloConfirmar: string;
  destrutivo?: boolean;
  aoConfirmar: () => void;
  aoFechar: () => void;
}) {
  return (
    <AlertDialog open={aberto} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.acoes.cancelar}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(destrutivo && "bg-destructive text-destructive-foreground")}
            onClick={() => {
              aoFechar();
              aoConfirmar();
            }}
          >
            {rotuloConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
