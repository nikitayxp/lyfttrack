"use client";

import React, { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Activity, Dumbbell, TrendingUp } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import NeuralBackground from '@/components/ui/flow-field-background';
import { cn } from '@/lib/utils';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const INJECTED_STYLES = `
  .gsap-reveal { visibility: hidden; }

  .text-3d-matte {
        color: var(--hero-text-primary);
      text-shadow:
          0 16px 40px rgba(0, 0, 0, 0.65),
          0 2px 8px color-mix(in srgb, var(--hero-accent) 28%, transparent);
  }

  .text-silver-matte {
        background: linear-gradient(180deg, var(--hero-text-gradient-start) 0%, var(--hero-text-gradient-end) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      transform: translateZ(0);
      filter: drop-shadow(0px 12px 24px rgba(0, 0, 0, 0.8));
  }

  .text-card-silver-matte {
        background: linear-gradient(180deg, var(--hero-text-gradient-start) 0%, var(--hero-text-card-gradient-end) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      transform: translateZ(0);
      filter:
          drop-shadow(0px 12px 24px rgba(0, 0, 0, 0.82))
          drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.65));
  }

  .premium-depth-card {
      background: linear-gradient(145deg, var(--hero-card-start) 0%, var(--hero-card-end) 100%);
      box-shadow:
          0 44px 110px -20px rgba(0, 0, 0, 0.92),
          0 20px 50px -20px rgba(0, 0, 0, 0.85),
          inset 0 1px 2px rgba(255, 255, 255, 0.08),
          inset 0 -2px 4px rgba(0, 0, 0, 0.85);
      border: 1px solid var(--hero-card-border);
      position: relative;
  }

  .card-sheen {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      z-index: 50;
        background: radial-gradient(780px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), var(--hero-card-sheen) 0%, transparent 40%);
      mix-blend-mode: screen;
      transition: opacity 0.3s ease;
  }

  .iphone-bezel {
        background-color: var(--hero-bezel);
      box-shadow:
          inset 0 0 0 2px var(--hero-bezel-stroke),
          inset 0 0 0 7px var(--hero-screen),
          0 42px 90px -15px rgba(0, 0, 0, 0.95),
          0 16px 28px -5px rgba(0, 0, 0, 0.76);
      transform-style: preserve-3d;
  }

  .hardware-btn {
        background: linear-gradient(90deg, var(--hero-hardware-start) 0%, var(--hero-hardware-end) 100%);
      box-shadow:
          -2px 0 5px rgba(0, 0, 0, 0.82),
          inset -1px 0 1px rgba(255, 255, 255, 0.14),
          inset 1px 0 2px rgba(0, 0, 0, 0.82);
      border-left: 1px solid rgba(255, 255, 255, 0.06);
  }

  .screen-glare {
      background: linear-gradient(110deg, var(--hero-glare) 0%, rgba(255, 255, 255, 0) 45%);
  }

  .widget-depth {
      background: linear-gradient(180deg, var(--hero-widget-top) 0%, var(--hero-widget-bottom) 100%);
      box-shadow:
          0 10px 20px rgba(0, 0, 0, 0.36),
          inset 0 1px 1px rgba(255, 255, 255, 0.07),
          inset 0 -1px 1px rgba(0, 0, 0, 0.55);
      border: 1px solid var(--hero-widget-border);
  }

  .floating-ui-badge {
      background: linear-gradient(135deg, var(--hero-badge-top) 0%, var(--hero-badge-bottom) 100%);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      box-shadow:
        0 0 0 1px var(--hero-badge-border),
          0 25px 50px -12px rgba(0, 0, 0, 0.86),
          inset 0 1px 1px rgba(255, 255, 255, 0.14),
          inset 0 -1px 1px rgba(0, 0, 0, 0.56);
  }

  .progress-ring {
      transform: rotate(-90deg);
      transform-origin: center;
      stroke-dasharray: 402;
      stroke-dashoffset: 402;
      stroke-linecap: round;
  }

  .feed-table {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      row-gap: 8px;
      column-gap: 8px;
      font-size: 10px;
      line-height: 1;
  }

  .feed-table-head {
      color: var(--hero-table-head);
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-size: 9px;
  }

  .feed-cell {
      color: var(--hero-cell);
      font-weight: 700;
  }

  .cta-blue {
      background: linear-gradient(180deg, var(--hero-accent) 0%, var(--hero-accent-strong) 100%);
      color: #FFFFFF;
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.1),
        0 10px 24px -8px color-mix(in srgb, var(--hero-accent) 70%, transparent),
        inset 0 1px 1px rgba(255, 255, 255, 0.25);
  }

  .cta-blue:hover {
      transform: translateY(-1px);
  }

  .hero-copy-muted { color: var(--hero-text-muted); }
  .hero-copy-soft { color: var(--hero-text-soft); }

  .hero-secondary-btn {
      border: 1px solid var(--hero-secondary-btn-border);
      background: var(--hero-secondary-btn-bg);
      color: var(--hero-secondary-btn-text);
  }

  .hero-secondary-btn:hover {
      transform: translateY(-1px);
  }
`;

export type HeroLanguage = 'pt' | 'en';

type HeroCopy = {
  brandName: string;
  tagline1: string;
  tagline2: string;
  cardHeading: string;
  cardDescription: string;
  metricLabel: string;
  ctaHeading: string;
  ctaDescription: string;
  ctaPrimary: string;
  ctaSecondary: string;
  mockupKicker: string;
  mockupTitle: string;
  setLabel: string;
  exerciseName: string;
  tableSet: string;
  tableKg: string;
  tableReps: string;
  startSession: string;
  sessionSummary: string;
  volumeSummary: string;
  intensitySummary: string;
  badgeOneTitle: string;
  badgeOneSub: string;
  badgeTwoTitle: string;
  badgeTwoSub: string;
};

const HERO_COPY: Record<HeroLanguage, HeroCopy> = {
  pt: {
    brandName: 'LyftTrack',
    tagline1: 'Mede o teu esforço,',
    tagline2: 'não apenas as reps.',
    cardHeading: 'Progresso, redefinido.',
    cardDescription: 'combina registo preciso, análise instantânea e um feed minimalista para sessões pesadas.',
    metricLabel: 'Volume Total (kg)',
    ctaHeading: 'Começa a treinar pesado.',
    ctaDescription: 'Junta-te à elite e assume o controlo dos teus treinos hoje.',
    ctaPrimary: 'Entrar na App',
    ctaSecondary: 'Ver sistema',
    mockupKicker: 'Feed de Treino',
    mockupTitle: 'Dia pesado',
    setLabel: 'Sets',
    exerciseName: 'Back Squat',
    tableSet: 'Set',
    tableKg: 'Kg',
    tableReps: 'Reps',
    startSession: 'Iniciar sessão',
    sessionSummary: 'Resumo da sessão',
    volumeSummary: 'Volume: 12.460 kg',
    intensitySummary: 'Intensidade +6,3% vs última semana',
    badgeOneTitle: 'PR +5kg',
    badgeOneSub: 'Marco no squat',
    badgeTwoTitle: 'Tendência de volume',
    badgeTwoSub: '+18% este mês',
  },
  en: {
    brandName: 'LyftTrack',
    tagline1: 'Track the weight,',
    tagline2: 'not just the reps.',
    cardHeading: 'Progress, redefined.',
    cardDescription: 'combines precision logging, instant analytics and a dense minimalist feed for heavy sessions.',
    metricLabel: 'Total Volume (kg)',
    ctaHeading: 'Start lifting heavy.',
    ctaDescription: 'Join the elite and take full control of your training today.',
    ctaPrimary: 'Open Web App',
    ctaSecondary: 'Explore system',
    mockupKicker: 'Workout Feed',
    mockupTitle: 'Heavy day',
    setLabel: 'Sets',
    exerciseName: 'Back Squat',
    tableSet: 'Set',
    tableKg: 'Kg',
    tableReps: 'Reps',
    startSession: 'Start session',
    sessionSummary: 'Session summary',
    volumeSummary: 'Volume: 12,460 kg',
    intensitySummary: 'Intensity up 6.3% vs last week',
    badgeOneTitle: 'PR +5kg',
    badgeOneSub: 'Squat milestone',
    badgeTwoTitle: 'Volume trend',
    badgeTwoSub: '+18% this month',
  },
};

export interface CinematicHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  language?: HeroLanguage;
  metricValue?: number;
}

export function CinematicHero({
  language = 'pt',
  metricValue = 12460,
  className,
  ...props
}: CinematicHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCardRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const copy = HERO_COPY[language];
  const formattedMetricValue = useMemo(
    () => Math.max(0, Math.round(metricValue)).toLocaleString(language === 'pt' ? 'pt-PT' : 'en-US'),
    [language, metricValue]
  );

  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (window.scrollY > window.innerHeight * 2) {
        return;
      }

      cancelAnimationFrame(requestRef.current);

      requestRef.current = requestAnimationFrame(() => {
        if (!mainCardRef.current || !mockupRef.current) {
          return;
        }

        const rect = mainCardRef.current.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        mainCardRef.current.style.setProperty('--mouse-x', `${mouseX}px`);
        mainCardRef.current.style.setProperty('--mouse-y', `${mouseY}px`);

        const xValue = (event.clientX / window.innerWidth - 0.5) * 2;
        const yValue = (event.clientY / window.innerHeight - 0.5) * 2;

        gsap.to(mockupRef.current, {
          rotationY: xValue * 12,
          rotationX: -yValue * 12,
          ease: 'power3.out',
          duration: 1.2,
        });
      });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      const mobileContext = gsap.context(() => {
        gsap.set('.hero-text-wrapper', { autoAlpha: 1, clearProps: 'transform,filter' });
        gsap.set('.cta-wrapper', { autoAlpha: 0 });
        gsap.set('.main-card', { y: 0, autoAlpha: 1 });
        gsap.set(['.card-left-text', '.card-right-text', '.mobile-hero-card'], { autoAlpha: 1 });

        gsap.fromTo(
          ['.text-track', '.text-days'],
          { y: 18, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, ease: 'power3.out', duration: 0.75, stagger: 0.12 }
        );

        gsap.fromTo(
          '.main-card',
          { y: 20, autoAlpha: 0.2 },
          { y: 0, autoAlpha: 1, ease: 'power3.out', duration: 0.8 }
        );
      }, containerRef);

      return () => mobileContext.revert();
    }

    const context = gsap.context(() => {
      gsap.set('.text-track', {
        autoAlpha: 0,
        y: 60,
        scale: 0.85,
        filter: 'blur(20px)',
        rotationX: -20,
      });
      gsap.set('.text-days', { autoAlpha: 1, clipPath: 'inset(0 100% 0 0)' });
      gsap.set('.main-card', { y: window.innerHeight + 200, autoAlpha: 1 });
      gsap.set(['.card-left-text', '.card-right-text', '.mockup-scroll-wrapper', '.floating-badge', '.phone-widget'], {
        autoAlpha: 0,
      });
      gsap.set('.cta-wrapper', { autoAlpha: 0, scale: 0.8, filter: 'blur(30px)' });

      const introTimeline = gsap.timeline({ delay: 0.3 });
      introTimeline
        .to('.text-track', {
          duration: 1.8,
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          rotationX: 0,
          ease: 'expo.out',
        })
        .to(
          '.text-days',
          {
            duration: 1.4,
            clipPath: 'inset(0 0% 0 0)',
            ease: 'power4.inOut',
          },
          '-=1.0'
        );

      const scrollTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: '+=4200',
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });

      scrollTimeline
        .to('.hero-text-wrapper', {
          scale: 1.15,
          filter: 'blur(20px)',
          opacity: 0.2,
          ease: 'power2.inOut',
          duration: 2,
        }, 0)
        .to('.main-card', { y: 0, ease: 'power3.inOut', duration: 2 }, 0)
        .to('.main-card', { width: '100%', height: '100%', borderRadius: '0px', ease: 'power3.inOut', duration: 1.5 })
        .fromTo(
          '.mockup-scroll-wrapper',
          { y: 300, z: -500, rotationX: 50, rotationY: -30, autoAlpha: 0, scale: 0.6 },
          { y: 0, z: 0, rotationX: 0, rotationY: 0, autoAlpha: 1, scale: 1, ease: 'expo.out', duration: 2.5 },
          '-=0.8'
        )
        .fromTo(
          '.phone-widget',
          { y: 40, autoAlpha: 0, scale: 0.95 },
          { y: 0, autoAlpha: 1, scale: 1, stagger: 0.15, ease: 'back.out(1.2)', duration: 1.5 },
          '-=1.5'
        )
        .to('.progress-ring', { strokeDashoffset: 60, duration: 2, ease: 'power3.inOut' }, '-=1.2')
        .to('.counter-val', { innerHTML: metricValue, snap: { innerHTML: 1 }, duration: 2, ease: 'expo.out' }, '-=2.0')
        .fromTo(
          '.floating-badge',
          { y: 100, autoAlpha: 0, scale: 0.7, rotationZ: -10 },
          { y: 0, autoAlpha: 1, scale: 1, rotationZ: 0, ease: 'back.out(1.5)', duration: 1.5, stagger: 0.2 },
          '-=2.0'
        )
        .fromTo('.card-left-text', { x: -50, autoAlpha: 0 }, { x: 0, autoAlpha: 1, ease: 'power4.out', duration: 1.5 }, '-=1.5')
        .fromTo('.card-right-text', { x: 50, autoAlpha: 0, scale: 0.8 }, { x: 0, autoAlpha: 1, scale: 1, ease: 'expo.out', duration: 1.5 }, '<')
        .to({}, { duration: 2.5 })
        .set('.hero-text-wrapper', { autoAlpha: 0 })
        .set('.cta-wrapper', { autoAlpha: 1 })
        .to({}, { duration: 1.5 })
        .to(['.mockup-scroll-wrapper', '.floating-badge', '.card-left-text', '.card-right-text'], {
          scale: 0.9,
          y: -40,
          z: -200,
          autoAlpha: 0,
          ease: 'power3.in',
          duration: 1.2,
          stagger: 0.05,
        })
        .to(
          '.main-card',
          {
            width: isMobile ? '92vw' : '85vw',
            height: isMobile ? '92vh' : '85vh',
            borderRadius: isMobile ? '32px' : '40px',
            ease: 'expo.inOut',
            duration: 1.8,
          },
          'pullback'
        )
        .to('.cta-wrapper', { scale: 1, filter: 'blur(0px)', ease: 'expo.inOut', duration: 1.8 }, 'pullback')
        .to('.main-card', { y: -window.innerHeight - 300, ease: 'power3.in', duration: 1.5 })
        .to({}, { duration: 2.5 });
    }, containerRef);

    return () => context.revert();
  }, [metricValue]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[var(--hero-bg)] font-sans text-[var(--hero-text-primary)] antialiased',
        className
      )}
      style={{ perspective: '1500px' }}
      {...props}
    >
      <style dangerouslySetInnerHTML={{ __html: INJECTED_STYLES }} />
      <NeuralBackground
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
        color="#3B82F6"
        trailOpacity={0.1}
        speed={0.35}
      />

      <div className="hero-text-wrapper absolute z-10 flex w-screen flex-col items-center justify-center px-4 text-center will-change-transform">
        <h1 className="text-track gsap-reveal text-3d-matte mb-2 text-4xl font-bold tracking-tight sm:text-5xl md:text-7xl lg:text-[6rem]">
          {copy.tagline1}
        </h1>
        <h1 className="text-days gsap-reveal text-silver-matte text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-7xl lg:text-[6rem]">
          {copy.tagline2}
        </h1>
      </div>

      <div className="cta-wrapper pointer-events-auto absolute z-10 hidden w-screen flex-col items-center justify-center px-4 text-center will-change-transform md:flex">
        <h2 className="text-silver-matte mb-6 text-3xl font-bold tracking-tight md:text-6xl lg:text-7xl">{copy.ctaHeading}</h2>
        <p className="hero-copy-muted mb-10 mx-auto max-w-xl text-base leading-relaxed md:text-xl">{copy.ctaDescription}</p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <a
            href="https://lyfttrack-app.vercel.app/"
            className="cta-blue inline-flex items-center justify-center gap-2 rounded-[1.1rem] px-8 py-4 text-base font-bold transition-all"
          >
            <Dumbbell className="h-5 w-5" />
            {copy.ctaPrimary}
          </a>
          <Link
            href="#features"
            className="hero-secondary-btn inline-flex items-center justify-center gap-2 rounded-[1.1rem] px-8 py-4 text-base font-bold transition-all"
          >
            <TrendingUp className="h-5 w-5" />
            {copy.ctaSecondary}
          </Link>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" style={{ perspective: '1500px' }}>
        <div
          ref={mainCardRef}
          className="main-card premium-depth-card gsap-reveal pointer-events-auto relative flex h-[86vh] w-[94vw] items-center justify-center overflow-hidden rounded-[28px] md:h-[85vh] md:w-[85vw] md:rounded-[40px]"
        >
          <div className="card-sheen" aria-hidden="true" />

          <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col justify-around gap-4 px-4 py-5 lg:grid lg:grid-cols-3 lg:items-center lg:gap-8 lg:px-12 lg:py-0">
            <div className="card-right-text gsap-reveal order-1 z-20 flex w-full max-w-full justify-center lg:order-3 lg:justify-end">
              <h2 className="text-card-silver-matte break-words text-5xl font-black uppercase tracking-tighter sm:text-6xl md:text-[6rem] lg:text-[5rem] xl:text-[6.5rem]">
                {copy.brandName}
              </h2>
            </div>

            <div
              className="mockup-scroll-wrapper order-2 relative z-10 hidden h-[380px] w-full items-center justify-center md:flex lg:order-2 lg:h-[600px]"
              style={{ perspective: '1000px' }}
            >
              <div className="relative flex h-full w-full scale-[0.72] items-center justify-center md:scale-[0.85] lg:scale-100">
                <div
                  ref={mockupRef}
                  className="iphone-bezel relative flex h-[580px] w-[280px] flex-col rounded-[3rem] will-change-transform"
                >
                  <div className="hardware-btn absolute -left-[3px] top-[120px] z-0 h-[25px] w-[3px] rounded-l-md" aria-hidden="true" />
                  <div className="hardware-btn absolute -left-[3px] top-[160px] z-0 h-[45px] w-[3px] rounded-l-md" aria-hidden="true" />
                  <div className="hardware-btn absolute -left-[3px] top-[220px] z-0 h-[45px] w-[3px] rounded-l-md" aria-hidden="true" />
                  <div
                    className="hardware-btn absolute -right-[3px] top-[170px] z-0 h-[70px] w-[3px] scale-x-[-1] rounded-r-md"
                    aria-hidden="true"
                  />

                  <div className="absolute inset-[7px] z-10 overflow-hidden rounded-[2.5rem] bg-[var(--hero-screen)] text-[var(--hero-text-primary)] shadow-[inset_0_0_15px_rgba(0,0,0,1)]">
                    <div className="screen-glare pointer-events-none absolute inset-0 z-40" aria-hidden="true" />

                    <div className="absolute left-1/2 top-[5px] z-50 flex h-[28px] w-[100px] -translate-x-1/2 items-center justify-end rounded-full bg-[var(--hero-bg)] px-3 shadow-[inset_0_-1px_2px_rgba(255,255,255,0.1)]">
                      <div
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--hero-accent)]"
                        style={{ boxShadow: '0 0 8px var(--hero-accent)' }}
                      />
                    </div>

                    <div className="relative flex h-full w-full flex-col px-5 pb-8 pt-12">
                      <div className="phone-widget mb-6 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="hero-copy-soft mb-1 text-[10px] font-bold uppercase tracking-widest">{copy.mockupKicker}</span>
                          <span className="text-xl font-bold tracking-tight text-[var(--hero-text-primary)] drop-shadow-md">{copy.mockupTitle}</span>
                        </div>
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--hero-widget-border)] bg-[var(--hero-widget-top)] text-[var(--hero-text-muted)] shadow-lg shadow-black/50">
                          <Activity className="h-4 w-4" />
                        </div>
                      </div>

                      <div className="phone-widget widget-depth mb-4 rounded-2xl p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-bold text-[var(--hero-text-primary)]">{copy.exerciseName}</span>
                          <span className="hero-copy-soft text-[10px] font-bold uppercase tracking-wider">{copy.setLabel}</span>
                        </div>

                        <div className="feed-table mb-3">
                          <span className="feed-table-head">{copy.tableSet}</span>
                          <span className="feed-table-head">{copy.tableKg}</span>
                          <span className="feed-table-head">{copy.tableReps}</span>

                          <span className="feed-cell">1</span>
                          <span className="feed-cell">100</span>
                          <span className="feed-cell">5</span>

                          <span className="feed-cell">2</span>
                          <span className="feed-cell">105</span>
                          <span className="feed-cell">4</span>

                          <span className="feed-cell">3</span>
                          <span className="feed-cell">110</span>
                          <span className="feed-cell">3</span>
                        </div>

                        <button type="button" className="cta-blue w-full rounded-xl px-3 py-2 text-xs font-bold tracking-wide">
                          {copy.startSession}
                        </button>
                      </div>

                      <div className="phone-widget relative mb-5 mx-auto flex h-40 w-40 items-center justify-center drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]">
                        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
                          <circle cx="80" cy="80" r="64" fill="none" stroke="var(--hero-ring-track)" strokeWidth="12" />
                          <circle className="progress-ring" cx="80" cy="80" r="64" fill="none" stroke="var(--hero-accent)" strokeWidth="12" />
                        </svg>
                        <div className="z-10 flex flex-col items-center text-center">
                          <span className="counter-val text-4xl font-extrabold tracking-tighter text-[var(--hero-text-primary)]">0</span>
                          <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.1em] hero-copy-soft">{copy.metricLabel}</span>
                        </div>
                      </div>

                      <div className="phone-widget widget-depth rounded-2xl p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="hero-copy-soft text-[11px] font-semibold">{copy.sessionSummary}</span>
                          <Dumbbell className="h-4 w-4 text-[var(--hero-accent)]" />
                        </div>
                        <div className="text-sm font-bold text-[var(--hero-text-primary)]">{copy.volumeSummary}</div>
                        <div className="hero-copy-soft mt-1 text-xs">{copy.intensitySummary}</div>
                      </div>

                      <div className="absolute bottom-2 left-1/2 h-[4px] w-[120px] -translate-x-1/2 rounded-full bg-white/20 shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                    </div>
                  </div>
                </div>

                <div className="floating-badge floating-ui-badge absolute left-[-15px] top-6 z-30 hidden items-center gap-3 rounded-xl p-3 lg:left-[-80px] lg:top-12 lg:flex lg:rounded-2xl lg:p-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--hero-widget-border)] bg-[var(--hero-widget-top)] lg:h-10 lg:w-10">
                    <TrendingUp className="h-4 w-4 text-[var(--hero-accent)]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold tracking-tight text-[var(--hero-text-primary)] lg:text-sm">{copy.badgeOneTitle}</p>
                    <p className="hero-copy-soft text-[10px] font-medium lg:text-xs">{copy.badgeOneSub}</p>
                  </div>
                </div>

                <div className="floating-badge floating-ui-badge absolute bottom-12 right-[-15px] z-30 hidden items-center gap-3 rounded-xl p-3 lg:bottom-20 lg:right-[-80px] lg:flex lg:rounded-2xl lg:p-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--hero-widget-border)] bg-[var(--hero-widget-top)] lg:h-10 lg:w-10">
                    <Activity className="h-4 w-4 text-[var(--hero-accent)]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold tracking-tight text-[var(--hero-text-primary)] lg:text-sm">{copy.badgeTwoTitle}</p>
                    <p className="hero-copy-soft text-[10px] font-medium lg:text-xs">{copy.badgeTwoSub}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-left-text gsap-reveal order-2 z-20 flex w-full flex-col justify-center px-3 text-center md:order-3 lg:order-1 lg:px-0 lg:text-left">
              <h3 className="mb-0 text-xl font-bold tracking-tight text-[var(--hero-text-primary)] sm:text-2xl md:text-3xl lg:mb-5 lg:text-4xl">{copy.cardHeading}</h3>
              <div className="mobile-hero-card mt-4 rounded-2xl border border-[var(--hero-widget-border)] bg-black/55 p-4 text-left md:hidden">
                <p className="hero-copy-soft text-[10px] font-bold uppercase tracking-[0.14em]">{copy.metricLabel}</p>
                <p className="mt-1 text-2xl font-black tracking-tight text-[var(--hero-text-primary)]">{formattedMetricValue} kg</p>
                <p className="hero-copy-muted mt-2 text-sm leading-relaxed">{copy.ctaDescription}</p>

                <div className="mt-4 flex flex-col gap-2">
                  <a
                    href="https://lyfttrack-app.vercel.app/"
                    className="cta-blue inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all"
                  >
                    <Dumbbell className="h-4 w-4" />
                    {copy.ctaPrimary}
                  </a>
                  <Link
                    href="/blog/active-workout-system"
                    className="hero-secondary-btn inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all"
                  >
                    <TrendingUp className="h-4 w-4" />
                    {copy.ctaSecondary}
                  </Link>
                </div>
              </div>

              <p className="hero-copy-muted mx-auto hidden max-w-sm text-sm font-normal leading-relaxed md:block lg:mx-0 lg:max-w-none lg:text-lg">
                <span className="font-semibold text-[var(--hero-text-primary)]">LyftTrack</span> {copy.cardDescription}
              </p>

              <div className="mt-6 hidden flex-col gap-3 md:flex md:flex-row lg:mt-8">
                <a
                  href="https://lyfttrack-app.vercel.app/"
                  className="cta-blue inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all shadow-lg shadow-blue-500/20 hover:-translate-y-0.5"
                >
                  <Dumbbell className="h-4 w-4" />
                  {copy.ctaPrimary}
                </a>
                <Link
                  href="/blog/active-workout-system"
                  className="hero-secondary-btn inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all hover:-translate-y-0.5"
                >
                  <TrendingUp className="h-4 w-4" />
                  {copy.ctaSecondary}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
