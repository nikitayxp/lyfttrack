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
    readTimeMinutes: 6,
    title: {
      en: 'How to Build Brutal Workout Consistency (Without Burnout)',
      pt: 'Como criar consistencia brutal no treino (sem burnout)',
    },
    excerpt: {
      en: 'A practical playbook to stop skipping sessions and keep progression alive every week.',
      pt: 'Um playbook pratico para parares de falhar treinos e manteres progressao todas as semanas.',
    },
    sections: [
      {
        heading: {
          en: 'Consistency beats motivation every time',
          pt: 'Consistencia ganha da motivacao todas as vezes',
        },
        paragraphs: [
          {
            en: 'Motivation is unstable. Systems are reliable. If your plan only works on perfect days, it is not a real plan.',
            pt: 'Motivacao e instavel. Sistemas sao fiaveis. Se o teu plano so funciona em dias perfeitos, nao e um plano real.',
          },
          {
            en: 'LyftTrack helps you show up by keeping your next set, load, and progression target visible at all times.',
            pt: 'O LyftTrack ajuda-te a aparecer porque mantem o proximo set, carga e alvo de progressao sempre visiveis.',
          },
        ],
      },
      {
        heading: {
          en: 'Win the week, not just one workout',
          pt: 'Ganha a semana, nao apenas um treino',
        },
        paragraphs: [
          {
            en: 'Strong athletes think in weekly execution: total sets, quality reps, and progressive overload with control.',
            pt: 'Atletas fortes pensam em execucao semanal: total de series, reps de qualidade e sobrecarga progressiva com controlo.',
          },
          {
            en: 'When your log is clear, discipline becomes easier and PRs become repeatable, not lucky moments.',
            pt: 'Quando o teu registo e claro, disciplina fica mais facil e PRs tornam-se repetiveis, nao momentos de sorte.',
          },
        ],
      },
    ],
  },
  {
    slug: 'plate-calculator-design',
    tag: 'Programming',
    publishedAt: '2026-03-23',
    readTimeMinutes: 5,
    title: {
      en: 'Load the Bar Faster and Lift Harder',
      pt: 'Carrega a barra mais rapido e levanta mais pesado',
    },
    excerpt: {
      en: 'Stop wasting rest time doing plate math. Use exact per-side loading and stay locked in.',
      pt: 'Para de perder descanso a fazer contas de discos. Usa o loading exato por lado e mantem foco total.',
    },
    sections: [
      {
        heading: {
          en: 'Every second between sets matters',
          pt: 'Cada segundo entre sets conta',
        },
        paragraphs: [
          {
            en: 'Long transitions kill intensity. Fast loading keeps your rhythm, aggression and output where they should be.',
            pt: 'Transicoes longas matam intensidade. Loading rapido mantem ritmo, agressividade e output onde devem estar.',
          },
          {
            en: 'With plate guidance in real time, you focus on execution instead of guessing what to load.',
            pt: 'Com guia de discos em tempo real, focas na execucao em vez de adivinhar o que meter na barra.',
          },
        ],
      },
      {
        heading: {
          en: 'Confidence under heavy load',
          pt: 'Confianca sob carga pesada',
        },
        paragraphs: [
          {
            en: 'When loading is precise, your attempts are cleaner and your top sets become more consistent.',
            pt: 'Quando o loading e preciso, as tentativas saem mais limpas e os top sets ficam mais consistentes.',
          },
          {
            en: 'Small wins in setup stack into big wins on the platform, on stage, and in your progression graph.',
            pt: 'Pequenas vitorias no setup acumulam-se em grandes vitorias na plataforma, no palco e no teu grafico de progressao.',
          },
        ],
      },
    ],
  },
  {
    slug: 'pr-sharing-loop',
    tag: 'Product',
    publishedAt: '2026-03-19',
    readTimeMinutes: 4,
    title: {
      en: 'Turn Your PRs Into Social Momentum',
      pt: 'Transforma os teus PRs em momentum social',
    },
    excerpt: {
      en: 'Your hard sets deserve visibility. Share your PR cards and build accountability with your circle.',
      pt: 'Os teus sets duros merecem visibilidade. Partilha os teus PR cards e cria accountability com o teu circulo.',
    },
    sections: [
      {
        heading: {
          en: 'Your progress should be visible',
          pt: 'O teu progresso tem de ser visivel',
        },
        paragraphs: [
          {
            en: 'When athletes share milestones, they reinforce identity: this is who I am and this is what I do.',
            pt: 'Quando atletas partilham milestones, reforcam identidade: isto e quem sou e isto e o que faco.',
          },
          {
            en: 'That identity loop is powerful for retention, discipline and long-term progression.',
            pt: 'Esse loop de identidade e poderoso para retencao, disciplina e progressao de longo prazo.',
          },
        ],
      },
      {
        heading: {
          en: 'Accountability that drives extra reps',
          pt: 'Accountability que puxa mais reps',
        },
        paragraphs: [
          {
            en: 'Sharing your numbers creates healthy pressure to keep showing up and lifting with intention.',
            pt: 'Partilhar os teus numeros cria pressao saudavel para continuares a aparecer e treinar com intencao.',
          },
          {
            en: 'Use Hall of Fame moments to stay connected with your team, coach, and community.',
            pt: 'Usa momentos de Hall of Fame para ficares ligado a equipa, coach e comunidade.',
          },
        ],
      },
    ],
  },
];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
