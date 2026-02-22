"use client";

import { useState, FormEvent, ReactNode } from "react";
import { Input } from "../forms/Input";
import { Button } from "../forms/Button";
import { Checkbox } from "../forms/Checkbox";

export interface AccessCardProps {
  initialPanel?: "login" | "register";
  brandName: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister?: (data: RegisterData) => Promise<void>;
  allowRegister?: boolean;
  allowMagicLink?: boolean;
  onMagicLink?: (email: string) => Promise<void>;
  children?: ReactNode;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  organizationName?: string;
}

export function AccessCard({
  initialPanel = "login",
  brandName,
  onLogin,
  onRegister,
  allowRegister = true,
  allowMagicLink = false,
  onMagicLink,
  children,
}: AccessCardProps) {
  const [panel, setPanel] = useState<"login" | "register" | "magic-sent">(initialPanel);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regOrgName, setRegOrgName] = useState("");
  const [accountType, setAccountType] = useState<"individual" | "organization">("individual");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  const [magicEmail, setMagicEmail] = useState("");

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      await onLogin(loginEmail.trim(), loginPassword);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegisterSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onRegister) return;
    setRegError(null);
    setRegLoading(true);
    try {
      await onRegister({
        email: regEmail.trim(),
        password: regPassword,
        fullName: regFullName.trim(),
        organizationName: accountType === "organization" ? regOrgName.trim() : undefined,
      });
    } catch (err) {
      setRegError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setRegLoading(false);
    }
  }

  async function handleMagicLinkSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onMagicLink) return;
    setLoginError(null);
    setLoginLoading(true);
    try {
      await onMagicLink(magicEmail.trim());
      setPanel("magic-sent");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoginLoading(false);
    }
  }

  if (panel === "magic-sent") {
    return (
      <div className="motiona-container motiona-container-md py-12 px-6">
        <div className="motiona-badge mb-4">SYSTEM ACCESS</div>
        <span className="motiona-label">Verificación</span>
        <h1 className="motiona-section-heading mb-8">Enlace Enviado.</h1>

        <div className="motiona-panel bg-white">
          <div className="text-center mb-6">
            <div className="motiona-icon-box w-16 h-16 mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <p className="text-center mb-4">
            Revisá tu correo <strong>{magicEmail}</strong> y hacé clic en el enlace para acceder.
          </p>
          <p className="text-xs text-muted text-center mb-6">
            El enlace expira en 1 hora.
          </p>
          <Button
            variant="secondary"
            className="w-full justify-center"
            onClick={() => {
              setPanel("login");
              setMagicEmail("");
            }}
          >
            Volver al Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="motiona-container motiona-container-md py-12 px-6">
      <div className="motiona-badge mb-4">SYSTEM ACCESS</div>
      <span className="motiona-label">Credenciales</span>
      <h1 className="motiona-section-heading mb-8">
        {panel === "login" ? "Identificación." : "Alta Usuario."}
      </h1>

      <div className="motiona-panel bg-white">
        <div className="flex border-b border-black mb-6">
          <button
            type="button"
            onClick={() => setPanel("login")}
            className={`flex-1 p-3 text-sm font-bold uppercase tracking-wider border-r border-black transition-colors ${
              panel === "login" ? "bg-black text-white" : "bg-transparent text-black hover:bg-black/5"
            }`}
          >
            Login
          </button>
          {allowRegister && (
            <button
              type="button"
              onClick={() => setPanel("register")}
              className={`flex-1 p-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                panel === "register" ? "bg-black text-white" : "bg-transparent text-black hover:bg-black/5"
              }`}
            >
              Registro
            </button>
          )}
        </div>

        {panel === "login" ? (
          <form onSubmit={handleLoginSubmit} className="grid gap-5 p-2">
            <div className="text-sm mb-2">Ingresá tus credenciales operativas.</div>

            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              disabled={loginLoading}
              required
            />
            <Input
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              disabled={loginLoading}
              required
            />

            {loginError && (
              <div className="border border-error bg-red-50 p-3 text-xs text-error font-mono">
                ERROR: {loginError.toUpperCase()}
              </div>
            )}

            <Button
              type="submit"
              isLoading={loginLoading}
              className="w-full justify-center mt-2"
            >
              {loginLoading ? "CONECTANDO..." : "ACCEDER →"}
            </Button>

            {allowMagicLink && (
              <button
                type="button"
                onClick={() => {
                  setMagicEmail(loginEmail);
                  if (loginEmail && onMagicLink) {
                    handleMagicLinkSubmit(new Event("submit") as any);
                  }
                }}
                className="text-xs text-muted hover:text-ink transition-colors text-center"
              >
                Enviar enlace mágico
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="grid gap-5 p-2">
            <div className="text-sm mb-2">Crear nueva cuenta operativa.</div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setAccountType("individual")}
                className={`border border-black p-2 text-xs font-mono uppercase text-center ${
                  accountType === "individual" ? "bg-black text-white" : "bg-transparent text-black"
                }`}
              >
                Individual
              </button>
              <button
                type="button"
                onClick={() => setAccountType("organization")}
                className={`border border-black p-2 text-xs font-mono uppercase text-center ${
                  accountType === "organization" ? "bg-black text-white" : "bg-transparent text-black"
                }`}
              >
                Organización
              </button>
            </div>

            {accountType === "organization" && (
              <Input
                label="Nombre Organización"
                value={regOrgName}
                onChange={(e) => setRegOrgName(e.target.value)}
                disabled={regLoading}
                required
              />
            )}

            <Input
              label="Nombre Completo"
              value={regFullName}
              onChange={(e) => setRegFullName(e.target.value)}
              disabled={regLoading}
              required
            />
            <Input
              label="Email"
              type="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              disabled={regLoading}
              required
            />
            <Input
              label="Contraseña (min 10)"
              type="password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              disabled={regLoading}
              required
              minLength={10}
            />

            <Checkbox
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              disabled={regLoading}
              label={<>Acepto Términos y Política de Privacidad</>}
            />

            {regError && (
              <div className="border border-error bg-red-50 p-3 text-xs text-error font-mono">
                ERROR: {regError.toUpperCase()}
              </div>
            )}

            <Button
              type="submit"
              isLoading={regLoading}
              disabled={!acceptTerms}
              className="w-full justify-center mt-2"
            >
              {regLoading ? "PROCESANDO..." : "CREAR CUENTA →"}
            </Button>
          </form>
        )}
      </div>

      {children && (
        <div className="mt-8">
          {children}
        </div>
      )}
    </div>
  );
}
