/**
 * Cortzo brand identity — single source of truth for product naming.
 * Import from here instead of hardcoding the platform name in UI/copy.
 */
export const brand = {
  name: "Cortzo",
  legalName: "Cortzo",
  tagline: "Sua barbearia no controle.",
  /** Primary document / store listing title */
  title: "Cortzo — Gestão para Barbearias",
  description:
    "Gerencie agenda, clientes, equipe, financeiro, assinaturas e automações da sua barbearia em um só lugar.",
  /** Longer marketing blurb when a fuller description is needed */
  longDescription:
    "Plataforma completa para gestão de barbearias, agenda, clientes, equipe, financeiro, assinaturas e automações.",
  professionalAppName: "Cortzo Pro",
  customerAppName: "Cortzo Cliente",
  /** Short descriptor for statement descriptors / PIX merchant fallbacks (A-Z, limited length) */
  statementDescriptor: "CORTZO",
  /** Synthetic email host for payment gateways (not a public marketing domain) */
  bookingPayerEmailHost: "agendamento.cortzo.app",
} as const;

export type Brand = typeof brand;
