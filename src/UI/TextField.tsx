import type { InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

// A labelled input is more accessible than a placeholder alone: screen readers
// can announce what the field is for, even after the user has typed in it.
export function TextField({ label, id, className = "", ...props }: TextFieldProps) {
  const inputId = id ?? label.toLowerCase().replaceAll(" ", "-");

  return (
    <label className="grid gap-1.5 text-sm font-medium text-[#4d4b48] dark:text-[#d5cec7]" htmlFor={inputId}>
      {label}
      <input
        className={`w-full rounded-lg border border-[#dedad4] bg-white px-3 py-2.5 text-[#292827] outline-none placeholder:text-[#a6a19b] dark:border-[#4b4742] dark:bg-[#211f1d] dark:text-[#f3efea] dark:placeholder:text-[#817a73] ${className}`}
        id={inputId}
        {...props}
      />
    </label>
  );
}
