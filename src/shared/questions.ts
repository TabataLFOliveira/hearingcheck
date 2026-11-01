export type Question = {
  id: number;
  text: string;
};

/** Adapted HHIE-S items kept in docs/pesquisa.md. */
export const QUESTIONS: Question[] = [
  { id: 1, text: "Você já se sentiu sem jeito ou com vergonha ao conversar com alguém que acabou de conhecer?" },
  { id: 2, text: "Conversar com a sua própria família em casa às vezes traz uma sensação de frustração?" },
  { id: 3, text: "Você sente que as pessoas ao seu redor perdem a paciência ou não entendem a sua dificuldade?" },
  { id: 4, text: "Sente que está deixando de aproveitar a vida ou ficando em desvantagem por não ouvir bem?" },
  { id: 5, text: "Essa dificuldade para escutar já te deixou triste, desanimado ou chateado?" },
  { id: 6, text: "Precisa aumentar muito o volume da TV ou do rádio para conseguir entender o que dizem?" },
  { id: 7, text: "Fica difícil bater papo e acompanhar a conversa com amigos e parentes na sala de casa?" },
  { id: 8, text: "Em lugares mais movimentados ou festas, você sente dificuldade para entender as pessoas?" },
  { id: 9, text: "Você evita ou atende menos o telefone por achar difícil ouvir quem está do outro lado?" },
  { id: 10, text: "Evita ir a reuniões, eventos ou lugares com muita gente por causa da audição?" },
];
