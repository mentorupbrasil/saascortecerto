import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/marketing/legal-page";
import { brand } from "@/config/brand";
import { getPlatformSupportEmail } from "@/lib/platform-billing";

export const metadata: Metadata = {
  title: `Termos de uso — ${brand.name}`,
  description: `Termos de uso da plataforma ${brand.name}.`,
};

export default function TermosPage() {
  const supportEmail = getPlatformSupportEmail();

  return (
    <LegalPageShell title="Termos de uso" updatedAt="28 de julho de 2026">
      <p>
        Estes Termos de Uso regulam o acesso e a utilização da plataforma {brand.name} (
        {brand.byline}). Ao criar uma conta e usar o serviço, você concorda com as condições
        descritas abaixo.
      </p>

      <LegalSection heading="Aceitação dos termos">
        <p>
          Ao se cadastrar e utilizar o {brand.name}, você declara que leu, entendeu e concorda
          com estes Termos de Uso e com a nossa Política de Privacidade.
        </p>
        <p>Caso não concorde com qualquer condição, você não deve utilizar a plataforma.</p>
      </LegalSection>

      <LegalSection heading="Conta e responsabilidades">
        <p>
          Você é responsável por manter a confidencialidade dos dados de acesso da sua conta e
          por todas as atividades realizadas por ela.
        </p>
        <p>
          Os dados cadastrados são de responsabilidade do titular da conta, que deve garantir a
          veracidade das informações inseridas.
        </p>
      </LegalSection>

      <LegalSection heading="Assinatura e pagamento">
        <p>
          O {brand.name} é oferecido mediante assinatura mensal ou anual, conforme o plano
          escolhido. A assinatura é renovada automaticamente a cada período.
        </p>
        <p>
          Não há fidelidade: você pode trocar de plano ou cancelar a qualquer momento, sem multa.
          O cancelamento encerra a renovação seguinte; o acesso permanece até o fim do período
          já pago.
        </p>
      </LegalSection>

      <LegalSection heading="Uso aceitável">
        <p>
          É proibido utilizar a plataforma para fins ilícitos, para violar direitos de terceiros
          ou de forma que comprometa a segurança e a estabilidade do serviço.
        </p>
      </LegalSection>

      <LegalSection heading="Disponibilidade do serviço">
        <p>
          Empenhamo-nos para manter o serviço disponível de forma contínua, mas podem ocorrer
          interrupções para manutenção ou por fatores fora do nosso controle.
        </p>
      </LegalSection>

      <LegalSection heading="Alterações nos termos">
        <p>
          Estes termos podem ser atualizados periodicamente. Mudanças relevantes serão
          comunicadas, e o uso continuado da plataforma implica concordância com a versão vigente.
        </p>
      </LegalSection>

      <LegalSection heading="Contato">
        <p>
          Dúvidas sobre estes termos:{" "}
          <a href={`mailto:${supportEmail}`} className="font-medium text-primary hover:underline">
            {supportEmail}
          </a>
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
