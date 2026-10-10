'use client';

import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';

/** Loaded through next/dynamic only — keeps three.js out of the initial bundle. */
export default function ShaderBackdrop() {
  return (
    <ShaderGradientCanvas
      className="animate-backdrop-in"
      style={{ position: 'absolute', inset: 0 }}
      pixelDensity={1}
      fov={45}
      pointerEvents="none"
      lazyLoad={false}
      powerPreference="low-power"
    >
      <ShaderGradient
        control="props"
        type="waterPlane"
        animate="on"
        uSpeed={0.08}
        uStrength={3}
        uDensity={1.6}
        uFrequency={5.5}
        uAmplitude={0}
        positionX={0}
        positionY={0}
        positionZ={0}
        rotationX={50}
        rotationY={0}
        rotationZ={-60}
        color1="#00C853"
        color2="#000000"
        color3="#001A0B"
        reflection={0.1}
        brightness={0.58}
        lightType="3d"
        cAzimuthAngle={180}
        cPolarAngle={90}
        cDistance={3.2}
        cameraZoom={8}
        grain="off"
      />
    </ShaderGradientCanvas>
  );
}
