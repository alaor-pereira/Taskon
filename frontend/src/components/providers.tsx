"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { TabsProvider } from "@/components/tabs/tabs-context";

export function Providers({ children, nonce }: { children: ReactNode; nonce?: string }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Não há atualização em tempo real: os dados são revalidados ao
            // voltar para a janela e depois de cada ação de escrita.
            refetchOnWindowFocus: true,
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        // O script que aplica o tema antes da primeira pintura é inline:
        // sem o nonce da CSP, o navegador o bloquearia.
        nonce={nonce}
      >
        <TooltipProvider delay={300}>
          <TabsProvider>
            {children}
            <Toaster position="bottom-right" />
          </TabsProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
