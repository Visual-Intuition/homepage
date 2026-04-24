"use client";

import { useEffect, useRef } from "react";

interface Point {
  x: number;
  y: number;
}

export default function TraceAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let w: number;
    let h: number;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const path: Point[] = [];
    const totalPoints = 600;
    let leaderIndex = 0;
    const followerDelay = 80;
    const followerNoise: Point[] = [];

    function generatePath() {
      path.length = 0;
      followerNoise.length = 0;

      const cx = w / 2;
      const cy = h / 2;
      const rx = w * 0.45;
      const ry = h * 0.35;

      for (let i = 0; i < totalPoints; i++) {
        const t = i / totalPoints;
        const a = t * Math.PI * 2;

        // all modulation frequencies are integers so they complete full cycles over 2*PI
        const drift = Math.sin(3 * a) * rx * 0.15;
        const wobble = Math.cos(2 * a) * ry * 0.1;
        const rScale = 0.8 + Math.sin(a) * 0.2;
        const yScale = 0.85 + Math.sin(2 * a) * 0.15;

        path.push({
          x: cx + Math.cos(a) * (rx + drift) * rScale,
          y: cy + Math.sin(a) * (ry + wobble) * yScale,
        });

        // noise also uses integer harmonics of 2*PI for seamless loop
        const amp = 10;
        followerNoise.push({
          x: Math.sin(3 * a + 1.7) * amp + Math.sin(7 * a + 0.3) * amp * 0.4,
          y: Math.cos(2 * a + 3.1) * amp + Math.cos(5 * a + 2.1) * amp * 0.4,
        });
      }
    }
    generatePath();

    const speed = 1.5;
    const trailLen = 120;

    function getPathPoint(index: number): Point {
      return path[((index % totalPoints) + totalPoints) % totalPoints];
    }

    function getNoisePoint(index: number): Point {
      return followerNoise[((index % totalPoints) + totalPoints) % totalPoints];
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);

      leaderIndex = (leaderIndex + speed) % totalPoints;
      const followerIndex =
        (leaderIndex - followerDelay + totalPoints) % totalPoints;

      const li = Math.floor(leaderIndex);
      const fi = Math.floor(followerIndex);

      // leader trail
      {
        ctx!.beginPath();
        const start = li - trailLen;
        const p0 = getPathPoint(start);
        ctx!.moveTo(p0.x, p0.y);
        for (let i = start + 1; i <= li; i++) {
          const p = getPathPoint(i);
          ctx!.lineTo(p.x, p.y);
        }
        const pStart = getPathPoint(start);
        const pEnd = getPathPoint(li);
        const grad = ctx!.createLinearGradient(
          pStart.x, pStart.y, pEnd.x, pEnd.y
        );
        grad.addColorStop(0, "rgba(255, 255, 255, 0)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0.3)");
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.5;
        ctx!.stroke();
      }

      // leader dot
      {
        const p = getPathPoint(li);
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 12, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx!.fill();
      }

      // follower trail
      {
        const start = fi - trailLen;
        const p0 = getPathPoint(start);
        const n0 = getNoisePoint(start);
        const sx = p0.x + n0.x;
        const sy = p0.y + n0.y;
        ctx!.beginPath();
        ctx!.moveTo(sx, sy);
        for (let i = start + 1; i <= fi; i++) {
          const p = getPathPoint(i);
          const n = getNoisePoint(i);
          ctx!.lineTo(p.x + n.x, p.y + n.y);
        }
        const pf = getPathPoint(fi);
        const nf = getNoisePoint(fi);
        const fGrad = ctx!.createLinearGradient(
          sx, sy, pf.x + nf.x, pf.y + nf.y
        );
        fGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
        fGrad.addColorStop(1, "rgba(120, 180, 255, 0.25)");
        ctx!.strokeStyle = fGrad;
        ctx!.lineWidth = 1.5;
        ctx!.stroke();
      }

      // follower dot
      {
        const p = getPathPoint(fi);
        const n = getNoisePoint(fi);
        const fx = p.x + n.x;
        const fy = p.y + n.y;
        ctx!.beginPath();
        ctx!.arc(fx, fy, 5, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(120, 180, 255, 0.9)";
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(fx, fy, 10, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(120, 180, 255, 0.1)";
        ctx!.fill();
      }

      animationId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="relative z-10 mt-8 h-64 w-full px-4 sm:h-80"
      aria-hidden="true"
    />
  );
}
