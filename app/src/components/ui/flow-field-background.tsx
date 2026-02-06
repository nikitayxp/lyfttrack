"use client";

import React, { useEffect, useRef } from "react";

interface NeuralBackgroundProps {
  /**
   * Color of the particles.
   * Defaults to a cyan/indigo mix if not specified.
   */
  color?: string;
  /**
   * The opacity of the trails (0.0 to 1.0).
   * Lower = longer trails. Higher = shorter trails.
   * Default: 0.1
   */
  trailOpacity?: number;
  /**
   * Number of particles. Default: 800
   */
  particleCount?: number;
  /**
   * Speed multiplier. Default: 1
   */
  speed?: number;
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
};

const containerStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  backgroundColor: "#000000",
};

const canvasStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
};

export default function NeuralBackground({
  color = "#6366f1", // Default Indigo
  trailOpacity = 0.15,
  particleCount = 600,
  speed = 1,
}: NeuralBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let animationFrameId = 0;
    let resizeObserver: ResizeObserver | undefined;
    const mouse = { x: -1000, y: -1000 };
    const particles: Particle[] = [];

    const resetParticle = (particle: Particle) => {
      particle.x = Math.random() * width;
      particle.y = Math.random() * height;
      particle.vx = 0;
      particle.vy = 0;
      particle.age = 0;
      particle.life = Math.random() * 200 + 100;
    };

    const createParticle = (): Particle => {
      const particle: Particle = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        age: 0,
        life: 0,
      };

      resetParticle(particle);
      return particle;
    };

    const initParticles = () => {
      particles.length = 0;
      for (let i = 0; i < particleCount; i += 1) {
        particles.push(createParticle());
      }
    };

    const resizeCanvas = () => {
      const nextWidth = container.clientWidth;
      const nextHeight = container.clientHeight;

      if (nextWidth <= 0 || nextHeight <= 0) {
        return false;
      }

      width = nextWidth;
      height = nextHeight;

      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      initParticles();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);
      return true;
    };

    const updateParticle = (particle: Particle) => {
      const angle = (Math.cos(particle.x * 0.005) + Math.sin(particle.y * 0.005)) * Math.PI;

      particle.vx += Math.cos(angle) * 0.2 * speed;
      particle.vy += Math.sin(angle) * 0.2 * speed;

      const dx = mouse.x - particle.x;
      const dy = mouse.y - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const interactionRadius = 150;

      if (distance < interactionRadius) {
        const force = (interactionRadius - distance) / interactionRadius;
        particle.vx -= dx * force * 0.05;
        particle.vy -= dy * force * 0.05;
      }

      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.95;
      particle.vy *= 0.95;

      particle.age += 1;
      if (particle.age > particle.life) {
        resetParticle(particle);
      }

      if (particle.x < 0) {
        particle.x = width;
      } else if (particle.x > width) {
        particle.x = 0;
      }

      if (particle.y < 0) {
        particle.y = height;
      } else if (particle.y > height) {
        particle.y = 0;
      }
    };

    const drawFrame = () => {
      if (width > 0 && height > 0) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(0, 0, 0, ${trailOpacity})`;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = color;
        for (const particle of particles) {
          updateParticle(particle);
          const alpha = 1 - Math.abs(particle.age / particle.life - 0.5) * 2;
          ctx.globalAlpha = alpha;
          ctx.fillRect(particle.x, particle.y, 1.5, 1.5);
        }

        ctx.globalAlpha = 1;
      }

      animationFrameId = window.requestAnimationFrame(drawFrame);
    };

    const handleResize = () => {
      resizeCanvas();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    resizeCanvas();
    drawFrame();

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(handleResize);

      resizeObserver.observe(container);
    }

    window.addEventListener("resize", handleResize);
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    // A second sizing pass after first paint prevents first-frame clipping.
    window.requestAnimationFrame(handleResize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [color, trailOpacity, particleCount, speed]);

  return (
    <div ref={containerRef} style={containerStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  );
}
