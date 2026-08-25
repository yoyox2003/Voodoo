import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

const variantClasses = {
  primary: "bg-[#d95d47] text-white hover:bg-[#bf4d3a] focus:ring-[#d95d47]",
  secondary:
    "border border-[#dedad4] bg-white text-[#353535] hover:bg-[#f7f4f1] focus:ring-[#d95d47] dark:border-[#494642] dark:bg-[#292724] dark:text-[#eee9e4] dark:hover:bg-[#37332f]",
  danger:
    "text-[#b74131] hover:bg-[#fff0ed] focus:ring-[#d95d47] dark:text-[#ff9680] dark:hover:bg-[#482923]",
  ghost:
    "text-[#706d69] hover:bg-[#f4f1ed] focus:ring-[#d95d47] dark:text-[#bbb3ac] dark:hover:bg-[#302d29]",
};

// This small wrapper prevents every screen from repeating the same accessible
// button styles. The rest operator forwards normal button props such as onClick.
export function Button({
  children,
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-[#1b1a18] disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
