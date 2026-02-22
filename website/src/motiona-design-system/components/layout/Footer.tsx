"use client";

import { ReactNode } from "react";

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
}

export interface FooterProps {
  brandName: string;
  sections?: FooterSection[];
  copyright?: string;
  children?: ReactNode;
}

export function Footer({ brandName, sections, copyright, children }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-black bg-panel-color mt-16">
      <div className="motiona-container motiona-container-2xl py-12">
        <div className="motiona-grid-4 mb-12">
          <div>
            <div className="font-bold text-lg mb-4">{brandName}</div>
            <p className="text-sm text-muted">
              Sistema enterprise de gestión operativa.
            </p>
          </div>

          {sections?.map((section) => (
            <div key={section.title}>
              <div className="motiona-label mb-4">{section.title}</div>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-muted hover:text-ink transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {children}

        <div className="border-t border-black pt-6 mt-6 flex items-center justify-between text-xs font-mono">
          <div className="opacity-60">
            {copyright || `© ${currentYear} ${brandName}. Todos los derechos reservados.`}
          </div>
          <div className="opacity-60">
            POWERED BY MOTIONA.XYZ
          </div>
        </div>
      </div>
    </footer>
  );
}
