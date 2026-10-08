"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAbas } from "@/components/tabs/tabs-context";
import { signOut } from "@/lib/auth-client";

/**
 * Saída da conta, igual em todo o app.
 *
 * Além de encerrar a sessão, apaga o que ficou deste usuário no navegador: as
 * abas abertas (que guardam títulos de projetos e tarefas no localStorage) e
 * os dados em cache. Num computador compartilhado, a próxima pessoa não vê
 * nada disso.
 */
export function useSair() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { fecharTodas } = useAbas();

  return async function sair() {
    // Quem acabou de excluir a conta já não tem sessão: o erro não importa.
    await signOut().catch(() => undefined);
    fecharTodas();
    queryClient.clear();
    router.push("/entrar");
    router.refresh();
  };
}
