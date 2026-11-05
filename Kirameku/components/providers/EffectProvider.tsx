"use client";

import { createContext, useContext, ReactNode } from "react";
import { useStoredBoolean } from "@/lib/client-storage";
import { useReducedMotion } from "@/lib/reduced-motion";

interface EffectContextType {
  clickEffect: boolean;
  mouseTrail: boolean;
  seasonalEffect: boolean;
  sparkleEffect: boolean;
  /** 系统开启了「减少动态效果」，装饰性 canvas 特效一律不挂载。 */
  reducedMotion: boolean;
  toggleClickEffect: () => void;
  toggleMouseTrail: () => void;
  toggleSeasonalEffect: () => void;
  toggleSparkleEffect: () => void;
}

const EffectContext = createContext<EffectContextType>({
  clickEffect: true,
  mouseTrail: false,
  seasonalEffect: false,
  sparkleEffect: false,
  reducedMotion: false,
  toggleClickEffect: () => {},
  toggleMouseTrail: () => {},
  toggleSeasonalEffect: () => {},
  toggleSparkleEffect: () => {},
});

export function EffectProvider({ children }: { children: ReactNode }) {
  // 开关状态直接存在 localStorage 里，useStoredBoolean 负责读取与跨标签页同步，
  // 不需要先渲染默认值再在 effect 里纠正。
  const [clickEffect, setClickEffect] = useStoredBoolean("clickEffect", true);
  const [mouseTrail, setMouseTrail] = useStoredBoolean("mouseTrail");
  const [seasonalEffect, setSeasonalEffect] = useStoredBoolean("seasonalEffect");
  const [sparkleEffect, setSparkleEffect] = useStoredBoolean("sparkleEffect");
  const reducedMotion = useReducedMotion();

  const toggleClickEffect = () => setClickEffect((prev) => !prev);
  const toggleMouseTrail = () => setMouseTrail((prev) => !prev);
  const toggleSeasonalEffect = () => setSeasonalEffect((prev) => !prev);
  const toggleSparkleEffect = () => setSparkleEffect((prev) => !prev);

  return (
    <EffectContext.Provider value={{ clickEffect, mouseTrail, seasonalEffect, sparkleEffect, reducedMotion, toggleClickEffect, toggleMouseTrail, toggleSeasonalEffect, toggleSparkleEffect }}>
      {children}
    </EffectContext.Provider>
  );
}

export function useEffects() {
  return useContext(EffectContext);
}
