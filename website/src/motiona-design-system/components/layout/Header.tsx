"use client";

import { ReactNode } from "react";

export interface HeaderProps {
  brandName: string;
  logo?: ReactNode;
  navigation?: { label: string; href: string }[];
  ctaButton?: { label: string; href: string; onClick?: () => void };
  children?: ReactNode;
}

export function Header({ brandName, logo, navigation, ctaButton, children }: HeaderProps) {
  return (
    <header className="border-b border-black bg-bg-color sticky top-0 z-50">
      <div className="motiona-container motiona-container-2xl">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            {logo && <div className="w-10 h-10">{logo}</div>}
            <div className="font-semibold text-lg tracking-tight">{brandName}</div>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {navigation?.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm uppercase font-mono tracking-wider text-muted hover:text-ink transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {ctaButton && (
            <a
              href={ctaButton.href}
              onClick={ctaButton.onClick}
              className="motiona-btn-primary text-sm py-2 px-4"
            >
              {ctaButton.label} →
            </a>
          )}

          {children}
        </div>
      </div>
    </header>
  );
}
