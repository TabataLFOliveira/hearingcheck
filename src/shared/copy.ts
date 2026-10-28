import type { AnswerValue, LeadStatus, Level, Origin, Role } from "./types.js";

export const CONSENT_VERSION = "2026-10";

export const REMINDER =
  "Lembrando que este teste é apenas uma pré-triagem e não substitui uma avaliação médica.";

export const TERMS = {
  purpose: {
    title: "Ciência e finalidade",
    body: "O HearingCheck é uma pré-triagem de percepção auditiva da Ouvix. O resultado não é diagnóstico e não substitui uma avaliação com especialista.",
    accept: "Aceito o termo de ciência e finalidade.",
  },
  data: {
    title: "Consentimento de uso de dados",
    body: "Autorizo a Ouvix a guardar meu nome e meu WhatsApp para entrar em contato e agendar uma avaliação auditiva. Posso ver o resultado e recusar o contato depois.",
    accept: "Aceito o termo de consentimento de uso de dados.",
  },
} as const;

export const RESULT_COPY: Record<Level, { title: string; body: string }> = {
  1: {
    title: "Sua audição parece confortável no dia a dia",
    body: "Neste questionário, as situações perguntadas não parecem pesar na sua rotina. Manter uma avaliação de vez em quando ajuda a acompanhar a audição com calma.",
  },
  2: {
    title: "Algumas conversas podem estar pedindo mais esforço",
    body: "O questionário sugere esforço para ouvir em parte do dia a dia. Uma avaliação na Ouvix ajuda a entender o que está acontecendo, com calma e sem pressa.",
  },
  3: {
    title: "A audição pode estar atrapalhando encontros e conversas",
    body: "Pelas suas respostas, ouvir bem pode estar difícil em várias situações. A equipe da Ouvix pode te receber para uma avaliação e conversar sobre os próximos passos.",
  },
};

export const THANKS_LEAD = "Obrigado por participar! Um de nossos especialistas entrará em contato.";
export const THANKS_DONE = "Obrigado por participar! E não deixe de realizar sua avaliação auditiva periódica.";

export const ANSWER_LABEL: Record<AnswerValue, string> = {
  sim: "Sim",
  as_vezes: "Às vezes",
  nao: "Não",
};

export const ORIGIN_LABEL: Record<Origin, string> = {
  site: "Site",
  google: "Google",
  meta: "Meta",
  totem: "Totem",
  direto: "Direto",
};

export const STATUS_LABEL: Record<LeadStatus, string> = {
  novo: "Novo",
  em_contato: "Em contato",
  agendado: "Agendado",
  sem_retorno: "Sem retorno",
};

export const LEVEL_LABEL: Record<Level, string> = {
  1: "Audição saudável",
  2: "Alerta leve a moderado",
  3: "Alerta importante",
};

export const ROLE_LABEL: Record<Role, string> = {
  recepcao: "Recepção",
  avaliacao: "Avaliação",
};

export const DEMO_PASSWORD = "ouvix-demo";

export const DEMO_USERS = [
  { email: "recepcao@ouvix.local", name: "Recepção Ouvix", role: "recepcao" as const },
  { email: "avaliacao@ouvix.local", name: "Avaliação Ouvix", role: "avaliacao" as const },
];

export function contactMessage(name: string): string {
  const first = name.trim().split(/\s+/)[0] || name.trim();
  return `Olá, ${first}. Aqui é a equipe da Ouvix. Vimos seu pedido de avaliação auditiva gratuita e queremos combinar um horário. Este contato não é um diagnóstico.`;
}
