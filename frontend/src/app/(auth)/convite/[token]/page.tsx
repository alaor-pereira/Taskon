"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, get } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { t } from "@/lib/messages";
import { useResponderConvite } from "@/lib/queries/notifications";

interface ConvitePublico {
  id: string;
  email: string;
  role: string;
  equipe: { id: string; name: string; description: string | null } | null;
  expirado: boolean;
  status: string;
}

/**
 * Tela aberta pelo link do convite por e-mail.
 *
 * Funciona com ou sem sessão: quem ainda não tem conta precisa ver de qual
 * equipe é o convite antes de decidir se cria uma. A consulta por token
 * devolve só o nome e a descrição da equipe.
 */
export default function ConvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { data: sessao, isPending: carregandoSessao } = useSession();
  const responder = useResponderConvite();

  const { data, isPending, error } = useQuery({
    queryKey: ["convite", "token", token],
    queryFn: () => get<ConvitePublico>(`/api/convites/token/${token}`),
    retry: false,
  });

  if (isPending || carregandoSessao) {
    return <div className="h-32 animate-pulse rounded-lg bg-muted" />;
  }

  if (error || !data) {
    return (
      <Cartao
        titulo="Convite não encontrado"
        texto="Este link é inválido ou o convite foi cancelado."
        acao={<Button render={<Link href="/entrar" />} variant="outline" className="w-full">Ir para o acesso</Button>}
      />
    );
  }

  if (data.expirado || data.status !== "PENDENTE") {
    return (
      <Cartao
        titulo={data.expirado ? "Convite expirado" : "Convite já respondido"}
        texto={
          data.expirado
            ? "Convites valem por 7 dias. Peça um novo a quem administra a equipe."
            : "Este convite já foi aceito ou recusado."
        }
        acao={<Button render={<Link href="/entrar" />} variant="outline" className="w-full">Ir para o acesso</Button>}
      />
    );
  }

  const logado = Boolean(sessao?.user);

  // Sem conta, o caminho é cadastrar-se com o mesmo e-mail: ao criar a conta,
  // o convite passa a aparecer na lista de notificações.
  if (!logado) {
    return (
      <Cartao
        titulo={`Convite para ${data.equipe?.name ?? "uma equipe"}`}
        texto={`O convite foi enviado para ${data.email}. Crie sua conta com esse endereço para aceitá-lo.`}
        acao={
          <div className="grid gap-2">
            <Button render={<Link href="/cadastrar" />} className="w-full">
              {t.auth.criarConta}
            </Button>
            <Button render={<Link href="/entrar" />} variant="outline" className="w-full">
              {t.auth.jaTenhoConta}
            </Button>
          </div>
        }
      />
    );
  }

  async function decidir(aceitar: boolean) {
    if (!data) return;
    try {
      await responder.mutateAsync({ id: data.id, aceitar });
      toast.success(aceitar ? "Você entrou na equipe." : "Convite recusado.");
      router.push("/");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t.erros.generico);
    }
  }

  return (
    <Cartao
      titulo={`Convite para ${data.equipe?.name ?? "uma equipe"}`}
      texto={
        data.equipe?.description ??
        "Você foi convidado a participar desta equipe no Taskon."
      }
      acao={
        <div className="grid gap-2">
          <Button
            className="w-full"
            onClick={() => decidir(true)}
            disabled={responder.isPending}
          >
            Aceitar convite
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => decidir(false)}
            disabled={responder.isPending}
          >
            Recusar
          </Button>
        </div>
      }
    />
  );
}

function Cartao({
  titulo,
  texto,
  acao,
}: {
  titulo: string;
  texto: string;
  acao: React.ReactNode;
}) {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
      <p className="text-sm text-muted-foreground">{texto}</p>
      {acao}
    </div>
  );
}
