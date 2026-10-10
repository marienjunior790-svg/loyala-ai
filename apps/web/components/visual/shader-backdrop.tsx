'use client';

import { useEffect, useRef } from 'react';
import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';
import { registerBackdropLayer } from './backdrop-layers';

/** Loaded through next/dynamic only — keeps three.js out of the initial bundle. */
export default function ShaderBackdrop() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let unregister: (() => void) | null = null;
    const attach = () => {
      const canvas = wrapper.querySelector('canvas');
      if (!canvas || unregister) return Boolean(canvas);
      unregister = registerBackdropLayer(canvas, 0);
      return true;
    };

    if (attach()) return () => unregister?.();

    const observer = new MutationObserver(() => {
      if (attach()) observer.disconnect();
    });
    observer.observe(wrapper, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      unregister?.();
    };
  }, []);

  return (
    <div ref={wrapperRef} className="absolute inset-0">
      <ShaderGradientCanvas
        className="animate-backdrop-in"
        style={{ position: 'absolute', inset: 0 }}
        pixelDensity={1}
        fov={45}
        pointerEvents="none"
        lazyLoad={false}
        powerPreference="low-power"
        preserveDrawingBuffer
      >
        <ShaderGradient
          control="props"
          type="waterPlane"
          animate="on"
          uSpeed={0.12}
          uStrength={3.4}
          uDensity={1.4}
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
          color3="#00341A"
          reflection={0.18}
          brightness={0.95}
          lightType="3d"
          cAzimuthAngle={180}
          cPolarAngle={90}
          cDistance={3.2}
          cameraZoom={8}
          grain="on"
        />
      </ShaderGradientCanvas>
    </div>
  );
}
