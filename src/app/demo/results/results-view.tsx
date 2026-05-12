"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { renderResults, type Annotator, type ModelData, type TaskInstance } from "@/lib/render-results";
import styles from "./results.module.css";

type Props = {
  cohort: Annotator[];
  model: ModelData;
  instance: TaskInstance;
  you: Annotator | null;
};

export function ResultsView({ cohort, model, instance, you }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cleanup: (() => void) | null = null;
    let cancelled = false;

    const start = () => {
      if (cancelled || !containerRef.current) return;
      if (!window.Plotly) {
        setTimeout(start, 60);
        return;
      }
      cleanup = renderResults({
        container: containerRef.current,
        cohort,
        model,
        instance,
        you,
      });
    };
    start();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [cohort, model, instance, you]);

  const isYou = !!you;
  const youLabel = isYou ? "You" : "An Annotator";
  const titleH1 = isYou ? "Your Results" : "Annotator Results";
  const titleVs = isYou ? "You vs. AI" : "Annotator vs. AI";
  const titleScore = isYou ? "Your Score" : "Accuracy";
  const titleStrategy = isYou ? "Your Strategy" : "Strategy";
  const titlePace = isYou ? "Your Pace" : "Pace";

  return (
    <main className={styles.page} ref={containerRef}>
      <Script src="https://cdn.plot.ly/plotly-2.35.2.min.js" strategy="afterInteractive" />

      <h1 className={styles.h1}>{titleH1}</h1>

      <h2 className={styles.h2}>{titleVs}</h2>
      <div className={styles.compareGrid}>
        <div className={`${styles.compareCell} ${isYou ? styles.compareCellYou : ""}`}>
          <div className={styles.cellLabel}>{youLabel}</div>
          <canvas className={styles.playCanvas} id="cmp-you" width="224" height="224" />
          <div className={styles.cellStatus} id="cmp-you-status">&nbsp;</div>
        </div>
        <div className={`${styles.compareCell} ${styles.compareCellModel}`}>
          <div className={styles.cellLabel}>Our model</div>
          <canvas className={styles.playCanvas} id="cmp-model" width="224" height="224" />
          <div className={styles.cellStatus} id="cmp-model-status">&nbsp;</div>
        </div>
        <div className={`${styles.compareCell} ${styles.compareCellPlaceholder}`}>
          <div className={styles.cellLabel}>Frontier VLM</div>
          <div className={styles.placeholderBox}>
            Coming soon
            <br />
            <span style={{ opacity: 0.6 }}>Claude / GPT-class</span>
          </div>
          <div className={styles.cellStatus}>&nbsp;</div>
        </div>
      </div>
      <div className={styles.playControls}>
        <button id="play-pause" type="button">⏸ Pause</button>
        <span id="play-time">0.0s / 0.0s</span>
        <div className={styles.playProgressBar}><div className={styles.playProgressFill} id="play-fill" /></div>
      </div>

      <h2 className={styles.h2}>{titleScore}</h2>
      <div className={styles.plot}><div id="plot-accuracy-hist" /></div>
      <p className={styles.explainer}>
        Each of the 15 dots earns a score between 0 and 1: <b>1</b> for a dead-center placement in both the canvas plane and depth, <b>0</b> for a miss, smoothly interpolated in between.{" "}
        {isYou ? "Your " : "The "}
        <b>Accuracy Score</b> is the average across all 15.
      </p>

      <h2 className={styles.h2}>{titleStrategy}</h2>
      <div className={styles.gridTwo}>
        <div className={styles.plot}><div id="plot-mip-hist" /></div>
        <div className={styles.plot}><div id="plot-nav-hist" /></div>
      </div>
      <p className={styles.explainer}>
        <b>MIP toggles</b> count how often {isYou ? "you" : "an annotator"} refreshed {isYou ? "your" : "their"} bird&apos;s-eye view: high counts usually mean less reliance on memory.{" "}
        <b>Z-slice navigations</b> count how often {isYou ? "you" : "they"} stepped through depth: high counts usually mean more verification before each placement. Our model was trained to be careful, so it scores high on both.
      </p>

      <h2 className={styles.h2}>{titlePace}</h2>
      <div className={styles.plot}><div id="plot-duration-hist" /></div>
      <div className={styles.gridTwo}>
        <div className={styles.plot}><div id="plot-hesit-canvas-hist" /></div>
        <div className={styles.plot}><div id="plot-hesit-button-hist" /></div>
      </div>
    </main>
  );
}
