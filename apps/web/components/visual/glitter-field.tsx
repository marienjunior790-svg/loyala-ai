'use client';

import { useEffect, useRef } from 'react';
import { registerBackdropLayer } from './backdrop-layers';

interface Spark {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
  color: string;
  flare: boolean;
}

const COLORS = [
  { color: '255, 255, 255', weight: 0.55 },
  { color: '61, 255, 149', weight: 0.33 },
  { color: '232, 196, 104', weight: 0.12 },
];
const AREA_PER_SPARK = 7_000;
const FRAME_MS = 1000 / 30;
const MAX_DPR = 1.5;

function pickColor(): string {
  let r = Math.random();
  for (const entry of COLORS) {
    if ((r -= entry.weight) <= 0) return entry.color;
  }
  return COLORS[0]!.color;
}

function createSparks(width: number, height: number): Spark[] {
  const count = Math.round((width * height) / AREA_PER_SPARK);
  return Array.from({ length: count }, () => {
    const flare = Math.random() < 0.08;
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      size: flare ? 1.2 + Math.random() * 1.2 : 0.4 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 1.8,
      color: pickColor(),
      flare,
    };
  });
}

/** Twinkling glitter over the shader backdrop (desktop "full" quality only). */
export default function GlitterField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let sparks: Spark[] = [];
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      sparks = createSparks(window.innerWidth, window.innerHeight);
    };
    resize();
    window.addEventListener('resize', resize);
    const unregister = registerBackdropLayer(canvas, 1);

    let rafId = 0;
    let last = 0;
    const draw = (time: number) => {
      rafId = requestAnimationFrame(draw);
      if (document.hidden || time - last < FRAME_MS) return;
      last = time;

      const t = time / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const s of sparks) {
        const twinkle = Math.pow(Math.max(0, Math.sin(t * s.speed + s.phase)), 6);
        if (twinkle < 0.02) continue;
        const alpha = (s.flare ? 0.95 : 0.7) * twinkle;
        const radius = s.size * (0.6 + twinkle * 0.6);

        ctx.fillStyle = `rgba(${s.color}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (s.flare) {
          const arm = radius * 5;
          ctx.strokeStyle = `rgba(${s.color}, ${alpha * 0.55})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(s.x - arm, s.y);
          ctx.lineTo(s.x + arm, s.y);
          ctx.moveTo(s.x, s.y - arm);
          ctx.lineTo(s.x, s.y + arm);
          ctx.stroke();
        }
      }
    };
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      unregister();
    };
  }, []);

  return <canvas ref={canvasRef} className="animate-backdrop-in absolute inset-0 h-full w-full" />;
}
