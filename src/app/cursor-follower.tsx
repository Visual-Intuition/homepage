"use client";

import { useEffect, useRef } from "react";

export default function CursorFollower() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;

    function resize() {
      dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    let targetX = w / 2;
    let targetY = h / 2;
    let dotX = targetX;
    let dotY = targetY;
    let visible = false;

    function onMove(e: PointerEvent) {
      targetX = e.clientX;
      targetY = e.clientY;
      visible = true;
    }
    function onLeave() {
      visible = false;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);

    const lag = 0.12;
    const noiseAmp = 18;
    const fx1 = 0.00045;
    const fx2 = 0.00081;
    const fy1 = 0.00057;
    const fy2 = 0.00033;
    const px1 = 1.7;
    const px2 = 4.2;
    const py1 = 0.6;
    const py2 = 2.9;

    let animationId: number;
    let opacity = 0;

    function draw(t: number) {
      ctx!.clearRect(0, 0, w, h);

      dotX += (targetX - dotX) * lag;
      dotY += (targetY - dotY) * lag;

      const targetOpacity = visible ? 1 : 0;
      opacity += (targetOpacity - opacity) * 0.08;

      const nx =
        Math.sin(t * fx1 + px1) * noiseAmp +
        Math.sin(t * fx2 + px2) * noiseAmp * 0.5;
      const ny =
        Math.cos(t * fy1 + py1) * noiseAmp +
        Math.cos(t * fy2 + py2) * noiseAmp * 0.5;

      const x = dotX + nx;
      const y = dotY + ny;

      if (opacity > 0.01) {
        ctx!.beginPath();
        ctx!.arc(x, y, 22, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(168, 120, 255, ${0.08 * opacity})`;
        ctx!.fill();

        ctx!.beginPath();
        ctx!.arc(x, y, 12, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(178, 130, 255, ${0.18 * opacity})`;
        ctx!.fill();

        ctx!.beginPath();
        ctx!.arc(x, y, 5, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(196, 156, 255, ${0.95 * opacity})`;
        ctx!.fill();
      }

      animationId = requestAnimationFrame(draw);
    }

    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      aria-hidden="true"
    />
  );
}
