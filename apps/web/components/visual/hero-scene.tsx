'use client';

import { useMemo } from 'react';
import { Float, Html, Sparkles } from '@react-three/drei';
import { ExtrudeGeometry, Shape, ShapeGeometry } from 'three';
import { PHONE_SCREEN_PX, PhoneChatScreen } from '@/components/marketing/phone-chat-screen';
import { CampaignCard, LoyaltyCard, ReturnCard } from '@/components/marketing/hero-float-cards';
import { GoldCoin, ParallaxRig, SceneCanvas, StudioLights } from './scene-kit';

const SCREEN_W = 1.76;
const PX_PER_UNIT = PHONE_SCREEN_PX.width / SCREEN_W;
const SCREEN_H = PHONE_SCREEN_PX.height / PX_PER_UNIT;
/** drei's transform mode maps 1 CSS px to distanceFactor / 400 world units. */
const HTML_DISTANCE_FACTOR = 400 / PX_PER_UNIT;

const BEZEL = 0.06;
const FRAME = 0.035;
const DEPTH = 0.14;
const BEVEL = 0.03;
const FRONT_Z = DEPTH / 2 + BEVEL;

function roundedRect(width: number, height: number, radius: number): Shape {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function SideButton({ x, y, length }: { x: number; y: number; length: number }) {
  return (
    <mesh position={[x, y, 0]}>
      <boxGeometry args={[0.04, length, 0.07]} />
      <meshStandardMaterial color="#2C4636" metalness={1} roughness={0.25} />
    </mesh>
  );
}

function Phone() {
  const glassW = SCREEN_W + BEZEL * 2;
  const glassH = SCREEN_H + BEZEL * 2;
  const bodyW = glassW + FRAME * 2;
  const bodyH = glassH + FRAME * 2;

  const { body, glass } = useMemo(() => {
    const bodyGeometry = new ExtrudeGeometry(roundedRect(bodyW - BEVEL * 2, bodyH - BEVEL * 2, 0.28), {
      depth: DEPTH,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL,
      bevelSegments: 8,
      curveSegments: 32,
    });
    bodyGeometry.center();
    return {
      body: bodyGeometry,
      glass: new ShapeGeometry(roundedRect(glassW, glassH, 0.27), 32),
    };
  }, [bodyW, bodyH, glassW, glassH]);

  return (
    <group>
      <mesh geometry={body}>
        <meshPhysicalMaterial
          color="#3A5847"
          metalness={0.9}
          roughness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.15}
        />
      </mesh>
      <mesh geometry={glass} position={[0, 0, FRONT_Z + 0.001]}>
        <meshPhysicalMaterial color="#010302" roughness={0.08} clearcoat={1} />
      </mesh>

      <SideButton x={-bodyW / 2 - 0.01} y={1.05} length={0.32} />
      <SideButton x={-bodyW / 2 - 0.01} y={0.55} length={0.5} />
      <SideButton x={bodyW / 2 + 0.01} y={0.75} length={0.7} />

      <Html
        transform
        distanceFactor={HTML_DISTANCE_FACTOR}
        position={[0, 0, FRONT_Z + 0.002]}
        pointerEvents="none"
      >
        <div className="relative">
          <PhoneChatScreen />
          <div className="pointer-events-none absolute inset-0 rounded-[2.1rem] bg-[linear-gradient(118deg,rgba(255,255,255,0.13)_0%,rgba(255,255,255,0.03)_32%,transparent_46%)]" />
        </div>
      </Html>
    </group>
  );
}

function FloatingCard({
  position,
  speed,
  children,
}: {
  position: [number, number, number];
  speed: number;
  children: React.ReactNode;
}) {
  return (
    <Float speed={speed} rotationIntensity={0.15} floatIntensity={0.5} position={position}>
      <Html transform distanceFactor={HTML_DISTANCE_FACTOR} pointerEvents="none">
        {children}
      </Html>
    </Float>
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
    <SceneCanvas className={className} camera={{ position: [0, 0, 8.4], fov: 32 }} onReady={onReady}>
      {(pointer) => (
        <>
          <StudioLights />
          <ParallaxRig pointer={pointer} strength={0.8} baseRotation={[0.04, -0.2]}>
            <Float speed={1.2} rotationIntensity={0.12} floatIntensity={0.35}>
              <Phone />
            </Float>

            <FloatingCard position={[1.0, 1.45, 0.7]} speed={1.6}>
              <ReturnCard />
            </FloatingCard>
            <FloatingCard position={[-1.05, -0.1, 0.55]} speed={1.3}>
              <CampaignCard />
            </FloatingCard>
            <FloatingCard position={[1.1, -1.35, 0.85]} speed={1.8}>
              <LoyaltyCard />
            </FloatingCard>

            <GoldCoin position={[-1.4, 1.65, 0.2]} scale={0.9} />
            <Sparkles count={45} scale={[4.6, 5, 2.5]} size={2.4} speed={0.35} opacity={0.7} color="#3DFF95" />
          </ParallaxRig>
        </>
      )}
    </SceneCanvas>
  );
}
