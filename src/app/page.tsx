import CursorFollower from "./cursor-follower";
import FloatingParticles from "./floating-particles";
import Title from "./title";
import TraceAnimation from "./trace-animation";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black">
      <FloatingParticles />
      <CursorFollower />
      <Title />
      <TraceAnimation />
      <p className="absolute bottom-8 z-10 px-4 text-center text-xs tracking-wide text-neutral-500">
        Contact: claire@visualintuition.ai, ishaanchandok@gmail.com
      </p>
    </div>
  );
}
