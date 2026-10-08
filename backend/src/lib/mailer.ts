import { env, isProduction } from "../config/env.js";

/**
 * Envio de e-mail. Sem `RESEND_API_KEY`, nada sai da máquina: a mensagem é
 * registrada no console, o que mantém o fluxo de verificação utilizável em
 * desenvolvimento sem depender de um serviço externo.
 */

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function enviarEmail(email: Email): Promise<void> {
  if (!env.RESEND_API_KEY) {
    imprimirNoConsole(email, "RESEND_API_KEY ausente");
    return;
  }

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (resposta.ok) return;

  const corpo = await resposta.text().catch(() => "");
  const motivo = `Resend respondeu ${resposta.status}: ${corpo}`;

  if (isProduction) {
    // Em produção, uma falha de envio não pode passar em silêncio: quem chamou
    // precisa saber que o convite ou a verificação não chegaram ao destino.
    throw new Error(`Falha ao enviar e-mail. ${motivo}`);
  }

  // Em desenvolvimento, propagar o erro só esconderia o link atrás de uma pilha
  // de chamadas. Como o envio costuma falhar por configuração — domínio não
  // verificado, remetente inválido —, o conteúdo vai para o console e o fluxo
  // continua utilizável.
  imprimirNoConsole(email, motivo);
}

function imprimirNoConsole(email: Email, motivo: string): void {
  console.info(
    [
      "",
      `─── E-mail NÃO enviado (${motivo}) ───`,
      `Para:     ${email.to}`,
      `Assunto:  ${email.subject}`,
      "",
      email.text,
      "──────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}

const ENTIDADES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escapa texto para entrar no HTML de um e-mail. Todo dado que veio de um
 * usuário (nome de equipe, nome de quem convida) passa por aqui: sem isso,
 * alguém poderia montar um e-mail de phishing saindo do endereço do Taskon.
 */
export const escaparHtml = (texto: string) => texto.replace(/[&<>"']/g, (c) => ENTIDADES[c]!);

/**
 * Camada mínima de formatação, para os e-mails terem a mesma cara.
 * `titulo`, o texto do botão e a URL são escapados aqui; `corpo` é HTML e
 * quem chama escapa o que for dado de usuário dentro dele.
 */
export function layoutEmail(titulo: string, corpo: string, acao?: { texto: string; url: string }): string {
  const url = acao && escaparHtml(acao.url);
  const botao = acao
    ? `<p style="margin:32px 0"><a href="${url}" style="background:#18181b;color:#fafafa;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">${escaparHtml(acao.texto)}</a></p>
       <p style="color:#71717a;font-size:13px">Se o botão não funcionar, copie este endereço:<br><span style="color:#3f3f46">${url}</span></p>`
    : "";
  titulo = escaparHtml(titulo);

  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:32px;background:#fafafa;font-family:ui-sans-serif,system-ui,sans-serif;color:#18181b">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:32px">
    <p style="font-weight:600;font-size:18px;letter-spacing:-0.02em;margin:0 0 24px">Taskon</p>
    <h1 style="font-size:20px;font-weight:600;margin:0 0 12px">${titulo}</h1>
    <div style="font-size:15px;line-height:1.6;color:#3f3f46">${corpo}</div>
    ${botao}
  </div>
</body></html>`;
}
