"use client";

import { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
}

export function Card({ children, hover = false, className = "", ...props }: CardProps) {
  const hoverClass = hover ? "transition-transform hover:-translate-y-2 cursor-pointer" : "";
  return (
    <div className={`motiona-card ${hoverClass} ${className}`} {...props}>
      {children}
    </div>
  );
}
