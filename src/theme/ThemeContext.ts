import { createContext } from "react";

export type Theme = "light" | "dark";

export type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

// The context carries one theme value through the component tree so every
// screen and toggle stays synchronized without passing props through App.
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
