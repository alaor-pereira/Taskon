import { A, Destaque, Documento, Lista, P, Tabela, Termo, type SecaoDoDocumento } from "./documento";
import { CONTROLADOR, IDADE_MINIMA, PRAZO_DE_RESPOSTA_EM_DIAS } from "@/lib/legal/constantes";

const email = <A href={`mailto:${CONTROLADOR.email}`}>{CONTROLADOR.email}</A>;

const secoes: SecaoDoDocumento[] = [
  {
    id: "controlador",
    titulo: "Quem cuida dos seus dados",
    conteudo: (
      <>
        <P>
          O Taskon é operado por <Termo>{CONTROLADOR.nome}</Termo>, pessoa física, que atua como
          controlador dos seus dados pessoais nos termos da Lei Geral de Proteção de Dados Pessoais
          (Lei nº 13.709/2018, “LGPD”). Isso significa que é quem decide como e por que seus dados
          são tratados e quem responde por isso.
        </P>
        <P>
          Para qualquer assunto sobre seus dados, inclusive para exercer seus direitos, fale com o
          encarregado pelo tratamento de dados pessoais pelo e-mail {email}.
        </P>
      </>
    ),
  },
  {
    id: "dados",
    titulo: "Quais dados coletamos",
    conteudo: (
      <>
        <P>Coletamos apenas o necessário para o Taskon funcionar:</P>
        <Lista>
          <li>
            <Termo>Cadastro:</Termo> nome, e-mail, senha e fuso horário. A senha nunca é guardada
            em texto: armazenamos só um resumo criptográfico (hash Argon2id) dela.
          </li>
          <li>
            <Termo>Login social:</Termo> se você entrar com Google ou GitHub, recebemos desse
            provedor o identificador da sua conta, nome, e-mail, foto e os tokens de acesso
            necessários para concluir o login.
          </li>
          <li>
            <Termo>Perfil:</Termo> a foto que você enviar.
          </li>
          <li>
            <Termo>Conteúdo que você cria:</Termo> equipes, projetos, tarefas, subtarefas,
            comentários e menções, atividades e reuniões da agenda, além dos e-mails das pessoas
            que você convida.
          </li>
          <li>
            <Termo>Preferências:</Termo> visualização escolhida em cada página e avisos que você
            desligou.
          </li>
          <li>
            <Termo>Dados técnicos de acesso:</Termo> endereço IP, navegador e data e hora de cada
            sessão.
          </li>
          <li>
            <Termo>Verificação em duas etapas:</Termo> se você ativar, guardamos o segredo do
            aplicativo autenticador e os códigos de backup, cifrados.
          </li>
          <li>
            <Termo>Integração com o Google Agenda:</Termo> se você conectar, o e-mail da conta
            Google escolhida e as credenciais de acesso à agenda, cifradas.
          </li>
          <li>
            <Termo>Registro de aceite:</Termo> a versão destes documentos que você aceitou, quando,
            de qual IP e navegador.
          </li>
          <li>
            <Termo>Registros de segurança:</Termo> tentativas de login, bloqueios por excesso de
            tentativas e acessos negados, com o identificador da conta, IP e navegador.
          </li>
        </Lista>
        <Destaque>
          Não pedimos dados pessoais sensíveis (como saúde, religião, origem racial ou biometria).
          Evite incluí-los em tarefas e comentários.
        </Destaque>
      </>
    ),
  },
  {
    id: "finalidades",
    titulo: "Para que usamos e com qual base legal",
    conteudo: (
      <>
        <P>
          Todo tratamento tem uma finalidade definida e uma base legal prevista no art. 7º da LGPD:
        </P>
        <Tabela
          colunas={["Finalidade", "Dados", "Base legal"]}
          linhas={[
            [
              "Criar e manter sua conta e autenticar você",
              "Cadastro, login social, dados técnicos",
              "Execução de contrato (art. 7º, V)",
            ],
            [
              "Prestar o serviço: guardar seu conteúdo e mostrá-lo a quem você deu acesso",
              "Conteúdo, perfil",
              "Execução de contrato (art. 7º, V)",
            ],
            [
              "Enviar e-mails do serviço: confirmação de e-mail, redefinição de senha, convites e avisos sobre a conta",
              "Nome, e-mail, e-mails de convidados",
              "Execução de contrato (art. 7º, V)",
            ],
            [
              "Notificar sobre tarefas, menções e reuniões",
              "Conteúdo, preferências",
              "Execução de contrato (art. 7º, V)",
            ],
            [
              "Sincronizar atividades e reuniões com o Google Agenda, se você conectar",
              "Título, horário, repetição, local, descrição e link do Meet",
              "Consentimento (art. 7º, I), revogável ao desconectar",
            ],
            [
              "Proteger contas e prevenir fraudes e abusos",
              "Dados técnicos de acesso",
              "Legítimo interesse (art. 7º, IX)",
            ],
            [
              "Comprovar o aceite destes documentos e cumprir obrigações legais",
              "Registro de aceite, dados técnicos",
              "Obrigação legal e exercício regular de direitos (art. 7º, II e VI)",
            ],
          ]}
        />
        <P>
          Não vendemos seus dados, não os usamos para publicidade e não tomamos decisões
          automatizadas que afetem seus interesses.
        </P>
      </>
    ),
  },
  {
    id: "compartilhamento",
    titulo: "Com quem compartilhamos",
    conteudo: (
      <>
        <Lista>
          <li>
            <Termo>Pessoas com quem você colabora:</Termo> membros das suas equipes, projetos e
            reuniões veem seu nome, foto, e-mail e o que você publica nesses espaços. O acesso
            segue os papéis definidos em cada equipe e projeto.
          </li>
          <li>
            <Termo>Operadores que nos ajudam a prestar o serviço:</Termo> provedores de
            hospedagem e de banco de dados em nuvem; a Resend, que envia nossos e-mails; Google e
            GitHub, quando você escolhe entrar por eles; o Google Agenda, se você conectar a
            integração (veja abaixo); e o serviço Have I Been Pwned, que confere
            se uma senha nova aparece em vazamentos conhecidos. Para essa consulta, só os 5
            primeiros caracteres de um resumo criptográfico da senha saem do Taskon; a senha
            nunca. Eles tratam os dados apenas para essas finalidades.
          </li>
          <li>
            <Termo>Autoridades:</Termo> quando houver obrigação legal ou ordem judicial.
          </li>
        </Lista>
        <P>
          A foto de perfil é servida por um endereço próprio, que funciona para quem o tiver, para
          poder aparecer ao lado do seu nome em todo o sistema.
        </P>
      </>
    ),
  },
  {
    id: "google-agenda",
    titulo: "Integração com o Google Agenda (opcional)",
    conteudo: (
      <>
        <P>
          Se você escolher sincronizar com o Google Agenda, e só depois de concordar com isso na
          tela de conexão, o Taskon cria uma agenda chamada “Taskon” na conta Google que você
          indicar e passa a enviar para ela suas atividades e as reuniões de que participa.
        </P>
        <Lista>
          <li>
            <Termo>O que vai:</Termo> título, data, horário, repetição, local, descrição, link do
            Google Meet e um link para abrir o compromisso no Taskon.
          </li>
          <li>
            <Termo>O que não vai:</Termo> nomes e e-mails de outros participantes (só a
            quantidade), tarefas, projetos e comentários.
          </li>
          <li>
            <Termo>Acesso:</Termo> o Taskon só acessa a agenda que ele mesmo criou. Não lê nem
            altera os seus outros compromissos no Google.
          </li>
          <li>
            <Termo>Google Meet:</Termo> o link de uma reunião é gerado pela agenda Google de quem a
            organiza, a pedido dessa pessoa, e fica visível a todos os participantes no Taskon.
          </li>
        </Lista>
        <P>
          A base legal é o seu consentimento (art. 7º, I). Para revogá-lo, desconecte a integração
          na Agenda ou em Configurações: a agenda “Taskon” é apagada da sua conta Google e o
          acesso é revogado. A partir do envio, os dados também ficam sujeitos à política de
          privacidade do Google.
        </P>
      </>
    ),
  },
  {
    id: "transferencia",
    titulo: "Transferência internacional",
    conteudo: (
      <P>
        Alguns operadores, como Resend, Google, GitHub e provedores de nuvem, podem tratar dados em
        servidores fora do Brasil, principalmente nos Estados Unidos. Essas transferências se
        apoiam nas garantias contratuais oferecidas por esses fornecedores e na necessidade de
        executar o contrato com você (art. 33, II e IX, da LGPD).
      </P>
    ),
  },
  {
    id: "retencao",
    titulo: "Por quanto tempo guardamos",
    conteudo: (
      <>
        <Lista>
          <li>
            <Termo>Enquanto a conta existir:</Termo> cadastro, perfil, conteúdo e preferências.
          </li>
          <li>
            <Termo>Lixeira:</Termo> projetos e tarefas excluídos são apagados de vez após 30 dias.
          </li>
          <li>
            <Termo>Sessões:</Termo> expiram em até 30 dias sem uso. Você vê e encerra as
            sessões abertas em Meu perfil.
          </li>
          <li>
            <Termo>Ao excluir a conta:</Termo> nome, e-mail, foto, senha, contas conectadas,
            sessões, notificações, preferências, a Caixa de entrada, projetos pessoais e atividades
            da agenda são apagados na hora. Comentários, tarefas criadas em projetos de outras
            pessoas, reuniões com outros participantes e o histórico de alterações permanecem, mas
            passam a aparecer como “Usuário removido”, sem identificar você.
          </li>
          <li>
            <Termo>Registro de aceite:</Termo> é mantido mesmo após a exclusão da conta, pelo
            prazo necessário para comprovar o cumprimento da lei e defender direitos (art. 16, I, e
            art. 7º, VI).
          </li>
        </Lista>
        <P>
          Cópias de segurança dos provedores podem conter dados apagados por um período limitado,
          até serem substituídas.
        </P>
      </>
    ),
  },
  {
    id: "direitos",
    titulo: "Seus direitos",
    conteudo: (
      <>
        <P>Pelo art. 18 da LGPD, você pode, a qualquer momento:</P>
        <Lista>
          <li>confirmar se tratamos seus dados e acessá-los;</li>
          <li>corrigir dados incompletos, inexatos ou desatualizados;</li>
          <li>
            pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários, excessivos ou
            tratados em desconformidade com a lei;
          </li>
          <li>pedir a portabilidade dos seus dados a outro fornecedor;</li>
          <li>pedir a eliminação dos seus dados, ressalvadas as hipóteses de guarda do art. 16;</li>
          <li>saber com quem compartilhamos seus dados;</li>
          <li>revogar consentimentos e se opor a tratamentos que descumpram a lei;</li>
          <li>apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).</li>
        </Lista>
        <P>
          Em <Termo>Meu perfil</Termo> você mesmo altera nome, foto e senha e pode{" "}
          <Termo>excluir sua conta</Termo>. Para os demais pedidos, escreva para {email}.
          Respondemos em até {PRAZO_DE_RESPOSTA_EM_DIAS} dias e podemos pedir uma confirmação de
          identidade antes de atender, para proteger você.
        </P>
      </>
    ),
  },
  {
    id: "seguranca",
    titulo: "Como protegemos seus dados",
    conteudo: (
      <>
        <Lista>
          <li>conexões criptografadas (HTTPS);</li>
          <li>senhas guardadas apenas como hash Argon2id, e recusa de senhas já vazadas;</li>
          <li>verificação em duas etapas opcional, por aplicativo autenticador;</li>
          <li>limite de tentativas de login, por dispositivo e por conta;</li>
          <li>sessão em cookie inacessível a scripts da página (httpOnly);</li>
          <li>confirmação de e-mail antes do primeiro login por senha;</li>
          <li>tokens das contas Google e GitHub guardados cifrados;</li>
          <li>
            conteúdo visível apenas a quem participa da equipe, do projeto ou da reunião, com essa
            verificação feita no servidor a cada acesso.
          </li>
        </Lista>
        <P>
          Nenhum sistema é totalmente imune a falhas. Se ocorrer um incidente de segurança que
          possa causar risco ou dano relevante, comunicaremos você e a ANPD, como determina o art.
          48 da LGPD.
        </P>
      </>
    ),
  },
  {
    id: "menores",
    titulo: "Crianças e adolescentes",
    conteudo: (
      <P>
        O Taskon é destinado a pessoas com {IDADE_MINIMA} anos ou mais. Não coletamos
        intencionalmente dados de menores de idade. Se identificarmos uma conta nessa situação,
        ela será excluída.
      </P>
    ),
  },
  {
    id: "cookies",
    titulo: "Cookies",
    conteudo: (
      <P>
        Usamos apenas cookies estritamente necessários e armazenamento local para preferências de
        interface. Os detalhes estão na <A href="/cookies">Política de cookies</A>.
      </P>
    ),
  },
  {
    id: "alteracoes",
    titulo: "Alterações nesta política",
    conteudo: (
      <P>
        Podemos atualizar esta política. A data no topo indica a versão vigente. Quando a mudança
        for relevante, você verá um aviso ao entrar no Taskon e precisará ler e aceitar a nova
        versão para continuar.
      </P>
    ),
  },
  {
    id: "contato",
    titulo: "Fale conosco",
    conteudo: (
      <P>
        Dúvidas, pedidos ou reclamações: {email}. Você também pode procurar a ANPD em{" "}
        <A href="https://www.gov.br/anpd">gov.br/anpd</A>.
      </P>
    ),
  },
];

export function PoliticaDePrivacidade() {
  return (
    <Documento
      titulo="Política de privacidade"
      secoes={secoes}
      resumo={
        <>
          <p>
            Usamos seus dados para fazer o Taskon funcionar: manter sua conta, guardar seus
            projetos e mostrá-los a quem você convidou, e avisar sobre o que importa.
          </p>
          <p>
            Não vendemos dados, não exibimos publicidade e não usamos rastreadores. Você pode
            excluir sua conta a qualquer momento em Meu perfil.
          </p>
        </>
      }
    />
  );
}
