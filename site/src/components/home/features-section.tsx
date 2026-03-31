"use client";

import { BarChart3, CloudOff, Target } from 'lucide-react';

interface FeaturesProps {
  language: 'pt' | 'en';
}

const copyData = {
  pt: {
    heading: 'A Filosofia',
    subheading: 'Desenhado para o treino puro. Sem distrações, apenas dados concretos e evolução contínua.',
    features: [
      {
        icon: Target,
        title: 'Foco Absoluto',
        desc: 'Adiciona exercícios e regista pesos em apenas 2 toques. Interface concebida para não perderes tempo no ginásio.',
      },
      {
        icon: BarChart3,
        title: 'Análise de Progresso',
        desc: 'Sabe sempre quanto levantaste na última sessão. Gráficos em tempo real do teu volume muscular.',
      },
      {
        icon: CloudOff,
        title: 'Guarda Offline',
        desc: 'Ficaste sem internet no cabo da cave? O LyftTrack regista tudo localmente e sincroniza quando a net voltar.',
      },
    ]
  },
  en: {
    heading: 'The Philosophy',
    subheading: 'Designed for pure lifting. No distractions, just hard data and continuous evolution.',
    features: [
      {
        icon: Target,
        title: 'Absolute Focus',
        desc: 'Add exercises and log weights in just 2 taps. Interface crafted to save your resting time.',
      },
      {
        icon: BarChart3,
        title: 'Progress Analysis',
        desc: 'Always know what you lifted last week. Real-time charts of your muscular volume and strength.',
      },
      {
        icon: CloudOff,
        title: 'Offline First',
        desc: 'Lost connection in the basement gym? LyftTrack logs everything locally and syncs back when online.',
      },
    ]
  }
};

export function FeaturesSection({ language }: FeaturesProps) {
  const t = copyData[language];

  return (
    <section id="features" className="relative w-full bg-[#050505] pt-16 pb-24 md:py-36 min-h-screen flex items-center z-50">
      <div className="mx-auto max-w-7xl px-6 md:px-12 w-full">
        <div className="mb-12 md:mb-24 md:text-center max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-6xl font-black tracking-tighter text-white mb-4 md:mb-6 uppercase">
            {t.heading}
          </h2>
          <p className="text-lg md:text-2xl text-[var(--hero-text-muted)] font-medium leading-relaxed">
            {t.subheading}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-12">
          {t.features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div 
                key={idx} 
                className="group rounded-2xl border border-[#222222] bg-[#111111] p-6 transition-colors hover:border-[var(--hero-accent)] hover:bg-[#151515] md:rounded-[2rem] md:p-8"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--hero-accent)] shadow-[0_0_20px_color-mix(in_srgb,var(--hero-accent)_30%,transparent)] transition-transform duration-300 group-hover:scale-110 md:mb-6 md:h-14 md:w-14 md:rounded-2xl">
                  <Icon className="h-6 w-6 text-white md:h-7 md:w-7" />
                </div>
                <h3 className="mb-3 text-xl font-bold tracking-tight text-white md:mb-4 md:text-2xl">
                  {feat.title}
                </h3>
                <p className="text-sm font-medium leading-relaxed text-[var(--hero-text-muted)] md:text-base">
                  {feat.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
