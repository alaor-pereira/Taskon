import { A, Destaque, Documento, Lista, P, Termo, type SecaoDoDocumento } from "./documento";
import { CONTROLADOR, IDADE_MINIMA } from "@/lib/legal/constantes";

const email = <A href={`mailto:${CONTROLADOR.email}`}>{CONTROLADOR.email}</A>;

const secoes: SecaoDoDocumento[] = [
  {
    id: "aceitacao",
    titulo: "Aceitação",
    conteudo: (
      <>
        <P>
          Estes Termos de uso regulam o uso do Taskon, oferecido por{" "}
          <Termo>{CONTROLADOR.nome}</Termo> (“nós”). Ao marcar a caixa de aceite no cadastro, ou
          ao aceitar uma nova versão dentro do app, você declara que leu e concorda com estes
          Termos e que está ciente da <A href="/privacidade">Política de privacidade</A>.
        </P>
        <P>Se não concordar, não use o Taskon.</P>
      </>
    ),
  },
  {
    id: "servico",
    titulo: "O serviço",
    conteudo: (
      <P>
        O Taskon é um sistema de gerenciamento de projetos, equipes, tarefas e agenda, em que cada
        pessoa vê apenas aquilo de que participa. Podemos melhorar, alterar ou descontinuar
        funcionalidades; quando a mudança afetar de forma relevante o seu uso, avisaremos com
        antecedência razoável.
      </P>
    ),
  },
  {
    id: "elegibilidade",
    titulo: "Quem pode usar",
    conteudo: (
      <P>
        Para criar uma conta, você precisa ter {IDADE_MINIMA} anos ou mais e plena capacidade para
        aceitar estes Termos.
      </P>
    ),
  },
  {
    id: "conta",
    titulo: "Sua conta",
    conteudo: (
      <Lista>
        <li>Informe dados verdadeiros e mantenha-os atualizados.</li>
        <li>A conta é pessoal: não a compartilhe nem use a de outra pessoa.</li>
        <li>
          Guarde sua senha com cuidado. Você responde pelo que for feito na sua conta, então nos
          avise em {email} se suspeitar de uso indevido.
        </li>
      </Lista>
    ),
  },
  {
    id: "uso-aceitavel",
    titulo: "Uso aceitável",
    conteudo: (
      <>
        <P>Ao usar o Taskon, você se compromete a não:</P>
        <Lista>
          <li>praticar atos ilegais ou incentivar que outros os pratiquem;</li>
          <li>violar direitos de terceiros, inclusive de propriedade intelectual e de imagem;</li>
          <li>publicar conteúdo que assedie, ameace ou discrimine outras pessoas;</li>
          <li>enviar convites em massa ou não solicitados;</li>
          <li>
            tentar acessar dados de outros usuários, contornar controles de acesso ou explorar
            falhas de segurança;
          </li>
          <li>enviar código malicioso ou sobrecarregar o serviço, inclusive com automações;</li>
          <li>
            incluir dados pessoais de terceiros, especialmente os sensíveis, sem base legal para
            isso.
          </li>
        </Lista>
      </>
    ),
  },
  {
    id: "conteudo",
    titulo: "Seu conteúdo",
    conteudo: (
      <>
        <P>
          Tudo o que você cria no Taskon continua sendo seu. Para operar o serviço, você nos
          concede uma licença gratuita, não exclusiva e limitada para armazenar, processar e
          exibir esse conteúdo a você e às pessoas a quem você deu acesso. A licença termina quando
          o conteúdo é excluído, ressalvado o que está na seção “Colaboração”.
        </P>
        <P>
          Você é responsável pelo que publica e declara ter o direito de fazê-lo. Ao convidar
          alguém, você confirma que pode compartilhar o e-mail dessa pessoa conosco para o envio
          do convite.
        </P>
      </>
    ),
  },
  {
    id: "colaboracao",
    titulo: "Colaboração em equipes e projetos",
    conteudo: (
      <>
        <P>
          Em equipes e projetos compartilhados, os papéis definem o que cada pessoa pode ver e
          fazer. Quem administra um espaço pode convidar e remover membros e alterar papéis. O que
          você publica num espaço compartilhado fica visível aos demais membros.
        </P>
        <Destaque>
          Ao excluir sua conta, suas contribuições em espaços compartilhados (comentários, tarefas
          e reuniões com outros participantes) permanecem, para não desfazer o trabalho dos
          colegas, mas passam a aparecer como “Usuário removido”. Antes de excluir a conta, você
          precisa transferir ou excluir as equipes e os projetos compartilhados de que é dono.
        </Destaque>
      </>
    ),
  },
  {
    id: "propriedade",
    titulo: "Propriedade intelectual",
    conteudo: (
      <P>
        O nome Taskon, a marca, o logotipo, o software e o design do serviço pertencem a nós.
        Estes Termos não transferem a você nenhum direito sobre eles além do uso do serviço.
      </P>
    ),
  },
  {
    id: "disponibilidade",
    titulo: "Disponibilidade",
    conteudo: (
      <P>
        Fazemos o possível para manter o Taskon disponível e seguro, mas o serviço é oferecido
        como está, sem garantia de funcionamento ininterrupto ou livre de erros. Podem ocorrer
        interrupções para manutenção ou por falhas de terceiros. Mantenha cópia do que for
        essencial para você.
      </P>
    ),
  },
  {
    id: "responsabilidade",
    titulo: "Limitação de responsabilidade",
    conteudo: (
      <P>
        Na medida permitida pela lei, não respondemos por danos indiretos, lucros cessantes ou
        perdas decorrentes de uso indevido do serviço, de conteúdo publicado por usuários ou de
        falhas de serviços de terceiros. Nada nestes Termos afasta direitos que o Código de Defesa
        do Consumidor garante a você e que não possam ser renunciados.
      </P>
    ),
  },
  {
    id: "encerramento",
    titulo: "Encerramento",
    conteudo: (
      <>
        <P>
          Você pode excluir sua conta quando quiser, em <Termo>Meu perfil</Termo>. A{" "}
          <A href="/privacidade#retencao">Política de privacidade</A> explica o que é apagado e o
          que permanece.
        </P>
        <P>
          Podemos suspender ou encerrar contas que violem estes Termos ou a lei, avisando antes
          sempre que possível.
        </P>
      </>
    ),
  },
  {
    id: "alteracoes",
    titulo: "Alterações destes Termos",
    conteudo: (
      <P>
        Podemos atualizar estes Termos. A data no topo indica a versão vigente. Quando a mudança
        for relevante, você verá um aviso ao entrar no Taskon e precisará aceitar a nova versão
        para continuar usando o serviço.
      </P>
    ),
  },
  {
    id: "lei",
    titulo: "Lei aplicável e foro",
    conteudo: (
      <P>
        Estes Termos seguem as leis da República Federativa do Brasil. Eventuais disputas serão
        resolvidas no foro do seu domicílio, como prevê o Código de Defesa do Consumidor.
      </P>
    ),
  },
  {
    id: "contato",
    titulo: "Fale conosco",
    conteudo: <P>Dúvidas sobre estes Termos: {email}.</P>,
  },
];

export function TermosDeUso() {
  return (
    <Documento
      titulo="Termos de uso"
      secoes={secoes}
      resumo={
        <p>
          Use o Taskon de forma lícita, cuide da sua senha e respeite o espaço das pessoas com quem
          você colabora. O que você cria é seu, o serviço é oferecido como está, e você pode
          excluir sua conta quando quiser.
        </p>
      }
    />
  );
}
