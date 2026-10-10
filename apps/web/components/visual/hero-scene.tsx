'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  Environment,
  Float,
  Lightformer,
  MeshTransmissionMaterial,
  RoundedBox,
} from '@react-three/drei';
import type { Group } from 'three';

const GREEN = '#00C853';
const GOLD = '#D9AE5B';
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

function Rig({ pointer }: { pointer: React.MutableRefObject<{ x: number; y: number }> }) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const k = Math.min(1, delta * 3);
    g.rotation.y += (pointer.current.x * 0.35 - 0.18 - g.rotation.y) * k;
    g.rotation.x += (-pointer.current.y * 0.25 + 0.05 - g.rotation.x) * k;
  });

  return (
    <group ref={group}>
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.6}>
        <Phone />
      </Float>

      <Float speed={2.2} rotationIntensity={1.4} floatIntensity={1.2} position={[1.4, 1.45, 0.5]}>
        <mesh rotation={[Math.PI / 2.4, 0, 0]}>
          <cylinderGeometry args={[0.38, 0.38, 0.08, 48]} />
          <meshStandardMaterial color={GOLD} metalness={1} roughness={0.22} />
        </mesh>
      </Float>

      <Float speed={1.8} rotationIntensity={0.6} floatIntensity={1.4} position={[-1.45, -1.25, 0.7]}>
        <mesh>
          <sphereGeometry args={[0.36, 48, 48]} />
          <meshPhysicalMaterial
            color="#B9FFD6"
            transmission={1}
            thickness={0.6}
            roughness={0.05}
            ior={1.4}
            clearcoat={1}
          />
        </mesh>
      </Float>

      <Float speed={2.6} rotationIntensity={2} floatIntensity={0.9} position={[-1.5, 1.2, -0.8]}>
        <mesh>
          <torusGeometry args={[0.24, 0.07, 24, 64]} />
          <meshStandardMaterial color={GREEN} emissive={GREEN} emissiveIntensity={0.8} roughness={0.3} />
        </mesh>
      </Float>
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
  const container = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const el = container.current;
    const observer = el
      ? new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? true))
      : null;
    if (el && observer) observer.observe(el);

    return () => {
      window.removeEventListener('pointermove', onMove);
      observer?.disconnect();
    };
  }, []);

  return (
    <div ref={container} className={className}>
      <Canvas
        dpr={[1, 1.75]}
        frameloop={inView ? 'always' : 'never'}
        camera={{ position: [0, 0, 10], fov: 32 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={() => onReady?.()}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 4, 5]} intensity={1.2} />
        <pointLight position={[-3, -2, 2]} intensity={12} color={GREEN} />

        <Environment resolution={256}>
          <Lightformer form="rect" intensity={3} position={[0, 4, 3]} scale={[8, 1.2, 1]} />
          <Lightformer form="rect" intensity={2} color={GREEN} position={[-4, 0, 2]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
          <Lightformer form="ring" intensity={2.5} color={GOLD} position={[4, 1, 1]} scale={2} />
          <Lightformer form="rect" intensity={1} position={[0, -4, 2]} scale={[8, 0.6, 1]} />
        </Environment>

        <Rig pointer={pointer} />
      </Canvas>
    </div>
  );
}
