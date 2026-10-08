import { A, Destaque, Documento, Lista, P, Tabela, Termo, type SecaoDoDocumento } from "./documento";
import { CONTROLADOR } from "@/lib/legal/constantes";

const Codigo = ({ children }: { children: string }) => (
  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs break-all">{children}</code>
);

const secoes: SecaoDoDocumento[] = [
  {
    id: "o-que-sao",
    titulo: "O que são cookies e armazenamento local",
    conteudo: (
      <>
        <P>
          <Termo>Cookies</Termo> são pequenos arquivos que um site grava no seu navegador e que
          voltam ao servidor a cada acesso. O <Termo>armazenamento local</Termo> (localStorage e
          sessionStorage) é parecido, mas fica só no seu navegador e nunca é enviado
          automaticamente ao servidor.
        </P>
        <P>
          O Taskon usa os dois apenas para funcionar e para lembrar suas escolhas de interface.
        </P>
      </>
    ),
  },
  {
    id: "cookies",
    titulo: "Cookies que usamos",
    conteudo: (
      <>
        <P>Todos são estritamente necessários e próprios do Taskon:</P>
        <Tabela
          colunas={["Cookie", "Para que serve", "Duração"]}
          linhas={[
            [
              <Codigo key="c">better-auth.session_token</Codigo>,
              "Identifica sua sessão e mantém você conectado. Inacessível a scripts (httpOnly) e enviado só por conexão segura.",
              "Até 30 dias, renovado com o uso",
            ],
            [
              <Codigo key="c">better-auth.session_data</Codigo>,
              "Cópia assinada dos dados da sessão, que evita consultar o banco a cada clique.",
              "5 minutos",
            ],
            [
              <Codigo key="c">better-auth.two_factor</Codigo>,
              "Só para quem ativou a verificação em duas etapas: guarda, entre a senha e o código, que a senha já foi aceita.",
              "Alguns minutos, até confirmar o código",
            ],
            [
              <Codigo key="c">better-auth.trust_device</Codigo>,
              "Só se você marcar \"confiar neste dispositivo\": dispensa o código neste navegador.",
              "30 dias",
            ],
            [
              "Cookies temporários do login social",
              "Protegem a ida e a volta ao Google ou ao GitHub contra falsificação de requisições.",
              "Alguns minutos, até concluir o login",
            ],
          ]}
        />
        <P>
          Em produção, os nomes podem vir com o prefixo <Codigo>__Secure-</Codigo>, que obriga o
          navegador a só enviá-los por HTTPS.
        </P>
      </>
    ),
  },
  {
    id: "armazenamento-local",
    titulo: "Armazenamento local",
    conteudo: (
      <Tabela
        colunas={["Item", "Para que serve", "Duração"]}
        linhas={[
          [<Codigo key="c">theme</Codigo>, "Tema escolhido: claro, escuro ou do sistema.", "Até você limpar os dados do navegador"],
          [
            <span key="c" className="flex flex-col items-start gap-1">
              <Codigo>taskon:abas</Codigo>
              <Codigo>taskon:aba-ativa</Codigo>
            </span>,
            "Abas abertas no topo do app e qual delas estava ativa, para reabrir de onde você parou.",
            "Até você limpar os dados do navegador",
          ],
          [
            <span key="c" className="flex flex-col items-start gap-1">
              <Codigo>taskon:sidebar-recolhida</Codigo>
              <Codigo>taskon:area</Codigo>
            </span>,
            "Se a barra lateral está recolhida e qual área dela estava aberta.",
            "Até você limpar os dados do navegador",
          ],
          [
            <Codigo key="c">taskon:equipe-aba</Codigo>,
            "Última seção visitada de cada equipe.",
            "Até você limpar os dados do navegador",
          ],
          [
            <Codigo key="c">taskon:aceite-pendente</Codigo>,
            "Guarda, durante o cadastro pelo Google ou GitHub, que você marcou o aceite dos Termos de uso.",
            "Apagado ao concluir o login ou ao fechar a aba",
          ],
        ]}
      />
    ),
  },
  {
    id: "terceiros",
    titulo: "Cookies de terceiros",
    conteudo: (
      <>
        <P>
          O Taskon não usa cookies de publicidade, de análise de audiência nem de redes sociais, e
          não carrega rastreadores de terceiros. As fontes e imagens são servidas pelo próprio
          Taskon.
        </P>
        <P>
          Quando você escolhe entrar com Google ou GitHub, é levado ao site deles, que aplicam as
          próprias políticas de cookies.
        </P>
      </>
    ),
  },
  {
    id: "base-legal",
    titulo: "Por que não pedimos consentimento",
    conteudo: (
      <Destaque>
        Cookies estritamente necessários são indispensáveis para prestar o serviço que você
        solicitou e, segundo o Guia Orientativo sobre Cookies da ANPD, não dependem de
        consentimento. Por isso o Taskon não exibe um banner de cookies. Se um dia passarmos a usar
        cookies não necessários, pediremos sua permissão antes, com a opção de recusar.
      </Destaque>
    ),
  },
  {
    id: "gerenciar",
    titulo: "Como gerenciar",
    conteudo: (
      <>
        <P>Você pode apagar ou bloquear cookies e o armazenamento local nas configurações do navegador:</P>
        <Lista>
          <li>
            <Termo>Apagar os cookies</Termo> encerra sua sessão: basta entrar de novo.
          </li>
          <li>
            <Termo>Bloquear os cookies</Termo> do Taskon impede o login.
          </li>
          <li>
            <Termo>Limpar o armazenamento local</Termo> devolve tema, abas e barra lateral ao
            padrão. Nada da sua conta é perdido.
          </li>
        </Lista>
      </>
    ),
  },
  {
    id: "contato",
    titulo: "Fale conosco",
    conteudo: (
      <P>
        Dúvidas sobre esta política: <A href={`mailto:${CONTROLADOR.email}`}>{CONTROLADOR.email}</A>.
        Para saber como tratamos seus dados de forma geral, leia a{" "}
        <A href="/privacidade">Política de privacidade</A>.
      </P>
    ),
  },
];

export function PoliticaDeCookies() {
  return (
    <Documento
      titulo="Política de cookies"
      secoes={secoes}
      resumo={
        <p>
          O Taskon só usa cookies estritamente necessários para manter você conectado, e o
          armazenamento local do navegador para lembrar preferências de interface. Não há cookies
          de publicidade, análise ou rastreamento.
        </p>
      }
    />
  );
}
