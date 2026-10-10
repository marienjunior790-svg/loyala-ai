'use client';

import { useThree } from '@react-three/fiber';
import {
  ChatBubble,
  GlassSphere,
  GoldCoin,
  GreenRing,
  ParallaxRig,
  SceneCanvas,
  StudioLights,
} from './scene-kit';

/** Objects pinned to the viewport edges so the centred auth card stays clear. */
function Composition() {
  const { width, height } = useThree((state) => state.viewport);
  const w = width / 2;
  const h = height / 2;

  if (width / height < 0.9) {
    const s = Math.min(1, width / 4.2);
    return (
      <>
        <ChatBubble position={[-w * 0.55, h * 0.8, 0]} scale={0.75 * s} />
        <GoldCoin position={[w * 0.62, h * 0.84, 0.3]} scale={s} />
        <GreenRing position={[w * 0.15, h * 0.9, -0.6]} scale={s} />
        <GlassSphere position={[-w * 0.58, -h * 0.82, 0.4]} scale={s} />
        <ChatBubble position={[w * 0.52, -h * 0.8, 0]} scale={0.6 * s} side="right" tone="white" />
      </>
    );
  }

  return (
    <>
      <ChatBubble position={[-w * 0.62, h * 0.32, 0]} />
      <GoldCoin position={[-w * 0.74, -h * 0.4, 0.4]} scale={1.15} />
      <GreenRing position={[-w * 0.4, h * 0.72, -0.8]} scale={1.2} />
      <GlassSphere position={[-w * 0.36, -h * 0.58, 0.2]} scale={0.8} />
      <GlassSphere position={[w * 0.66, -h * 0.18, 0.6]} scale={1.4} />
      <GoldCoin position={[w * 0.5, h * 0.62, 0.2]} />
      <ChatBubble position={[w * 0.7, -h * 0.56, 0]} scale={0.8} side="right" tone="white" />
      <GreenRing position={[w * 0.82, h * 0.2, -0.6]} scale={0.9} />
    </>
  );
}

export default function AuthScene({ className }: { className?: string }) {
  return (
    <SceneCanvas className={className} camera={{ position: [0, 0, 12], fov: 35 }} dpr={[1, 1.5]}>
      {(pointer) => (
        <>
          <StudioLights />
          <ParallaxRig pointer={pointer} strength={0.6} baseRotation={[0, 0]}>
            <Composition />
          </ParallaxRig>
        </>
      )}
    </SceneCanvas>
  );
}
