"use client";

import { forwardRef, InputHTMLAttributes, ReactNode } from "react";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = "", ...props }, ref) => {
    return (
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          ref={ref}
          type="checkbox"
          className={`motiona-checkbox ${className}`}
          {...props}
        />
        {label && (
          <span className="text-sm opacity-80 leading-tight">
            {label}
          </span>
        )}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";
