import { Palette, Bell, Cog, User } from "lucide-react";

export type SettingsTab = "personalization" | "notifications" | "system" | "profile";

export interface SettingsTabMeta {
  id: SettingsTab;
  label: string;
  Icon: typeof Palette;
}

export const SETTINGS_TABS: SettingsTabMeta[] = [
  { id: "personalization", label: "Personalizzazione", Icon: Palette },
  { id: "notifications",   label: "Notifiche",         Icon: Bell },
  { id: "system",          label: "App e sistema",     Icon: Cog },
  { id: "profile",         label: "Profilo utente",    Icon: User },
];
