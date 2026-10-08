"use client";

import {
  Award01Icon,
  Camera01Icon,
  CheckmarkCircle02Icon,
  ComputerIcon,
  GithubIcon,
  GoogleIcon,
  Layers01Icon,
  LockPasswordIcon,
  Mail01Icon,
  SecurityCheckIcon,
} from "@hugeicons/core-free-icons";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icone, type IconSvgElement } from "@/components/ui/icone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { changePassword, updateUser, useSession } from "@/lib/auth-client";
import { dataPorExtenso } from "@/lib/datas";
import { t } from "@/lib/messages";
import {
  useRemoverAvatar,
  useResumoDoPerfil,
  useSalvarAvatar,
} from "@/lib/queries/profile";
import { ExcluirContaDialog } from "./excluir-conta-dialog";
import { mensagemDeConquista } from "./mensagem-de-conquista";
import { SessoesAtivas } from "./sessoes-ativas";
import { VerificacaoEmDuasEtapas } from "./verificacao-em-duas-etapas";
import { recortarParaAvatar } from "./recortar-imagem";

const PROVEDORES: Record<string, { rotulo: string; icone: IconSvgElement }> = {
  credential: { rotulo: "E-mail e senha", icone: Mail01Icon },
  google: { rotulo: "Google", icone: GoogleIcon },
  github: { rotulo: "GitHub", icone: GithubIcon },
};

const mensagemDeErro = (e: unknown) =>
  e instanceof ApiError || e instanceof Error ? e.message : t.erros.generico;

/**
 * Meu perfil: foto, nome e senha editáveis; e-mail, data de cadastro e contas
 * conectadas só para leitura; e um card de conquistas com o que a pessoa já
 * concluiu.
 */
export function PerfilView() {
  const { data: sessao, refetch } = useSession();
  const { data: resumo } = useResumoDoPerfil();
  const usuario = sessao?.user;

  if (!usuario) return null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-6">
        <h1 className="heading-section">{t.paginas.perfil}</h1>

        <CabecalhoDoPerfil
          nome={usuario.name}
          email={usuario.email}
          imagem={usuario.image ?? null}
          membroDesde={resumo?.membroDesde ?? null}
          aoMudar={() => refetch()}
        />

        <Conquistas
          tarefas={resumo?.tarefasConcluidas ?? null}
          projetos={resumo?.projetosConcluidos ?? null}
        />

        <Secao titulo="Dados pessoais">
          <FormularioDeNome nomeAtual={usuario.name} aoSalvar={() => refetch()} />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoDeLeitura rotulo={t.auth.email}>{usuario.email}</CampoDeLeitura>
            <CampoDeLeitura rotulo="Contas conectadas">
              <span className="flex flex-wrap gap-1.5">
                {(resumo?.contas ?? []).map((provedor) => {
                  const info = PROVEDORES[provedor] ?? { rotulo: provedor, icone: Mail01Icon };
                  return (
                    <span
                      key={provedor}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                    >
                      <Icone icon={info.icone} className="size-3.5" aria-hidden />
                      {info.rotulo}
                    </span>
                  );
                })}
              </span>
            </CampoDeLeitura>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-semibold">Excluir conta</p>
              <p className="text-xs text-muted-foreground">
                Apaga seus dados pessoais. Comentários e o histórico compartilhado ficam, sem
                identificar você.
              </p>
            </div>
            <ExcluirContaDialog email={usuario.email} />
          </div>
        </Secao>

        <Secao titulo="Senha" icone={LockPasswordIcon}>
          {resumo === undefined ? null : resumo.temSenha ? (
            <FormularioDeSenha />
          ) : (
            <p className="text-sm text-muted-foreground">
              Você entra com {resumo.contas.includes("github") ? "GitHub" : "Google"}; não há
              senha para alterar.
            </p>
          )}
        </Secao>

        <Secao titulo="Verificação em duas etapas" icone={SecurityCheckIcon}>
          {resumo === undefined ? null : (
            <VerificacaoEmDuasEtapas
              ativa={Boolean(usuario.twoFactorEnabled)}
              temSenha={resumo.temSenha}
              aoMudar={() => refetch()}
            />
          )}
        </Secao>

        <Secao titulo="Sessões ativas" icone={ComputerIcon}>
          <SessoesAtivas />
        </Secao>
      </div>
    </div>
  );
}

function Secao({
  titulo,
  icone,
  children,
}: {
  titulo: string;
  icone?: IconSvgElement;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <h2 className="heading-subtle flex items-center gap-2">
        {icone && <Icone icon={icone} className="size-4 text-muted-foreground" aria-hidden />}
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function CampoDeLeitura({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
      <div className="text-sm wrap-anywhere">{children}</div>
    </div>
  );
}

function CabecalhoDoPerfil({
  nome,
  email,
  imagem,
  membroDesde,
  aoMudar,
}: {
  nome: string;
  email: string;
  imagem: string | null;
  membroDesde: string | null;
  aoMudar: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const salvar = useSalvarAvatar();
  const remover = useRemoverAvatar();
  const ocupado = salvar.isPending || remover.isPending;

  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  async function aoEscolher(arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      const dataUrl = await recortarParaAvatar(arquivo);
      await salvar.mutateAsync(dataUrl);
      aoMudar();
      toast.success("Foto atualizada.");
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      // Permite escolher o mesmo arquivo de novo.
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function aoRemover() {
    try {
      await remover.mutateAsync();
      aoMudar();
      toast.success("Foto removida.");
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-5 rounded-lg border bg-card p-5">
      <div className="relative">
        <Avatar className="size-20">
          {imagem && <AvatarImage src={imagem} alt="" />}
          <AvatarFallback className="text-2xl">{iniciais || "?"}</AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={ocupado}
          aria-label="Trocar foto"
          title="Trocar foto"
          className="absolute -right-1 -bottom-1 inline-flex size-8 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground disabled:opacity-50"
        >
          <Icone icon={Camera01Icon} className="size-4" />
        </button>
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => aoEscolher(e.target.files?.[0])}
        />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-lg font-semibold">{nome}</p>
        <p className="truncate text-sm text-muted-foreground">{email}</p>
        {membroDesde && (
          <p className="text-xs text-muted-foreground">
            Membro desde {dataPorExtenso(membroDesde)}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => entrada.current?.click()} disabled={ocupado}>
          {salvar.isPending ? "Enviando…" : "Trocar foto"}
        </Button>
        {imagem && (
          <Button variant="ghost" size="sm" onClick={aoRemover} disabled={ocupado}>
            Remover
          </Button>
        )}
      </div>
    </section>
  );
}

function Conquistas({ tarefas, projetos }: { tarefas: number | null; projetos: number | null }) {
  const carregando = tarefas === null || projetos === null;

  return (
    <section className="space-y-4 rounded-lg border bg-gradient-to-br from-primary/10 via-card to-card p-5">
      <h2 className="heading-subtle flex items-center gap-2">
        <Icone icon={Award01Icon} className="size-4 text-primary" aria-hidden />
        Conquistas
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Numero
          icone={CheckmarkCircle02Icon}
          valor={tarefas}
          rotulo={tarefas === 1 ? "tarefa concluída" : "tarefas concluídas"}
        />
        <Numero
          icone={Layers01Icon}
          valor={projetos}
          rotulo={projetos === 1 ? "projeto concluído" : "projetos concluídos"}
        />
      </div>

      {!carregando && (
        <p className="text-sm text-muted-foreground">{mensagemDeConquista(tarefas, projetos)}</p>
      )}
    </section>
  );
}

function Numero({
  icone,
  valor,
  rotulo,
}: {
  icone: IconSvgElement;
  valor: number | null;
  rotulo: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background/60 p-4">
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icone icon={icone} className="size-5" aria-hidden />
      </span>
      <div>
        {valor === null ? (
          <div className="h-7 w-10 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums">{valor}</p>
        )}
        <p className="text-xs text-muted-foreground">{rotulo}</p>
      </div>
    </div>
  );
}

function FormularioDeNome({ nomeAtual, aoSalvar }: { nomeAtual: string; aoSalvar: () => void }) {
  const [nome, setNome] = useState(nomeAtual);
  const [salvando, setSalvando] = useState(false);
  const limpo = nome.trim();
  const mudou = limpo.length > 0 && limpo !== nomeAtual;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!mudou) return;
    setSalvando(true);
    const { error } = await updateUser({ name: limpo });
    setSalvando(false);
    if (error) {
      toast.error(error.message ?? t.erros.generico);
      return;
    }
    aoSalvar();
    toast.success("Nome atualizado.");
  }

  return (
    <form onSubmit={enviar} className="flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1 space-y-2">
        <Label htmlFor="perfil-nome">Nome</Label>
        <Input
          id="perfil-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={120}
          autoComplete="name"
        />
      </div>
      <Button type="submit" disabled={!mudou || salvando}>
        {salvando ? "Salvando…" : t.acoes.salvar}
      </Button>
    </form>
  );
}

function FormularioDeSenha() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (nova.length < 8) return setErro("A nova senha precisa ter pelo menos 8 caracteres.");
    if (nova !== confirmacao) return setErro("A confirmação não confere com a nova senha.");

    setSalvando(true);
    const { error } = await changePassword({
      currentPassword: atual,
      newPassword: nova,
      // Quem troca a senha costuma querer derrubar sessões esquecidas.
      revokeOtherSessions: true,
    });
    setSalvando(false);

    if (error) {
      setErro(
        error.code === "INVALID_PASSWORD"
          ? "A senha atual está incorreta."
          : (error.message ?? t.erros.generico),
      );
      return;
    }
    setAtual("");
    setNova("");
    setConfirmacao("");
    toast.success("Senha alterada. As outras sessões foram encerradas.");
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="senha-atual">Senha atual</Label>
        <Input
          id="senha-atual"
          type="password"
          value={atual}
          onChange={(e) => setAtual(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="senha-nova">Nova senha</Label>
          <Input
            id="senha-nova"
            type="password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="senha-confirmacao">Confirmar nova senha</Label>
          <Input
            id="senha-confirmacao"
            type="password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
      </div>

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={salvando || !atual || !nova || !confirmacao}>
          {salvando ? "Alterando…" : "Alterar senha"}
        </Button>
      </div>
    </form>
  );
}
