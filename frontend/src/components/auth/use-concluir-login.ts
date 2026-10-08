"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAbas } from "@/components/tabs/tabs-context";
import { useSession } from "@/lib/auth-client";
import { t } from "@/lib/messages";

/**
 * O que acontece depois que a sessão existe: vale para o login por senha e
 * para a confirmação do segundo fator.
 */
export function useConcluirLogin() {
  const router = useRouter();
  const { fecharTodas, abrirAba } = useAbas();
  const { refetch } = useSession();

  return async function concluir() {
    // Só navega com a sessão nova já carregada: o AppLayout decide se deixa
    // entrar pelo que a sessão diz no primeiro render.
    await refetch();

    // Login explícito sempre abre no Dashboard — reabrir sem deslogar é que
    // restaura as abas de onde a pessoa parou (ver TabsProvider).
    fecharTodas();
    abrirAba({ id: "dashboard", tipo: "dashboard", titulo: t.secoes.dashboard });

    toast.success("Bem-vindo de volta.");
    router.push("/");
  };
}
