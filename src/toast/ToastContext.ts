import { createContext } from "react";

export type ToastContextValue = {
  error: (message: string) => void;
  success: (message: string) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);
