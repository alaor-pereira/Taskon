"use client";

import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

/**
 * Tour guiado: destaca cada parte da tela com um balão explicativo. Os alvos
 * são marcados com `data-tour="…"` nos próprios componentes.
 */
type Lado = NonNullable<DriveStep["popover"]>["side"];

const PASSOS: Array<{ alvo: string; titulo: string; texto: string; lado: Lado }> = [
  {
    alvo: "areas",
    titulo: "Áreas do sistema",
    texto:
      "Home, Equipes, Projetos, Tarefas e Agenda. Cada ícone troca as seções da barra lateral e abre a página da área numa aba.",
    lado: "right",
  },
  {
    alvo: "busca",
    titulo: "Busca",
    texto: "Encontre projetos, tarefas e equipes digitando pelo menos duas letras.",
    lado: "right",
  },
  {
    alvo: "abas",
    titulo: "Abas",
    texto:
      "Cada página aberta vira uma aba, como no navegador. Alterne entre elas sem perder o que estava fazendo; feche com o X.",
    lado: "bottom",
  },
  {
    alvo: "conteudo",
    titulo: "Conteúdo da aba",
    texto:
      "Aqui fica a página ativa. Em projetos e tarefas, escolha entre Cards, Kanban e Lista, use os filtros e arraste cartões no Kanban para mudar a etapa.",
    lado: "left",
  },
  {
    alvo: "notificacoes",
    titulo: "Notificações",
    texto:
      "Avisos de tarefas, comentários, reuniões e convites. O que chega aqui pode ser ajustado em Configurações > Notificações.",
    lado: "top",
  },
  {
    alvo: "conta",
    titulo: "Sua conta",
    texto: "Acesse Meu perfil, Configurações (notificações, tema e ajuda), a Lixeira e Sair.",
    lado: "top",
  },
];

/** O elemento existe e está visível (no celular, a barra lateral fica oculta). */
function visivel(elemento: Element | null): elemento is HTMLElement {
  if (!(elemento instanceof HTMLElement)) return false;
  const caixa = elemento.getBoundingClientRect();
  return (
    caixa.width > 0 &&
    caixa.height > 0 &&
    caixa.right > 0 &&
    caixa.left < window.innerWidth
  );
}

export function iniciarTour() {
  const passos: DriveStep[] = PASSOS.flatMap((passo) => {
    const elemento = document.querySelector(`[data-tour="${passo.alvo}"]`);
    if (!visivel(elemento)) return [];
    return [
      {
        element: elemento,
        popover: { title: passo.titulo, description: passo.texto, side: passo.lado, align: "start" },
      },
    ];
  });

  if (passos.length === 0) return;

  driver({
    steps: passos,
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Próximo",
    prevBtnText: "Voltar",
    doneBtnText: "Concluir",
    allowClose: true,
    popoverClass: "taskon-tour",
    stagePadding: 6,
    stageRadius: 10,
  }).drive();
}
