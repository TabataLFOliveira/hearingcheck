import type { AnswerValue, Level } from "./types.js";

export const ANSWER_POINTS: Record<AnswerValue, number> = {
  sim: 4,
  as_vezes: 2,
  nao: 0,
};

export function scoreAnswers(answers: AnswerValue[]): number {
  if (answers.length !== 10) {
    throw new Error("A test needs 10 answers");
  }
  return answers.reduce((total, answer) => total + ANSWER_POINTS[answer], 0);
}

export function levelForScore(score: number): Level {
  if (score >= 0 && score <= 8) return 1;
  if (score >= 10 && score <= 24) return 2;
  if (score >= 26 && score <= 40) return 3;
  throw new Error(`Score ${score} has no documented classification`);
}
