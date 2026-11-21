# TruckTrack Frontend

[![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)](https://trucktrack-salims-projects-1bde5f7a.vercel.app)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=salimomrani_trucktrack&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=salimomrani_trucktrack)

**Live:** https://trucktrack-salims-projects-1bde5f7a.vercel.app

Interface utilisateur Angular 21 pour le suivi GPS de flottes de camions en temps réel.

L'application permet aux gestionnaires de flotte de :
- Visualiser tous les camions sur une carte interactive (Leaflet)
- Suivre les positions en temps réel via WebSocket
- Consulter l'historique des trajets avec playback
- Gérer les geofences (zones géographiques)
- Configurer et recevoir des alertes (vitesse, geofence, offline)

## Quick Start

```bash
cd frontend
npm install
npm start
```

**Access:** http://localhost:4200

## Demo estática en GitHub Pages

La demo se presenta como **MicroTrack** con tema oscuro predeterminado y funciona de forma independiente de la aplicación conectada: usa posiciones y recorridos sintéticos, ofrece controles de reproducción, geocercas y alertas de ejemplo, y no inicia sesión ni realiza llamadas al backend. Los colores de marca y tema se pueden ajustar en las variables CSS de `demo.component.scss`. El mapa usa teselas públicas de OpenStreetMap con un filtro oscuro y necesita conexión a Internet.

Para ejecutarla localmente:

```bash
cd frontend
npm ci --legacy-peer-deps
npm run start:demo
```

Abre http://localhost:4200. Para generar el artefacto con la ruta de GitHub Pages:

```bash
npm run build:demo
```

El workflow `.github/workflows/pages.yml` publica `frontend/dist/trucktrack-demo/browser` en Pages al actualizar `master`. Después de integrar el workflow, configura **Settings → Pages → Build and deployment → Source: GitHub Actions** en el repositorio. La URL resultante usa la ruta `/trucktrack/`.

## Features

- **Live Map** - Real-time truck positions with Leaflet
- **Search/Filter** - Find trucks by status, name
- **History** - Route playback with infinite scroll pagination
- **Geofences** - Draw and manage zones
- **Alerts** - Configure rules, view notifications

## Project Structure

```
src/app/
├── core/           # Services, guards, interceptors
├── features/
│   ├── auth/       # Login
│   ├── map/        # Live tracking
│   ├── history/    # Route history
│   ├── geofences/  # Geofence management
│   └── alerts/     # Notifications
└── shared/         # Components, pipes
```

## Environment

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000',
  wsUrl: 'ws://localhost:8081/ws'
};
```

## Commands

```bash
npm start           # Dev server
npm run build       # Production build
npm test            # Unit tests
npm run lint        # Lint check
```

## Tech Stack

- Angular 21.0.6
- Angular Material 21.0.5
- TypeScript 5.9.3
- Leaflet 1.9.4 (maps)
- RxJS 7.8.2
- NgRx 21.x (state management)

### Angular 21 Features

- **Block Control Flow** - Modern `@if`/`@for` syntax
- **Signals** - Reactive state management
- **Esbuild** - Fast production builds
- **Zoneless Ready** - Can enable zoneless change detection
