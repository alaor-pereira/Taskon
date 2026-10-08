"use client";

import { ComputerIcon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icone } from "@/components/ui/icone";
import { listSessions, revokeOtherSessions, revokeSession, useSession } from "@/lib/auth-client";
import { t } from "@/lib/messages";

/**
 * Onde a conta está conectada. As sessões duram 30 dias: esta lista é o
 * jeito de cortar um acesso esquecido (ou roubado) sem trocar a senha.
 */

const CHAVE = ["perfil", "sessoes"] as const;

interface Sessao {
  id: string;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  updatedAt: string | Date;
}

/** "Chrome no Windows" a partir do user-agent; o resto do texto não interessa. */
function dispositivo(ua: string | null | undefined): { rotulo: string; celular: boolean } {
  if (!ua) return { rotulo: "Dispositivo desconhecido", celular: false };
  const navegador = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navegador";
  const sistema = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  return {
    rotulo: sistema ? `${navegador} no ${sistema}` : navegador,
    celular: /Android|iPhone|iPad|Mobile/.test(ua),
  };
}

export function SessoesAtivas() {
  const queryClient = useQueryClient();
  const { data: atual } = useSession();
  const idAtual = atual?.session.id;

  const { data: sessoes, isLoading } = useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const { data, error } = await listSessions();
      if (error) throw new Error(error.message ?? t.erros.generico);
      return data as Sessao[];
    },
  });

  const encerrar = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await revokeSession({ token });
      if (error) throw new Error(error.message ?? t.erros.generico);
    },
    onSuccess: () => {
      toast.success("Sessão encerrada.");
      queryClient.invalidateQueries({ queryKey: CHAVE });
    },
    onError: (e) => toast.error(e.message),
  });

  const encerrarOutras = useMutation({
    mutationFn: async () => {
      const { error } = await revokeOtherSessions();
      if (error) throw new Error(error.message ?? t.erros.generico);
    },
    onSuccess: () => {
      toast.success("As outras sessões foram encerradas.");
      queryClient.invalidateQueries({ queryKey: CHAVE });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !sessoes) {
    return <div className="h-14 animate-pulse rounded-lg bg-muted" />;
  }

  // A sessão deste navegador primeiro; depois, as usadas mais recentemente.
  const ordenadas = [...sessoes].sort((a, b) =>
    a.id === idAtual ? -1 : b.id === idAtual ? 1 : +new Date(b.updatedAt) - +new Date(a.updatedAt),
  );
  const haOutras = ordenadas.some((s) => s.id !== idAtual);

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-lg border">
        {ordenadas.map((sessao) => {
          const { rotulo, celular } = dispositivo(sessao.userAgent);
          const estaAqui = sessao.id === idAtual;
          return (
            <li key={sessao.id} className="flex items-center gap-3 px-3 py-2.5">
              <Icone
                icon={celular ? SmartPhone01Icon : ComputerIcon}
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {rotulo}
                  {estaAqui && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      Este dispositivo
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {sessao.ipAddress ? `IP ${sessao.ipAddress} · ` : ""}
                  ativa{" "}
                  {formatDistanceToNow(new Date(sessao.updatedAt), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              {!estaAqui && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={encerrar.isPending}
                  onClick={() => encerrar.mutate(sessao.token)}
                >
                  Encerrar
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {haOutras && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={encerrarOutras.isPending}
            onClick={() => encerrarOutras.mutate()}
          >
            Encerrar todas as outras
          </Button>
        </div>
      )}
    </div>
  );
}
