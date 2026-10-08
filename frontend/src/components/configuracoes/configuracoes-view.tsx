"use client";

import {
  ArrowDown01Icon,
  ComputerIcon,
  HelpCircleIcon,
  Moon02Icon,
  Notification03Icon,
  PaintBoardIcon,
  PlugSocketIcon,
  Route01Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { useTheme } from "next-themes";
import { useState, type ReactNode } from "react";
import { CartaoGoogleAgenda } from "@/components/integracoes/google-agenda";
import { SeletorSegmentado } from "@/components/seletor-segmentado";
import { iniciarTour } from "@/components/tour/tour";
import { Button } from "@/components/ui/button";
import { Icone, type IconSvgElement } from "@/components/ui/icone";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/messages";
import { useNotificacoesDesativadas } from "@/lib/queries/preferences";
import { cn } from "@/lib/utils";
import { GRUPOS_DE_NOTIFICACAO } from "./grupos-de-notificacao";
import { PERGUNTAS_FREQUENTES } from "./perguntas-frequentes";

type Secao = "notificacoes" | "integracoes" | "tema" | "ajuda";

const SECOES: Array<{ valor: Secao; rotulo: ReactNode }> = [
  { valor: "notificacoes", rotulo: rotuloComIcone(Notification03Icon, "Notificações") },
  { valor: "integracoes", rotulo: rotuloComIcone(PlugSocketIcon, "Integrações") },
  { valor: "tema", rotulo: rotuloComIcone(PaintBoardIcon, "Tema") },
  { valor: "ajuda", rotulo: rotuloComIcone(HelpCircleIcon, "Ajuda") },
];

function rotuloComIcone(icone: IconSvgElement, texto: string) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icone icon={icone} className="size-3.5" aria-hidden />
      {texto}
    </span>
  );
}

/** Configurações da conta: notificações, integrações, tema e ajuda (com o tour guiado). */
export function ConfiguracoesView() {
  const [secao, setSecao] = useState<Secao>("notificacoes");

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="heading-section">{t.paginas.configuracoes}</h1>
          <SeletorSegmentado
            opcoes={SECOES}
            valor={secao}
            aoMudar={setSecao}
            rotulo="Seções das configurações"
          />
        </div>

        {secao === "notificacoes" && <SecaoNotificacoes />}
        {secao === "integracoes" && <SecaoIntegracoes />}
        {secao === "tema" && <SecaoTema />}
        {secao === "ajuda" && <SecaoAjuda />}
      </div>
    </div>
  );
}

function SecaoNotificacoes() {
  const { desativadas, carregando, definir } = useNotificacoesDesativadas();

  function alternar(chave: string, ligada: boolean) {
    definir(ligada ? desativadas.filter((c) => c !== chave) : [...desativadas, chave]);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Escolha os avisos que você quer receber. A escolha vale só para você — não muda o que
        as outras pessoas recebem.
      </p>

      {GRUPOS_DE_NOTIFICACAO.map((grupo) => (
        <section key={grupo.titulo} className="rounded-lg border bg-card">
          <h2 className="heading-subtle border-b px-5 py-3">{grupo.titulo}</h2>
          <ul className="divide-y">
            {grupo.itens.map((item) => {
              const fixo = item.chave === null;
              const ligada = fixo || !desativadas.includes(item.chave!);
              const id = `notificacao-${item.chave ?? item.rotulo}`;
              return (
                <li key={id} className="flex items-center gap-4 px-5 py-3">
                  <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block text-sm font-medium">{item.rotulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {item.descricao}
                      {fixo && " Sempre ativo, porque pede uma resposta sua."}
                    </span>
                  </label>
                  <Switch
                    id={id}
                    checked={ligada}
                    disabled={fixo || carregando}
                    onCheckedChange={(valor) => item.chave && alternar(item.chave, valor)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

const TEMAS: Array<{ valor: string; rotulo: string; icone: IconSvgElement; previa: string }> = [
  { valor: "light", rotulo: t.tema.claro, icone: Sun03Icon, previa: "bg-white" },
  { valor: "dark", rotulo: t.tema.escuro, icone: Moon02Icon, previa: "bg-neutral-900" },
  {
    valor: "system",
    rotulo: t.tema.sistema,
    icone: ComputerIcon,
    previa: "bg-[linear-gradient(135deg,#fff_50%,#171717_50%)]",
  },
];

function SecaoIntegracoes() {
  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="heading-subtle">Integrações</h2>
        <p className="text-sm text-muted-foreground">
          Serviços externos que recebem dados do Taskon. Nada é enviado sem a sua autorização, e
          você pode desconectar a qualquer momento.
        </p>
      </div>
      <CartaoGoogleAgenda />
    </section>
  );
}

function SecaoTema() {
  const { theme, setTheme } = useTheme();

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="heading-subtle">Aparência</h2>
        <p className="text-sm text-muted-foreground">
          &ldquo;Sistema&rdquo; acompanha o modo claro ou escuro do seu dispositivo. A escolha
          fica salva neste navegador.
        </p>
      </div>

      <div role="radiogroup" aria-label="Tema" className="grid gap-3 sm:grid-cols-3">
        {TEMAS.map((tema) => {
          const ativo = (theme ?? "system") === tema.valor;
          return (
            <button
              key={tema.valor}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => setTheme(tema.valor)}
              className={cn(
                "group rounded-lg border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring",
                ativo ? "border-primary ring-1 ring-primary" : "hover:border-ring/40",
              )}
            >
              <span
                aria-hidden
                className={cn("block h-16 rounded-md border", tema.previa)}
              />
              <span className="mt-2 flex items-center gap-1.5 px-1 text-sm font-medium">
                <Icone icon={tema.icone} className="size-4 text-muted-foreground" />
                {tema.rotulo}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SecaoAjuda() {
  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-5">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icone icon={Route01Icon} className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="heading-subtle">Conheça o Taskon em 1 minuto</h2>
          <p className="text-sm text-muted-foreground">
            O tour destaca cada parte da tela e explica para que ela serve.
          </p>
        </div>
        <Button onClick={iniciarTour}>Fazer tour</Button>
      </section>

      <section className="rounded-lg border bg-card">
        <h2 className="heading-subtle border-b px-5 py-3">Dúvidas frequentes</h2>
        <div className="divide-y">
          {PERGUNTAS_FREQUENTES.map((item) => (
            <details key={item.pergunta} className="group px-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                {item.pergunta}
                <Icone
                  icon={ArrowDown01Icon}
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-muted-foreground">
                {item.resposta}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
