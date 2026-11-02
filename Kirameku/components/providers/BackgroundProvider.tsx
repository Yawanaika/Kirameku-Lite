"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSiteSettings } from "@/components/providers/SiteSettingsProvider";

interface BackgroundContextType {
  bgImage: string;
  bgBlur: number;
  setBgImage: (img: string) => void;
  setBgBlur: (blur: number) => void;
}

const BackgroundContext = createContext<BackgroundContextType>({
  bgImage: "",
  bgBlur: 0,
  setBgImage: () => {},
  setBgBlur: () => {},
});

export function useBackground() {
  return useContext(BackgroundContext);
}

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const { appearance } = useSiteSettings();
  const bgImages = appearance.bgImages;
  const [bgImage, setBgImage] = useState(
    bgImages[bgImages.length - 1] ?? ""
  );
  const [bgBlur, setBgBlur] = useState(20);
  const [mounted, setMounted] = useState(false);

  // Restore persisted preferences after hydration; server render uses defaults.
  /* eslint-disable react-hooks/set-state-in-effect -- restore persisted client preferences after hydration */
  useEffect(() => {
    const savedImg = localStorage.getItem("bg-image");
    const savedBlur = localStorage.getItem("bg-blur");

    if (savedImg && bgImages.includes(savedImg)) {
      setBgImage(savedImg);
    } else {
      setBgImage(bgImages[bgImages.length - 1] ?? "");
    }

    setBgBlur(savedBlur ? Number(savedBlur) : 20);
    setMounted(true);
  }, [bgImages]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("bg-image", bgImage);
    }
  }, [bgImage, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("bg-blur", String(bgBlur));
    }
  }, [bgBlur, mounted]);

  return (
    <BackgroundContext.Provider value={{ bgImage, bgBlur, setBgImage, setBgBlur }}>
      {children}
    </BackgroundContext.Provider>
  );
}
