# Google OAuth + Vincular Cuenta (Neon Auth gestionado)

## Objetivo
Eliminar `state_mismatch` en `SignIn`, `SignUp` y `Vincular Google` usando Neon Auth gestionado con dominios confiables y callbacks correctos.

## 1) Neon Auth (Dashboard)
1. Ir a Neon > Auth > Configuration > Domains.
2. Confirmar que estén cargados los dominios reales de app:
	- `https://irontrain.motiona.xyz`
	- (opcional) `https://www.irontrain.motiona.xyz` si usás ese host
3. No usar dominios inventados/no provisionados para auth.

## 2) DNS
No se requiere crear CNAME adicional para Neon Auth en este flujo.

Verificación rápida:
- El login debe iniciar y volver a `irontrain.motiona.xyz` sin bloqueos por dominio.

## 3) Variables de entorno activas
En `website/.env` (y en Vercel Environment Variables):
- `NEON_AUTH_BASE_URL=https://ep-falling-wind-aca65w0x.neonauth.sa-east-1.aws.neon.tech/neondb/auth`
- `NEON_AUTH_SERVICE_URL=https://ep-falling-wind-aca65w0x.neonauth.sa-east-1.aws.neon.tech/neondb/auth`
- `NEXT_PUBLIC_APP_URL=https://irontrain.motiona.xyz`
- `NEXT_PUBLIC_NEON_AUTH_DIRECT_URL=https://ep-falling-wind-aca65w0x.neonauth.sa-east-1.aws.neon.tech/neondb/auth`

Notas:
- No definir `NEON_AUTH_COOKIE_DOMAIN` salvo que Neon indique explícitamente soporte para ese modo en tu proyecto.

## 4) Vercel
1. Project `irontrain-web` > Settings > Environment Variables.
2. Copiar los mismos valores de arriba para Production (y Preview si aplica).
3. Redeploy completo del deployment de `master`.

## 5) Prueba E2E mínima (obligatoria)
## A. Sign In con Google
1. Abrir `https://irontrain.motiona.xyz/auth/sign-in`.
2. Click `Continuar con Google`.
3. Completar Google.
4. Debe volver a `/auth/bridge` y luego al destino sin `state_mismatch`.

## B. Sign Up con Google
1. Abrir `https://irontrain.motiona.xyz/auth/sign-up`.
2. Click `Registrarme con Google`.
3. Completar Google.
4. Debe completar bridge/onboarding sin error de cookies.

## C. Vincular Google
1. Iniciar sesión con email/password.
2. Ir a `/auth/account`.
3. Click `Vincular Google`.
4. Completar Google.
5. Debe volver con `linked=google` y mostrar estado `Google: VINCULADO`.

## 6) Señales esperadas en logs
- NO debe aparecer: `Cookies can only be modified in a Server Action or Route Handler` en `/auth/bridge`.
- NO debe aparecer: `state_mismatch` en callback de OAuth.
- Debe verse intercambio de verificador en middleware y luego sesión válida.

## 7) Si falla todavía
1. Confirmar que Vercel usa las nuevas variables en el deployment actual.
2. Confirmar que `https://irontrain.motiona.xyz` está en trusted domains de Neon Auth.
3. Probar en ventana incógnito para eliminar cookies viejas.
4. Verificar que no haya requests OAuth entrando por dominio `*.vercel.app` (deben forzarse a `irontrain.motiona.xyz`).
