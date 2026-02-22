"use client";

import { forwardRef, InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = "", ...props }, ref) => {
    const inputClasses = `motiona-input ${error ? "border-error" : ""} ${className}`;

    return (
      <div className="w-full">
        {label && (
          <label className="motiona-input-label">
            {label}
          </label>
        )}
        <input ref={ref} className={inputClasses} {...props} />
        {error && (
          <div className="mt-1 text-xs text-error font-mono">
            ERROR: {error.toUpperCase()}
          </div>
        )}
        {helperText && !error && (
          <div className="mt-1 text-xs text-muted-2">
            {helperText}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
