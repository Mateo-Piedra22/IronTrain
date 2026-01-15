# IronTrain Web

Web estática/SSR para:
- Landing
- Descargas
- Changelog
- FAQ
- Donaciones
- Feed de updates para la app: `/releases.json`

## Requisitos
- Node >= 18.18

## Desarrollo
Desde `website/`:

- `npm install`
- `npm run dev`

## Deploy (Vercel)
Configura Root Directory = `website`.

El contenido se actualiza automáticamente al hacer push, porque lee:
- `../docs/CHANGELOG.md`
- `../docs/DOWNLOADS.json`

