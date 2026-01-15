# Seguridad y privacidad

## Modelo
- Sin cuentas y sin backend: los datos residen en el dispositivo.
- Export/import de backups en JSON.

## Principios
- No loggear datos sensibles del usuario (historial, payloads de DB).
- Errores al usuario: mensajes claros, sin SQL crudo.

## Backups
- Export: genera JSON.
- Import: valida estructura antes de escribir.

