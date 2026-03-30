'use client';

import { useState, type CSSProperties, type MouseEvent } from 'react';
import { motion, type Variants } from 'framer-motion';
import Image from 'next/image';
import { FeatureIcon, type FeatureIconName } from './feature-icons';

type FeaturePoint = {
  iconName: FeatureIconName;
  title: string;
  description: string;
};

const FEATURE_POINTS: FeaturePoint[] = [
  {
    iconName: 'quick-log',
    title: 'Registo Rapido',
    description: 'Adiciona os teus sets sem perder tempo.',
  },
  {
    iconName: 'smart-training',
    title: 'Treino Inteligente',
    description: 'Calculo de discos e previsao de 1RM integrados.',
  },
  {
    iconName: 'hall-of-fame',
    title: 'Hall of Fame',
    description: 'Os teus recordes prontos a partilhar.',
  },
];

const premiumEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

const heroContainerVariants: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const heroItemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: premiumEase,
    },
  },
};

const featureSectionVariants: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.06,
    },
  },
};

const featureCardVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.58,
      ease: premiumEase,
    },
  },
};

const hoverSpring = {
  type: 'spring',
  stiffness: 280,
  damping: 22,
  mass: 0.8,
} as const;

export function WebsiteExperience() {
  const [mouseX, setMouseX] = useState(50);
  const [mouseY, setMouseY] = useState(20);

  const style = {
    '--mouse-x': `${mouseX}%`,
    '--mouse-y': `${mouseY}%`,
  } as CSSProperties;

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    const { currentTarget, clientX, clientY } = event;
    const rect = currentTarget.getBoundingClientRect();

    const nextX = ((clientX - rect.left) / rect.width) * 100;
    const nextY = ((clientY - rect.top) / rect.height) * 100;

    setMouseX(Number(nextX.toFixed(2)));
    setMouseY(Number(nextY.toFixed(2)));
  }

  return (
    <div className="minimal-shell" style={style} onMouseMove={handleMouseMove}>
      <div className="mouse-aura" />

      <main className="minimal-main">
        <Image src="/logo.jpg" alt="LyftTrack" width={144} height={44} className="minimal-logo" priority />

        <motion.div
          className="minimal-hero"
          variants={heroContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          <motion.h1 className="minimal-title" variants={heroItemVariants}>
            LyftTrack
          </motion.h1>

          <motion.p className="minimal-subtitle" variants={heroItemVariants}>
            A aplicação essencial para registares os teus treinos, esmagares recordes e focares-te apenas no ferro. Sem
            distrações.
          </motion.p>

          <motion.div className="minimal-actions" variants={heroItemVariants}>
            <motion.a
              className="minimal-cta"
              href="https://lyfttrack-app.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{
                scale: 1.045,
                y: -1,
                boxShadow: '0 0 28px rgba(0, 122, 255, 0.46)',
              }}
              whileTap={{ scale: 0.96 }}
              transition={hoverSpring}
            >
              Entrar na App
            </motion.a>

            <motion.a
              className="minimal-link"
              href="#como-funciona"
              whileHover={{
                scale: 1.045,
                y: -1,
                boxShadow: '0 0 18px rgba(0, 122, 255, 0.34)',
              }}
              whileTap={{ scale: 0.96 }}
              transition={hoverSpring}
            >
              Ver como funciona
            </motion.a>
          </motion.div>
        </motion.div>

        <motion.section
          id="como-funciona"
          className="minimal-features"
          variants={featureSectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {FEATURE_POINTS.map((point) => (
            <motion.article
              key={point.title}
              className="minimal-feature-card"
              variants={featureCardVariants}
              whileHover={{
                scale: 1.03,
                y: -6,
                boxShadow: '0 18px 38px rgba(0, 122, 255, 0.2)',
                borderColor: 'rgba(59, 130, 246, 0.38)',
              }}
              transition={hoverSpring}
            >
              <FeatureIcon name={point.iconName} />
              <h2>{point.title}</h2>
              <p>{point.description}</p>
            </motion.article>
          ))}
        </motion.section>
      </main>
    </div>
  );
}
