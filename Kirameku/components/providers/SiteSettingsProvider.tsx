"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  createDefaultSiteSettings,
  type SiteSettings,
} from "@/lib/site-settings";

const SiteSettingsContext = createContext<SiteSettings | null>(null);

/**
 * Supplies the admin-managed site settings to client components.
 *
 * The server component renders this provider with a value already loaded from
 * the `site_settings` config row, so client components never fetch it
 * themselves and the first paint already shows the configured content.
 */
export function SiteSettingsProvider({
  value,
  children,
}: {
  value: SiteSettings;
  children: ReactNode;
}) {
  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

/**
 * Reads the current site settings. Falls back to the built-in defaults when a
 * component renders outside the provider (admin shell, isolated tests) so a
 * missing provider can never crash the page.
 */
export function useSiteSettings(): SiteSettings {
  return useContext(SiteSettingsContext) ?? createDefaultSiteSettings();
}
