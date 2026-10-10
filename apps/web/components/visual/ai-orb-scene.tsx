'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import type { Mesh, PointLight } from 'three';
import { GOLD, GREEN, ParallaxRig, SceneCanvas, StudioLights } from './scene-kit';

function Orb() {
  const core = useRef<Mesh>(null);
  const shell = useRef<Mesh>(null);
  const glow = useRef<PointLight>(null);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (core.current) {
      core.current.rotation.x += delta * 0.6;
      core.current.rotation.y += delta * 0.9;
      core.current.scale.setScalar(0.92 + Math.sin(t * 2.2) * 0.06);
    }
    if (shell.current) shell.current.rotation.y -= delta * 0.25;
    if (glow.current) glow.current.intensity = 6 + Math.sin(t * 2.2) * 2.5;
  });

  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={0.8}>
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhysicalMaterial
          color="#C8FFE0"
          transmission={1}
          thickness={1.2}
          roughness={0.04}
          ior={1.45}
          clearcoat={1}
          iridescence={0.6}
          iridescenceIOR={1.3}
        />
      </mesh>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.46, 1]} />
        <meshStandardMaterial
          color={GREEN}
          emissive={GREEN}
          emissiveIntensity={1.6}
          wireframe
        />
      </mesh>
      <mesh ref={shell} rotation={[Math.PI / 2.6, 0, 0]}>
        <torusGeometry args={[1.32, 0.025, 16, 96]} />
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.25} />
      </mesh>
      <pointLight ref={glow} color={GREEN} intensity={6} distance={4} />
    </Float>
  );
}

/** Animated glass "AI" orb for the dashboard insight card. */
export default function AiOrbScene({ className }: { className?: string }) {
  return (
    <SceneCanvas className={className} camera={{ position: [0, 0, 5.2], fov: 35 }} dpr={[1, 2]}>
      {(pointer) => (
        <>
          <StudioLights />
          <ParallaxRig pointer={pointer} strength={1.4} baseRotation={[0, 0]}>
            <Orb />
          </ParallaxRig>
        </>
      )}
    </SceneCanvas>
  );
}
