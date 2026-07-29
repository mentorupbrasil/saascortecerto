/**
 * Cortzo product identity + GestorPro institutional assets.
 * Logo files are copied verbatim from mentorupbrasil/SaaS-multi-segmento
 * — do not regenerate or edit the PNGs.
 */
export const brand = {
  name: "Cortzo",
  legalName: "Cortzo",
  tagline: "Sua barbearia no controle.",
  title: "Cortzo — Gestão para Barbearias",
  description:
    "Gerencie agenda, clientes, equipe, financeiro, assinaturas e automações da sua barbearia em um só lugar.",
  longDescription:
    "Plataforma completa para gestão de barbearias, agenda, clientes, equipe, financeiro, assinaturas e automações.",
  professionalAppName: "Cortzo Pro",
  customerAppName: "Cortzo Cliente",
  statementDescriptor: "CORTZO",
  bookingPayerEmailHost: "agendamento.cortzo.app",
  /** Parent institutional brand (GestorPro) */
  parentName: "GestorPro",
  parentNameGestor: "Gestor",
  parentNamePro: "Pro",
  byline: "by GestorPro",
  /** Commercial / support WhatsApp (landing floating button). */
  supportWhatsApp: {
    display: "(11) 97834-5397",
    /** Digits only with country code, no + */
    e164: "5511978345397",
  },
  logos: {
    /** Institutional symbol — headers, login, sidebar, “by GestorPro” */
    symbol: "/logos/gestorpro-symbol.png",
    /** Favicon / PWA / Apple Touch / shortcut */
    icon: "/logos/gestorpro-icon.png",
  },
} as const;

export type Brand = typeof brand;
