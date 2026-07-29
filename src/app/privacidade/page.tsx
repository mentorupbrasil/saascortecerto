import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/marketing/legal-page";
import { brand } from "@/config/brand";
import { getPlatformSupportEmail } from "@/lib/platform-billing";

export const metadata: Metadata = {
  title: `Política de privacidade — ${brand.name}`,
  description: `Política de privacidade da plataforma ${brand.name}.`,
};

export default function PrivacidadePage() {
  const supportEmail = getPlatformSupportEmail();

  return (
    <LegalPageShell title="Política de privacidade" updatedAt="28 de julho de 2026">
      <p>
        Esta Política de Privacidade descreve como o {brand.name} ({brand.byline}) coleta, usa e
        protege os dados pessoais no uso da plataforma.
      </p>

      <LegalSection heading="Dados que coletamos">
        <p>
          Coletamos dados necessários para criar e operar sua conta (nome, e-mail, telefone da
          barbearia) e dados que você cadastra no sistema (clientes, agenda, vendas e demais
          informações da operação).
        </p>
      </LegalSection>

      <LegalSection heading="Como usamos os dados">
        <p>
          Usamos os dados para prestar o serviço, processar pagamentos da assinatura, enviar
          comunicações operacionais e melhorar a plataforma.
        </p>
        <p>
          Cada barbearia possui ambiente isolado: os dados de uma conta não são compartilhados
          com outras barbearias.
        </p>
      </LegalSection>

      <LegalSection heading="Compartilhamento">
        <p>
          Podemos compartilhar dados com provedores essenciais à operação (hospedagem,
          processamento de pagamento), sempre sob obrigação de confidencialidade e apenas na
          medida necessária.
        </p>
        <p>Não vendemos dados pessoais.</p>
      </LegalSection>

      <LegalSection heading="Segurança e retenção">
        <p>
          Adotamos medidas técnicas e organizacionais para proteger os dados. Mantemos as
          informações enquanto a conta estiver ativa e pelo prazo necessário para cumprimento
          de obrigações legais.
        </p>
      </LegalSection>

      <LegalSection heading="Seus direitos">
        <p>
          Você pode solicitar acesso, correção ou exclusão dos seus dados, conforme a legislação
          aplicável (incluindo a LGPD), entrando em contato conosco.
        </p>
      </LegalSection>

      <LegalSection heading="Contato">
        <p>
          Dúvidas sobre privacidade:{" "}
          <a href={`mailto:${supportEmail}`} className="font-medium text-primary hover:underline">
            {supportEmail}
          </a>
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
