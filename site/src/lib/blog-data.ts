export type LanguageCode = 'en' | 'pt';

type LocalizedText = {
  en: string;
  pt: string;
};

export type BlogSection = {
  heading: LocalizedText;
  paragraphs: LocalizedText[];
};

export type BlogPost = {
  slug: string;
  tag: 'Training' | 'Programming' | 'Product';
  publishedAt: string;
  readTimeMinutes: number;
  title: LocalizedText;
  excerpt: LocalizedText;
  sections: BlogSection[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'active-workout-system',
    tag: 'Training',
    publishedAt: '2026-03-27',
    readTimeMinutes: 1,
    title: {
      en: 'Build a Consistent Training Routine Without Burning Out',
      pt: 'Como manter a consistência no treino sem esgotar',
    },
    excerpt: {
      en: 'Practical ways to maintain a training routine and follow your progress.',
      pt: 'Estratégias práticas para manteres uma rotina de treino e acompanhares a tua evolução.',
    },
    sections: [
      {
        heading: {
          en: 'A routine helps when motivation fades',
          pt: 'Uma rotina ajuda quando a motivação falha',
        },
        paragraphs: [
          {
            en: 'Motivation changes from day to day. Choose a routine that you can adapt to the time and energy you have available.',
            pt: 'A motivação varia de dia para dia. Escolhe uma rotina que consigas adaptar ao tempo e à energia que tens disponíveis.',
          },
          {
            en: 'LyftTrack shows previous sets and loads to help you prepare for your next workout.',
            pt: 'O LyftTrack mostra as séries e cargas anteriores para te ajudar a preparar o próximo treino.',
          },
        ],
      },
      {
        heading: {
          en: 'Look at the week, not just one workout',
          pt: 'Olha para a semana, não apenas para um treino',
        },
        paragraphs: [
          {
            en: 'Review sets, repetitions and loads across the week. This context helps you understand how your training is developing.',
            pt: 'Revê o total de séries, as repetições e as cargas ao longo da semana. Esse contexto ajuda-te a perceber como o treino está a evoluir.',
          },
          {
            en: 'A clear log lets you compare sessions and recognise progress without relying only on memory.',
            pt: 'Um registo claro permite comparar sessões e reconhecer progressos sem depender apenas da memória.',
          },
        ],
      },
    ],
  },
  {
    slug: 'plate-calculator-design',
    tag: 'Programming',
    publishedAt: '2026-03-23',
    readTimeMinutes: 1,
    title: {
      en: 'Prepare the Bar With Fewer Calculations',
      pt: 'Prepara a barra com menos contas',
    },
    excerpt: {
      en: 'Check the plates needed on each side of the bar and confirm the load before you begin.',
      pt: 'Consulta os discos necessários de cada lado da barra e confirma a carga antes de começares.',
    },
    sections: [
      {
        heading: {
          en: 'Prepare for your next set without rushing',
          pt: 'Prepara a próxima série com calma',
        },
        paragraphs: [
          {
            en: 'Preparing plates in advance simplifies the transition between sets. Keep the rest periods appropriate for your workout.',
            pt: 'Preparar os discos com antecedência simplifica a transição entre séries. Mantém o descanso adequado ao teu treino.',
          },
          {
            en: 'To work out the load on each side, subtract the bar weight from the total and divide by two. Check the weight of the bar and the available plates.',
            pt: 'Para calcular a carga de cada lado, subtrai o peso da barra ao total e divide por dois. Confirma o peso da barra e dos discos disponíveis.',
          },
        ],
      },
      {
        heading: {
          en: 'Check the load before you begin',
          pt: 'Confirma a carga antes de começar',
        },
        paragraphs: [
          {
            en: 'Check that both sides of the bar have the same load and that the total matches what you planned.',
            pt: 'Verifica se os dois lados da barra têm a mesma carga e se o total corresponde ao que planeaste.',
          },
          {
            en: 'Log the weight and repetitions for each set so you have a reference for your next session.',
            pt: 'Regista o peso e as repetições de cada série para teres uma referência na próxima sessão.',
          },
        ],
      },
    ],
  },
  {
    slug: 'pr-sharing-loop',
    tag: 'Product',
    publishedAt: '2026-03-19',
    readTimeMinutes: 1,
    title: {
      en: 'Share Your Records With Your Training Friends',
      pt: 'Partilha os teus recordes com quem treina contigo',
    },
    excerpt: {
      en: 'Celebrate your progress and follow your friends\' workouts at your own pace.',
      pt: 'Celebra a tua evolução e acompanha os treinos dos teus amigos, ao teu ritmo.',
    },
    sections: [
      {
        heading: {
          en: 'Recognise your progress',
          pt: 'Reconhece o teu progresso',
        },
        paragraphs: [
          {
            en: 'Sharing a milestone can be a way to celebrate the effort you put into training.',
            pt: 'Partilhar uma conquista pode ser uma forma de celebrar o esforço que colocaste no treino.',
          },
          {
            en: 'Choose what you want to share and stay focused on your own goals, without constantly comparing yourself with other people.',
            pt: 'Escolhe o que queres partilhar e mantém o foco nos teus próprios objetivos, sem te comparares constantemente com outras pessoas.',
          },
        ],
      },
      {
        heading: {
          en: 'A community that follows your progress',
          pt: 'Uma comunidade que acompanha a tua evolução',
        },
        paragraphs: [
          {
            en: 'Following your friends\' workouts can give you new ideas and create opportunities to exchange experiences.',
            pt: 'Acompanhar os treinos dos teus amigos pode dar-te novas ideias e abrir espaço para trocar experiências.',
          },
          {
            en: 'Use the feed to follow sessions and records. Everyone progresses at their own pace.',
            pt: 'Usa o feed para acompanhar sessões e recordes. Cada pessoa evolui ao seu ritmo.',
          },
        ],
      },
    ],
  },
];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
