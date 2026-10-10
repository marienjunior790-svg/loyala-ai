'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float, Lightformer, RoundedBox } from '@react-three/drei';
import type { Group, Mesh } from 'three';

/** Shared React Three Fiber building blocks for the brand scenes. No remote assets (CSP). */

export const GREEN = '#00C853';
export const GOLD = '#D9AE5B';

type Vec3 = [number, number, number];
type PointerRef = React.MutableRefObject<{ x: number; y: number }>;

/** Window-level pointer in [-1, 1], so scenes behind content still react to the mouse. */
function useWindowPointer(): PointerRef {
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  return pointer;
}

/**
 * Canvas that renders only while on screen and exposes the window pointer to its children.
 * Transparent, so the shader backdrop shows through.
 */
export function SceneCanvas({
  className,
  camera,
  dpr = [1, 1.75],
  onReady,
  children,
}: {
  className?: string;
  camera: { position: Vec3; fov: number };
  dpr?: [number, number];
  onReady?: () => void;
  children: (pointer: PointerRef) => React.ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const pointer = useWindowPointer();
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? true));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={container} className={className}>
      <Canvas
        dpr={dpr}
        frameloop={inView ? 'always' : 'never'}
        camera={camera}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={() => onReady?.()}
      >
        {children(pointer)}
      </Canvas>
    </div>
  );
}

/** Studio lighting built from Lightformers only (drei presets would fetch HDRs from a CDN). */
export function StudioLights() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} />
      <pointLight position={[-3, -2, 2]} intensity={12} color={GREEN} />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 4, 3]} scale={[8, 1.2, 1]} />
        <Lightformer
          form="rect"
          intensity={2}
          color={GREEN}
          position={[-4, 0, 2]}
          rotation-y={Math.PI / 2}
          scale={[6, 2, 1]}
        />
        <Lightformer form="ring" intensity={2.5} color={GOLD} position={[4, 1, 1]} scale={2} />
        <Lightformer form="rect" intensity={1} position={[0, -4, 2]} scale={[8, 0.6, 1]} />
      </Environment>
    </>
  );
}

/** Tilts its children towards the pointer. */
export function ParallaxRig({
  pointer,
  strength = 1,
  baseRotation = [0.05, -0.18],
  children,
}: {
  pointer: PointerRef;
  strength?: number;
  baseRotation?: [number, number];
  children: React.ReactNode;
}) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const k = Math.min(1, delta * 3);
    g.rotation.y += (pointer.current.x * 0.35 * strength + baseRotation[1] - g.rotation.y) * k;
    g.rotation.x += (-pointer.current.y * 0.25 * strength + baseRotation[0] - g.rotation.x) * k;
  });
  return <group ref={group}>{children}</group>;
}

export function GoldCoin({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <Float speed={2.2} rotationIntensity={1.4} floatIntensity={1.2} position={position}>
      <mesh rotation={[Math.PI / 2.4, 0, 0]} scale={scale}>
        <cylinderGeometry args={[0.38, 0.38, 0.08, 48]} />
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.22} />
      </mesh>
    </Float>
  );
}

export function GlassSphere({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <Float speed={1.8} rotationIntensity={0.6} floatIntensity={1.4} position={position}>
      <mesh scale={scale}>
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
  );
}

export function GreenRing({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <Float speed={2.6} rotationIntensity={2} floatIntensity={0.9} position={position}>
      <mesh scale={scale}>
        <torusGeometry args={[0.24, 0.07, 24, 64]} />
        <meshStandardMaterial color={GREEN} emissive={GREEN} emissiveIntensity={0.8} roughness={0.3} />
      </mesh>
    </Float>
  );
}

function TypingDot({ x, delay }: { x: number; delay: number }) {
  const dot = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!dot.current) return;
    const t = (clock.elapsedTime * 2.4 + delay) % (Math.PI * 2);
    dot.current.position.y = Math.max(0, Math.sin(t)) * 0.06;
  });
  return (
    <mesh ref={dot} position={[x, 0, 0.1]}>
      <sphereGeometry args={[0.055, 20, 20]} />
      <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.6} />
    </mesh>
  );
}

/** Frosted green glass chat bubble with an animated typing indicator. */
export function ChatBubble({
  position,
  scale = 1,
  side = 'left',
  tone = 'green',
}: {
  position: Vec3;
  scale?: number;
  side?: 'left' | 'right';
  tone?: 'green' | 'white';
}) {
  const tint = tone === 'green' ? '#7DFFB4' : '#F2FFF7';
  const tailX = side === 'left' ? -0.42 : 0.42;
  return (
    <Float speed={1.6} rotationIntensity={0.5} floatIntensity={1} position={position}>
      <group scale={scale}>
        <RoundedBox args={[1.25, 0.62, 0.16]} radius={0.16} smoothness={5}>
          <meshPhysicalMaterial
            color={tint}
            transmission={0.92}
            thickness={0.5}
            roughness={0.18}
            ior={1.35}
            clearcoat={1}
            emissive={tone === 'green' ? GREEN : '#000000'}
            emissiveIntensity={tone === 'green' ? 0.12 : 0}
          />
        </RoundedBox>
        <mesh
          position={[tailX, -0.36, 0]}
          rotation={[0, 0, side === 'left' ? -0.5 : 0.5]}
        >
          <coneGeometry args={[0.11, 0.24, 24]} />
          <meshPhysicalMaterial color={tint} transmission={0.92} thickness={0.4} roughness={0.18} />
        </mesh>
        <TypingDot x={-0.2} delay={0} />
        <TypingDot x={0} delay={0.7} />
        <TypingDot x={0.2} delay={1.4} />
      </group>
    </Float>
  );
}
