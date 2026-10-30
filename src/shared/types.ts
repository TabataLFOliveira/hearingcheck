export const ANSWER_VALUES = ["sim", "as_vezes", "nao"] as const;
export type AnswerValue = (typeof ANSWER_VALUES)[number];

export const ORIGINS = ["site", "google", "meta", "totem", "direto"] as const;
export type Origin = (typeof ORIGINS)[number];

export const LEAD_STATUSES = ["novo", "em_contato", "agendado", "sem_retorno"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const ROLES = ["recepcao", "avaliacao"] as const;
export type Role = (typeof ROLES)[number];

export type Level = 1 | 2 | 3;

export type TrackingInput = {
  origem?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
};
