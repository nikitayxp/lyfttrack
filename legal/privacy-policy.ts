import type { LegalDocument } from './terms-of-service';

/** Canonical Privacy Policy — keep app + site in sync. */
export const PRIVACY_POLICY: LegalDocument = {
  slug: 'privacy',
  lastUpdated: '2026-07-26',
  title: {
    pt: 'Política de Privacidade',
    en: 'Privacy Policy',
  },
  intro: {
    pt: 'Esta Política de Privacidade explica que dados pessoais o LyftTrack trata, para que fins, com que fornecedores e quais os teus direitos (incluindo RGPD). Aplica-se à aplicação e ao website LyftTrack.',
    en: 'This Privacy Policy explains what personal data LyftTrack processes, for what purposes, with which providers, and what your rights are (including GDPR). It applies to the LyftTrack application and website.',
  },
  sections: [
    {
      title: {
        pt: '1. Responsável pelo tratamento',
        en: '1. Data controller',
      },
      paragraphs: [
        {
          pt: 'O responsável pelo tratamento dos dados no LyftTrack é o titular do projeto. Contacto: nikitayxp@gmail.com.',
          en: 'The controller of personal data for LyftTrack is the project owner. Contact: nikitayxp@gmail.com.',
        },
      ],
    },
    {
      title: {
        pt: '2. Dados que recolhemos',
        en: '2. Data we collect',
      },
      paragraphs: [
        {
          pt: 'Dados de conta e autenticação: endereço de email, credenciais de autenticação geridas pelo fornecedor de auth, e, se usares login social (ex.: Google), identificadores necessários para concluir o login.',
          en: 'Account and authentication data: email address, authentication credentials managed by the auth provider, and if you use social login (e.g. Google), identifiers needed to complete sign-in.',
        },
        {
          pt: 'Dados de perfil: nome de utilizador, nome de apresentação, bio, fotografia de perfil (se carregares), e preferência de visibilidade do perfil (público / amigos / privado).',
          en: 'Profile data: username, display name, bio, profile photo (if you upload one), and profile visibility preference (public / friends / private).',
        },
        {
          pt: 'Dados de treino: treinos, exercícios, séries (peso, repetições, RIR e metadados associados), rotinas, templates, notas, datas e duração, e medições corporais que registares (ex.: peso corporal).',
          en: 'Workout data: workouts, exercises, sets (weight, reps, RIR and related metadata), routines, templates, notes, dates and duration, and body measurements you log (e.g. body weight).',
        },
        {
          pt: 'Dados sociais na app: amigos / pedidos de amizade, likes e comentários em treinos partilhados, conforme as funcionalidades que uses.',
          en: 'In-app social data: friends / friend requests, likes and comments on shared workouts, depending on the features you use.',
        },
        {
          pt: 'Dados técnicos: informações básicas de funcionamento (por exemplo idioma da interface e, no website, preferências locais como consentimento de cookies quando aplicável). Não vendemos listas de contactos nem fazemos scraping do teu dispositivo para fins publicitários.',
          en: 'Technical data: basic operational information (for example UI language and, on the website, local preferences such as cookie consent where applicable). We do not sell contact lists or scrape your device for advertising.',
        },
      ],
    },
    {
      title: {
        pt: '3. Para que usamos os dados',
        en: '3. How we use the data',
      },
      paragraphs: [
        {
          pt: 'Utilizamos os dados apenas para operar o LyftTrack: criar e autenticar a tua conta, guardar e mostrar o teu histórico de treinos, permitir funcionalidades sociais que escolheres, e melhorar a estabilidade do serviço.',
          en: 'We use the data only to operate LyftTrack: create and authenticate your account, store and display your workout history, enable social features you choose to use, and improve service stability.',
        },
        {
          pt: 'Não vendemos os teus dados pessoais a terceiros.',
          en: 'We do not sell your personal data to third parties.',
        },
      ],
    },
    {
      title: {
        pt: '4. Subcontratantes e infraestrutura',
        en: '4. Processors and infrastructure',
      },
      paragraphs: [
        {
          pt: 'Não operamos servidores próprios de base de dados. Os dados são tratados por fornecedores de infraestrutura sob contrato / termos de processamento adequados:',
          en: 'We do not run our own database servers. Data is processed by infrastructure providers under appropriate contracts / processing terms:',
        },
        {
          pt: 'Supabase — autenticação, base de dados e armazenamento associado ao funcionamento da app.',
          en: 'Supabase — authentication, database and related storage for the app.',
        },
        {
          pt: 'Vercel — alojamento do website e/ou do frontend web da aplicação (conforme o ambiente em produção).',
          en: 'Vercel — hosting for the website and/or the app’s web frontend (depending on the production environment).',
        },
        {
          pt: 'Estes fornecedores tratam dados em nosso nome para prestar o serviço. Podem processar dados fora do EEE; nesse caso aplicam-se as salvaguardas previstas na respetiva documentação (por exemplo cláusulas contratuais-tipo), quando exigido.',
          en: 'These providers process data on our behalf to deliver the service. They may process data outside the EEA; in that case safeguards described in their documentation (for example standard contractual clauses) apply where required.',
        },
      ],
    },
    {
      title: {
        pt: '5. Cookies no website',
        en: '5. Cookies on the website',
      },
      paragraphs: [
        {
          pt: 'O website pode usar cookies ou armazenamento local estritamente necessários ao funcionamento (por exemplo lembrar o idioma ou o consentimento). Cookies não essenciais (analytics/marketing), se existirem, só devem ser usados com o teu consentimento — ver o banner de cookies do site.',
          en: 'The website may use cookies or local storage strictly necessary for operation (for example remembering language or consent). Non-essential cookies (analytics/marketing), if any, should only be used with your consent — see the site cookie banner.',
        },
      ],
    },
    {
      title: {
        pt: '6. Os teus direitos (RGPD)',
        en: '6. Your rights (GDPR)',
      },
      paragraphs: [
        {
          pt: 'Nos termos aplicáveis, podes solicitar: acesso a uma cópia dos teus dados; retificação de informação incorreta; e eliminação da conta e dos dados associados.',
          en: 'Where applicable, you may request: access to a copy of your data; rectification of inaccurate information; and deletion of your account and associated data.',
        },
        {
          pt: 'Podes exercer estes direitos contactando nikitayxp@gmail.com. Também terás (ou terás em breve) uma opção na app para eliminar a conta nas definições (zona de perigo), que apaga a conta de autenticação e os dados de treino associados.',
          en: 'You can exercise these rights by contacting nikitayxp@gmail.com. You also have (or will soon have) an in-app option to delete your account in settings (danger zone), which deletes the auth account and associated workout data.',
        },
        {
          pt: 'Tens ainda o direito de apresentar reclamação junto da autoridade de controlo competente (em Portugal, a CNPD), se considerares que o tratamento viola a legislação de proteção de dados.',
          en: 'You also have the right to lodge a complaint with the competent supervisory authority (in Portugal, the CNPD) if you believe processing violates data protection law.',
        },
      ],
    },
    {
      title: {
        pt: '7. Conservação e segurança',
        en: '7. Retention and security',
      },
      paragraphs: [
        {
          pt: 'Conservamos os dados enquanto a tua conta estiver ativa e pelo tempo necessário para prestar o serviço. Após eliminação da conta, os dados associados são apagados ou anonimizados, salvo obrigação legal de retenção.',
          en: 'We retain data while your account is active and for as long as needed to provide the service. After account deletion, associated data is deleted or anonymised, except where legal retention obligations apply.',
        },
        {
          pt: 'Aplicamos medidas técnicas e organizativas razoáveis (incluindo controlo de acesso e políticas de segurança dos fornecedores). Nenhum sistema é 100% seguro.',
          en: 'We apply reasonable technical and organisational measures (including access control and provider security policies). No system is 100% secure.',
        },
      ],
    },
    {
      title: {
        pt: '8. Alterações',
        en: '8. Changes',
      },
      paragraphs: [
        {
          pt: 'Podemos atualizar esta Política periodicamente. A data de «última atualização» indica a versão em vigor. Em alterações relevantes, procuraremos dar visibilidade adequada na app ou no site.',
          en: 'We may update this Policy from time to time. The “last updated” date indicates the version in force. For material changes, we will aim to provide appropriate notice in the app or on the site.',
        },
      ],
    },
  ],
};
