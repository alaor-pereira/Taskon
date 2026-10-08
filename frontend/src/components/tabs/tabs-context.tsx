"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Abas internas do Header.
 *
 * Cada página aberta vira uma aba; o usuário alterna entre elas sem fechar as
 * anteriores. O conjunto fica no localStorage: é conveniência por dispositivo,
 * não estado que precise atravessar navegadores. A visualização escolhida
 * (Cards/Kanban/Lista), essa sim, mora no banco.
 */

export type TipoAba =
  | "dashboard"
  | "projeto"
  | "tarefa"
  | "equipe"
  | "lista"
  | "agenda"
  | "perfil"
  | "configuracoes";

export interface Aba {
  /** Identidade da aba. Reabrir o mesmo recurso foca a aba em vez de duplicar. */
  id: string;
  tipo: TipoAba;
  titulo: string;
  /** Recurso de origem, quando a aba representa um projeto, tarefa ou equipe. */
  recursoId?: string;
}

interface TabsContextValue {
  abas: Aba[];
  abaAtivaId: string | null;
  abaAtiva: Aba | null;
  abrirAba: (aba: Aba) => void;
  fecharAba: (id: string) => void;
  ativarAba: (id: string) => void;
  fecharTodas: () => void;
  /** Falso até o localStorage ser lido, para não piscar abas na hidratação. */
  pronto: boolean;
}

const TabsContext = createContext<TabsContextValue | null>(null);

const CHAVE_ABAS = "taskon:abas";
const CHAVE_ATIVA = "taskon:aba-ativa";

export function TabsProvider({ children }: { children: ReactNode }) {
  const [abas, setAbas] = useState<Aba[]>([]);
  const [abaAtivaId, setAbaAtivaId] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  // Restaura as abas da sessão anterior.
  useEffect(() => {
    try {
      const salvas = localStorage.getItem(CHAVE_ABAS);
      const ativa = localStorage.getItem(CHAVE_ATIVA);
      if (salvas) {
        const lista = JSON.parse(salvas) as Aba[];
        if (Array.isArray(lista)) {
          setAbas(lista);
          setAbaAtivaId(ativa && lista.some((a) => a.id === ativa) ? ativa : lista[0]?.id ?? null);
        }
      }
    } catch {
      // localStorage pode estar bloqueado (janela privada, cookies negados).
      // A ausência de abas restauradas não impede o uso do sistema.
    }
    setPronto(true);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    try {
      localStorage.setItem(CHAVE_ABAS, JSON.stringify(abas));
      if (abaAtivaId) localStorage.setItem(CHAVE_ATIVA, abaAtivaId);
      else localStorage.removeItem(CHAVE_ATIVA);
    } catch {
      // Silencioso pelo mesmo motivo acima.
    }
  }, [abas, abaAtivaId, pronto]);

  const abrirAba = useCallback((nova: Aba) => {
    setAbas((atuais) =>
      atuais.some((a) => a.id === nova.id) ? atuais : [...atuais, nova],
    );
    setAbaAtivaId(nova.id);
  }, []);

  const fecharAba = useCallback((id: string) => {
    setAbas((atuais) => {
      const indice = atuais.findIndex((a) => a.id === id);
      if (indice === -1) return atuais;
      const restantes = atuais.filter((a) => a.id !== id);

      setAbaAtivaId((ativa) => {
        if (ativa !== id) return ativa;
        // Ao fechar a aba ativa, foca a vizinha à esquerda — o comportamento
        // esperado em navegadores e editores.
        const vizinha = restantes[indice - 1] ?? restantes[indice] ?? null;
        return vizinha?.id ?? null;
      });

      return restantes;
    });
  }, []);

  const ativarAba = useCallback((id: string) => setAbaAtivaId(id), []);

  const fecharTodas = useCallback(() => {
    setAbas([]);
    setAbaAtivaId(null);
  }, []);

  const valor = useMemo<TabsContextValue>(
    () => ({
      abas,
      abaAtivaId,
      abaAtiva: abas.find((a) => a.id === abaAtivaId) ?? null,
      abrirAba,
      fecharAba,
      ativarAba,
      fecharTodas,
      pronto,
    }),
    [abas, abaAtivaId, abrirAba, fecharAba, ativarAba, fecharTodas, pronto],
  );

  return <TabsContext.Provider value={valor}>{children}</TabsContext.Provider>;
}

export function useAbas(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("useAbas precisa estar dentro de TabsProvider.");
  return ctx;
}
