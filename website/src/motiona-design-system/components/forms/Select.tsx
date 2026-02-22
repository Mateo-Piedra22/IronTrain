"use client";

import { forwardRef, SelectHTMLAttributes } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = "", ...props }, ref) => {
    const selectClasses = `motiona-select ${error ? "border-error" : ""} ${className}`;

    return (
      <div className="w-full">
        {label && (
          <label className="motiona-input-label">
            {label}
          </label>
        )}
        <select ref={ref} className={selectClasses} {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <div className="mt-1 text-xs text-error font-mono">
            ERROR: {error.toUpperCase()}
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
