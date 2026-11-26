import type { AnswerValue } from "./types.js";

export type Question = {
  id: number;
  text: string;
  /** Ten items make the 0–40 score. The audiometry item is stored and left out of that score. */
  scored: boolean;
};

/** Questionnaire shown to new visitors after the clinic revised the order and wording. */
export const QUESTIONNAIRE_VERSION = "2026-11-26";

export const QUESTIONS: Question[] = [
  { id: 1, text: "Sente que está deixando de aproveitar a vida ou ficando em desvantagem por não ouvir bem?", scored: true },
  { id: 2, text: "Precisa aumentar muito o volume da TV ou do rádio para conseguir entender o que dizem?", scored: true },
  { id: 3, text: "Em lugares mais movimentados ou festas, você sente dificuldade para entender as pessoas?", scored: true },
  { id: 4, text: "Em algum dos ouvidos você sente que escuta menos?", scored: true },
  { id: 5, text: "Você ouve algum zumbido, chiado ou apito nos ouvidos?", scored: true },
  { id: 6, text: "Fica difícil bater papo e acompanhar a conversa com amigos e parentes na sala de casa?", scored: true },
  { id: 7, text: "Você sente que as pessoas ao seu redor perdem a paciência ou não entendem a sua dificuldade?", scored: true },
  { id: 8, text: "Evita ir a reuniões, eventos ou lugares com muita gente por causa da audição?", scored: true },
  { id: 9, text: "Essa dificuldade para escutar já te deixou triste, desanimado ou chateado?", scored: true },
  { id: 10, text: "Você evita ou atende menos o telefone por achar difícil ouvir quem está do outro lado?", scored: true },
  { id: 11, text: "Você já fez um exame de audiometria alguma vez?", scored: false },
];

/** Wording stored with sessions started before QUESTIONNAIRE_VERSION. */
export const LEGACY_QUESTIONS: Question[] = [
  { id: 1, text: "Você já se sentiu sem jeito ou com vergonha ao conversar com alguém que acabou de conhecer?", scored: true },
  { id: 2, text: "Conversar com a sua própria família em casa às vezes traz uma sensação de frustração?", scored: true },
  { id: 3, text: "Você sente que as pessoas ao seu redor perdem a paciência ou não entendem a sua dificuldade?", scored: true },
  { id: 4, text: "Sente que está deixando de aproveitar a vida ou ficando em desvantagem por não ouvir bem?", scored: true },
  { id: 5, text: "Essa dificuldade para escutar já te deixou triste, desanimado ou chateado?", scored: true },
  { id: 6, text: "Precisa aumentar muito o volume da TV ou do rádio para conseguir entender o que dizem?", scored: true },
  { id: 7, text: "Fica difícil bater papo e acompanhar a conversa com amigos e parentes na sala de casa?", scored: true },
  { id: 8, text: "Em lugares mais movimentados ou festas, você sente dificuldade para entender as pessoas?", scored: true },
  { id: 9, text: "Você evita ou atende menos o telefone por achar difícil ouvir quem está do outro lado?", scored: true },
  { id: 10, text: "Evita ir a reuniões, eventos ou lugares com muita gente por causa da audição?", scored: true },
];

export function questionsFor(version: string | null): Question[] {
  return version === QUESTIONNAIRE_VERSION ? QUESTIONS : LEGACY_QUESTIONS;
}

export function allowedAnswers(question: Question): AnswerValue[] {
  return question.scored ? ["sim", "as_vezes", "nao"] : ["sim", "nao"];
}
