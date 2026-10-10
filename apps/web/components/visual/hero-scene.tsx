'use client';

import { Float, MeshTransmissionMaterial, RoundedBox } from '@react-three/drei';
import {
  GOLD,
  GREEN,
  GlassSphere,
  GoldCoin,
  GreenRing,
  ParallaxRig,
  SceneCanvas,
  StudioLights,
} from './scene-kit';

const SCREEN_HALF_WIDTH = 0.84;

type BubbleSpec = { y: number; width: number; side: 'in' | 'out'; tone?: 'gold' };

const BUBBLES: BubbleSpec[] = [
  { y: 0.95, width: 1.15, side: 'in' },
  { y: 0.52, width: 0.78, side: 'in' },
  { y: 0.02, width: 1.02, side: 'out' },
  { y: -0.5, width: 1.22, side: 'in', tone: 'gold' },
  { y: -1.02, width: 0.72, side: 'out' },
];

function Bubble({ y, width, side, tone }: BubbleSpec) {
  const x =
    side === 'in' ? -SCREEN_HALF_WIDTH + 0.12 + width / 2 : SCREEN_HALF_WIDTH - 0.12 - width / 2;
  const color = tone === 'gold' ? GOLD : side === 'out' ? GREEN : '#E6F4EA';
  return (
    <RoundedBox args={[width, 0.34, 0.05]} radius={0.12} smoothness={4} position={[x, y, -0.03]}>
      <meshStandardMaterial
        color={color}
        roughness={0.35}
        metalness={tone === 'gold' ? 0.6 : 0.05}
        emissive={color}
        emissiveIntensity={side === 'out' ? 0.45 : 0.08}
      />
    </RoundedBox>
  );
}

function Phone() {
  return (
    <group>
      <RoundedBox args={[1.9, 3.8, 0.22]} radius={0.24} smoothness={6}>
        <MeshTransmissionMaterial
          samples={6}
          resolution={512}
          thickness={0.35}
          roughness={0.1}
          transmission={1}
          ior={1.35}
          chromaticAberration={0.06}
          anisotropicBlur={0.15}
          distortion={0.12}
          distortionScale={0.4}
          temporalDistortion={0.06}
          color="#E3FFEE"
        />
      </RoundedBox>

      <RoundedBox args={[1.68, 3.56, 0.02]} radius={0.18} smoothness={4} position={[0, 0, -0.07]}>
        <meshStandardMaterial color="#03140A" roughness={0.7} emissive="#003A1B" emissiveIntensity={0.4} />
      </RoundedBox>

      {/* Chat header: avatar + name line */}
      <mesh position={[-0.6, 1.5, -0.03]}>
        <circleGeometry args={[0.13, 32]} />
        <meshStandardMaterial color={GREEN} emissive={GREEN} emissiveIntensity={0.6} />
      </mesh>
      <RoundedBox args={[0.7, 0.08, 0.02]} radius={0.04} position={[-0.05, 1.5, -0.03]}>
        <meshStandardMaterial color="#CFE9D8" emissive="#CFE9D8" emissiveIntensity={0.15} />
      </RoundedBox>

      {BUBBLES.map((b) => (
        <Bubble key={b.y} {...b} />
      ))}
    </group>
  );
}

export default function HeroScene({
  className,
  onReady,
}: {
  className?: string;
  onReady?: () => void;
}) {
  return (
    <SceneCanvas className={className} camera={{ position: [0, 0, 10], fov: 32 }} onReady={onReady}>
      {(pointer) => (
        <>
          <StudioLights />
          <ParallaxRig pointer={pointer}>
            <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.6}>
              <Phone />
            </Float>
            <GoldCoin position={[1.4, 1.45, 0.5]} />
            <GlassSphere position={[-1.45, -1.25, 0.7]} />
            <GreenRing position={[-1.5, 1.2, -0.8]} />
          </ParallaxRig>
        </>
      )}
    </SceneCanvas>
  );
}
