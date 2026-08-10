export type LegalLang = 'pt' | 'en';

export type LegalSection = {
  title: Record<LegalLang, string>;
  paragraphs: Array<Record<LegalLang, string>>;
};

export type LegalDocument = {
  slug: 'terms' | 'privacy';
  title: Record<LegalLang, string>;
  lastUpdated: string;
  intro: Record<LegalLang, string>;
  sections: LegalSection[];
};

/** Canonical Terms of Service — keep app + site in sync. */
export const TERMS_OF_SERVICE: LegalDocument = {
  slug: 'terms',
  lastUpdated: '2026-07-26',
  title: {
    pt: 'Termos de Uso',
    en: 'Terms of Service',
  },
  intro: {
    pt: 'Estes Termos de Uso regulam o acesso e a utilização da aplicação e do website LyftTrack. Ao criares uma conta ou utilizares o serviço, confirmas que leste e aceitas estes termos.',
    en: 'These Terms of Service govern access to and use of the LyftTrack application and website. By creating an account or using the service, you confirm that you have read and accept these terms.',
  },
  sections: [
    {
      title: {
        pt: '1. Natureza do serviço',
        en: '1. Nature of the service',
      },
      paragraphs: [
        {
          pt: 'O LyftTrack é uma ferramenta digital de registo de treinos — um «caderno digital» para guardares exercícios, séries, pesos, templates e progresso.',
          en: 'LyftTrack is a digital workout logging tool — a “digital notebook” for recording exercises, sets, weights, templates and progress.',
        },
        {
          pt: 'O LyftTrack não presta aconselhamento médico, desportivo, nutricional ou de saúde. Não substitui um profissional de saúde, treinador certificado ou qualquer orientação clínica. Qualquer decisão sobre treino, carga ou recuperação é da tua exclusiva responsabilidade.',
          en: 'LyftTrack does not provide medical, sports, nutritional or health advice. It does not replace a healthcare professional, certified coach or any clinical guidance. Any decision about training, load or recovery is your sole responsibility.',
        },
      ],
    },
    {
      title: {
        pt: '2. Isenção de responsabilidade (serviço «tal como está»)',
        en: '2. Disclaimer (service provided “as is”)',
      },
      paragraphs: [
        {
          pt: 'O serviço é fornecido «tal como está» e «conforme disponível», sem garantias de qualquer tipo, expressas ou implícitas, incluindo disponibilidade contínua, ausência de erros ou adequação a um fim específico.',
          en: 'The service is provided “as is” and “as available”, without warranties of any kind, express or implied, including continuous availability, freedom from errors, or fitness for a particular purpose.',
        },
        {
          pt: 'Não nos responsabilizamos por lesões, danos ou prejuízos ocorridos no ginásio ou noutro local de treino relacionados com o uso (ou incapacidade de uso) do LyftTrack.',
          en: 'We are not liable for injuries, damage or losses occurring at the gym or any other training location related to the use (or inability to use) of LyftTrack.',
        },
        {
          pt: 'Não garantimos que a plataforma estará sempre online, livre de falhas, bugs ou interrupções, nem que não possa ocorrer perda ou corrupção de dados (por exemplo, se a infraestrutura ou a ligação falharem).',
          en: 'We do not guarantee that the platform will always be online, free of faults, bugs or outages, nor that data loss or corruption cannot occur (for example if infrastructure or connectivity fails).',
        },
      ],
    },
    {
      title: {
        pt: '3. Conta e idade mínima',
        en: '3. Account and minimum age',
      },
      paragraphs: [
        {
          pt: 'A plataforma destina-se apenas a utilizadores com 16 anos ou mais. Ao registares-te, confirmas que tens pelo menos 16 anos.',
          en: 'The platform is intended only for users aged 16 or over. By registering, you confirm that you are at least 16 years old.',
        },
        {
          pt: 'És responsável por manter a confidencialidade das tuas credenciais e por toda a atividade realizada na tua conta.',
          en: 'You are responsible for keeping your credentials confidential and for all activity carried out on your account.',
        },
      ],
    },
    {
      title: {
        pt: '4. Conteúdo do utilizador (UGC)',
        en: '4. User-generated content (UGC)',
      },
      paragraphs: [
        {
          pt: 'És o único responsável pelo conteúdo que cries ou partilhes no LyftTrack (incluindo nomes de templates, notas de exercícios, comentários, bio e outros textos ou imagens).',
          en: 'You are solely responsible for content you create or share on LyftTrack (including template names, exercise notes, comments, bio and other text or images).',
        },
        {
          pt: 'Comprometes-te a não utilizar a plataforma para guardar ou partilhar conteúdo ilegal, abusivo, difamatório, discriminatório, que viole direitos de terceiros, ou spam.',
          en: 'You agree not to use the platform to store or share illegal, abusive, defamatory, discriminatory content, content that infringes third-party rights, or spam.',
        },
        {
          pt: 'Reservamo-nos o direito de suspender ou eliminar contas e conteúdo que violem estes Termos, sem prejuízo de outras medidas legais aplicáveis.',
          en: 'We reserve the right to suspend or delete accounts and content that violate these Terms, without prejudice to other applicable legal measures.',
        },
      ],
    },
    {
      title: {
        pt: '5. Propriedade intelectual',
        en: '5. Intellectual property',
      },
      paragraphs: [
        {
          pt: 'O código-fonte, o design, a marca, o nome «LyftTrack», o logótipo e demais elementos da plataforma são propriedade do titular do LyftTrack, salvo indicação em contrário.',
          en: 'The source code, design, brand, the name “LyftTrack”, the logo and other platform elements are owned by the LyftTrack rights holder, unless otherwise stated.',
        },
        {
          pt: 'É proibida a cópia, reprodução, redistribuição, engenharia reversa ou exploração comercial não autorizada destes elementos, excepto na medida permitida por lei imperativa.',
          en: 'Copying, reproduction, redistribution, reverse engineering or unauthorised commercial exploitation of these elements is prohibited, except to the extent permitted by mandatory law.',
        },
      ],
    },
    {
      title: {
        pt: '6. Alterações e contacto',
        en: '6. Changes and contact',
      },
      paragraphs: [
        {
          pt: 'Podemos atualizar estes Termos periodicamente. A data de «última atualização» no topo indica a versão em vigor. O uso continuado do serviço após alterações relevantes constitui aceitação da versão atualizada, quando a lei o permitir.',
          en: 'We may update these Terms from time to time. The “last updated” date at the top indicates the version in force. Continued use of the service after material changes constitutes acceptance of the updated version where permitted by law.',
        },
        {
          pt: 'Para questões sobre estes Termos: nikitayxp@gmail.com.',
          en: 'For questions about these Terms: nikitayxp@gmail.com.',
        },
      ],
    },
  ],
};
