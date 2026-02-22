"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  isLoading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  isLoading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const baseClass = variant === "primary"
    ? "motiona-btn-primary"
    : variant === "secondary"
    ? "motiona-btn-secondary"
    : "motiona-btn-primary bg-error";

  const finalClass = `${baseClass} ${className}`;

  return (
    <button
      className={finalClass}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
          <span>PROCESANDO...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
