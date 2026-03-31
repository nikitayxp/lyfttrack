"use client";

import { BarChart3, Target, WifiOff } from 'lucide-react';

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
        icon: WifiOff,
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
        icon: WifiOff,
        title: 'Offline First',
        desc: 'Lost connection in the basement gym? LyftTrack logs everything locally and syncs back when online.',
      },
    ]
  }
};

export function FeaturesSection({ language }: FeaturesProps) {
  const t = copyData[language];

  return (
    <section id="features" className="relative w-full bg-[#050505] py-24 md:py-36 min-h-screen flex items-center z-50">
      <div className="mx-auto max-w-7xl px-6 md:px-12 w-full">
        <div className="mb-16 md:mb-24 md:text-center max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-6 uppercase">
            {t.heading}
          </h2>
          <p className="text-lg md:text-2xl text-[var(--hero-text-muted)] font-medium leading-relaxed">
            {t.subheading}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {t.features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div 
                key={idx} 
                className="group p-8 rounded-[2rem] bg-[#111111] border border-[#222222] transition-colors hover:bg-[#151515] hover:border-[var(--hero-accent)]"
              >
                <div className="w-14 h-14 rounded-2xl bg-[var(--hero-accent)] flex items-center justify-center mb-6 shadow-[0_0_20px_color-mix(in_srgb,var(--hero-accent)_30%,transparent)] group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">
                  {feat.title}
                </h3>
                <p className="text-[var(--hero-text-muted)] leading-relaxed font-medium">
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
