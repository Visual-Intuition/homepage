import CursorFollower from "./cursor-follower";
import FloatingParticles from "./floating-particles";
import TraceAnimation from "./trace-animation";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black">
      <FloatingParticles />
      <CursorFollower />
      <h1 className="relative z-10 -mt-16 max-w-[12ch] px-6 text-center text-5xl leading-relaxed font-extralight tracking-[0.3em] text-white md:max-w-none md:text-7xl">
        Visual Intuition
      </h1>
      <TraceAnimation />
      <p className="absolute bottom-8 z-10 px-4 text-center text-xs tracking-wide text-neutral-500">
        Contact: claire@visualintuition.ai, ishaanchandok@gmail.com
      </p>
    </div>
  );
}
