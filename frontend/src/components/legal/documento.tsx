import type { ReactNode } from "react";
import { dataPorExtenso } from "@/lib/datas";
import { VERSAO_DOS_TERMOS } from "@/lib/legal/constantes";
import { cn } from "@/lib/utils";

/**
 * Casca dos documentos legais: título, data de atualização, resumo, índice
 * lateral e as seções numeradas. Cada documento é só uma lista de seções —
 * o índice sai dela, então nunca fica desatualizado.
 */

export interface SecaoDoDocumento {
  id: string;
  titulo: string;
  conteudo: ReactNode;
}

// Meio-dia local: a data pura não volta um dia em fusos negativos.
const atualizadoEm = dataPorExtenso(new Date(`${VERSAO_DOS_TERMOS}T12:00:00`));

export function Documento({
  titulo,
  resumo,
  secoes,
}: {
  titulo: string;
  resumo: ReactNode;
  secoes: SecaoDoDocumento[];
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-16">
      <article className="min-w-0 max-w-[68ch]">
        <header className="space-y-3 border-b pb-8">
          <p className="text-label">Documento legal</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {titulo}
          </h1>
          <p className="text-sm text-muted-foreground">
            Última atualização: <time dateTime={VERSAO_DOS_TERMOS}>{atualizadoEm}</time>
          </p>
        </header>

        <div className="mt-8 rounded-lg border bg-card p-5">
          <p className="heading-subtle mb-2">Em resumo</p>
          <div className="space-y-2 text-sm leading-6 text-muted-foreground">{resumo}</div>
        </div>

        <div className="mt-10 space-y-10">
          {secoes.map((secao, i) => (
            <section key={secao.id} id={secao.id} className="scroll-mt-36 space-y-4">
              <h2 className="flex items-baseline gap-3 font-heading text-lg font-semibold tracking-tight text-foreground">
                <span className="text-data text-sm text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {secao.titulo}
              </h2>
              {secao.conteudo}
            </section>
          ))}
        </div>
      </article>

      <nav aria-label="Nesta página" className="hidden lg:block">
        <div className="sticky top-36 space-y-3">
          <p className="text-label">Nesta página</p>
          <ol className="space-y-1.5 border-l">
            {secoes.map((secao) => (
              <li key={secao.id}>
                <a
                  href={`#${secao.id}`}
                  className="-ml-px block border-l border-transparent py-0.5 pl-3 text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  {secao.titulo}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>
    </div>
  );
}

/* --- Tipografia dos documentos ------------------------------------------ */

export function P({ children }: { children: ReactNode }) {
  return <p className="text-[15px] leading-7 text-foreground/85">{children}</p>;
}

export function Lista({ children, numerada }: { children: ReactNode; numerada?: boolean }) {
  const Tag = numerada ? "ol" : "ul";
  return (
    <Tag
      className={cn(
        "space-y-2 pl-5 text-[15px] leading-7 text-foreground/85 marker:text-muted-foreground",
        numerada ? "list-decimal" : "list-disc",
      )}
    >
      {children}
    </Tag>
  );
}

/** Termo em destaque no início de um item de lista ("Nome: ..."). */
export function Termo({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

/** Aviso que merece sair do fluxo do texto. */
export function Destaque({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-foreground/85">
      {children}
    </div>
  );
}

export function Tabela({
  colunas,
  linhas,
}: {
  colunas: string[];
  linhas: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="bg-muted/50">
          <tr>
            {colunas.map((coluna) => (
              <th key={coluna} scope="col" className="px-3 py-2 text-label">
                {coluna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {linhas.map((linha, i) => (
            <tr key={i} className="align-top">
              {linha.map((celula, j) => (
                <td key={j} className="px-3 py-2.5 leading-5 text-foreground/85">
                  {celula}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Link no corpo do texto. Endereços externos abrem em nova aba. */
export function A({ href, children }: { href: string; children: ReactNode }) {
  const externo = /^(https?:|mailto:)/.test(href);
  return (
    <a
      href={href}
      className="text-link underline underline-offset-4 decoration-link/40 hover:decoration-link"
      {...(externo && !href.startsWith("mailto:") && { target: "_blank", rel: "noopener noreferrer" })}
    >
      {children}
    </a>
  );
}
