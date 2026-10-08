"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { abrirPaginaDaArea } from "@/components/layout/areas/abrir";
import { useAbas } from "@/components/tabs/tabs-context";

const MENSAGENS: Record<string, { tipo: "success" | "error" | "info"; texto: string }> = {
  conectado: {
    tipo: "success",
    texto: "Google Agenda conectado. Seus compromissos aparecem na agenda “Taskon” em instantes.",
  },
  negado: { tipo: "info", texto: "Conexão com o Google cancelada. Nada foi enviado." },
  erro: { tipo: "error", texto: "Não foi possível conectar o Google Agenda." },
};

/**
 * Volta do Google depois de conectar a agenda: o backend redireciona para
 * `/?google=conectado|negado|erro`. Mostra o resultado, abre a Agenda e
 * limpa a URL (o parâmetro não deve voltar num recarregamento).
 */
export function RetornoDoGoogle() {
  const queryClient = useQueryClient();
  const { abrirAba } = useAbas();
  const tratado = useRef(false);

  useEffect(() => {
    if (tratado.current) return;
    const url = new URL(window.location.href);
    const resultado = url.searchParams.get("google");
    if (!resultado) return;
    tratado.current = true;

    const mensagem = MENSAGENS[resultado] ?? MENSAGENS.erro!;
    const motivo = url.searchParams.get("motivo");
    toast[mensagem.tipo](motivo && resultado === "erro" ? `${mensagem.texto} ${motivo}` : mensagem.texto);

    url.searchParams.delete("google");
    url.searchParams.delete("motivo");
    window.history.replaceState(window.history.state, "", url);

    queryClient.invalidateQueries({ queryKey: ["integracoes", "google"] });
    abrirPaginaDaArea(abrirAba, "agenda");
  }, [abrirAba, queryClient]);

  return null;
}
