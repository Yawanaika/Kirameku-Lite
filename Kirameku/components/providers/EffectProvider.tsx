"use client";

import { createContext, useContext, ReactNode } from "react";
import { useStoredBoolean } from "@/lib/client-storage";

interface EffectContextType {
  clickEffect: boolean;
  mouseTrail: boolean;
  seasonalEffect: boolean;
  sparkleEffect: boolean;
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

  const toggleClickEffect = () => setClickEffect((prev) => !prev);
  const toggleMouseTrail = () => setMouseTrail((prev) => !prev);
  const toggleSeasonalEffect = () => setSeasonalEffect((prev) => !prev);
  const toggleSparkleEffect = () => setSparkleEffect((prev) => !prev);

  return (
    <EffectContext.Provider value={{ clickEffect, mouseTrail, seasonalEffect, sparkleEffect, toggleClickEffect, toggleMouseTrail, toggleSeasonalEffect, toggleSparkleEffect }}>
      {children}
    </EffectContext.Provider>
  );
}

export function useEffects() {
  return useContext(EffectContext);
}
