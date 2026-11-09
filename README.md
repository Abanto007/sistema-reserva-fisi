# Sistema de Reservas y Préstamos FISI

Sistema web de reservas de espacios y préstamos de recursos de la FISI - UNMSM (Grupo 5).

- **Frontend:** React 18 + Vite + React Router
- **Backend y base de datos:** Convex (funciones en `convex/`, esquema en `convex/schema.ts`)
- **Pruebas:** Vitest + convex-test (backend) y Playwright (E2E)
- **Gestor de paquetes:** pnpm (no usar npm)

## Requisitos

- Node.js 22 o superior (`node -v`)
- pnpm (`npm install -g pnpm`, una sola vez)
- Una cuenta en [convex.dev](https://convex.dev)

## Primera vez

```bash
pnpm install          # instala dependencias
pnpm convex dev       # inicia sesión en Convex, crea el proyecto y genera .env.local
```

Deja `pnpm convex dev` abierto (sube y vigila las funciones). En **otra terminal**:

```bash
pnpm seed             # crea el admin superior, espacios, equipos y horarios de prueba
pnpm dev              # abre la web en http://localhost:5173
```

Usuario administrador de prueba: `carlos.admin@unmsm.edu.pe` / `Admin123`.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo del frontend |
| `pnpm convex dev` | Sube las funciones de Convex y vigila cambios |
| `pnpm seed` | Carga datos de prueba (no duplica si ya existen) |
| `pnpm test` | Pruebas del backend (no tocan tu deployment) |
| `pnpm test:e2e` | Pruebas E2E con Playwright |
| `pnpm typecheck` | Revisa tipos de las funciones de Convex |
| `pnpm build` | Compila el frontend para producción |

## Estructura

Monolito modular en una sola carpeta (un solo `package.json`), como el diagrama del
documento de arquitectura. El backend se organiza por dominio:

```
convex/
  _generated/          lo genera `pnpm convex dev` (no editar)
  schema.ts            tablas e índices (traducción del modelo SQL v4)
  seed.ts, sistema.ts  datos de prueba y verificación de salud
  auth/
    acciones.ts        actions de registro, login, bloqueo y recuperación con OTP (HU-U01)
    usuarios.ts        usuarios y roles (RBAC), validación de personal (HU-U02)
  recursos/
    lugares.ts         espacios
    objetos.ts         equipos y su stock
    horarios.ts        bloques de horario y calendario (HU-H01, HU-H02)
  solicitudes/
    reservas.ts        reserva de espacio (HU-S01)
    prestamos.ts       préstamo de equipos y conjuntas (HU-S02)
    historial.ts       mis solicitudes y filtros (HU-S03)
    comun.ts           ayudantes compartidos (detalle, correo de confirmación)
  helpers/
    permisos.ts        withAuth, checkRole y roles permitidos
    validaciones.ts    formatos y rangos (los CHECK del SQL)
    enums.ts, errores.ts, fechas.ts, plantillas.ts, correo.ts (Nodemailer, "use node")
  tests/               pruebas con convex-test
src/
  main.jsx, App.jsx    arranque y rutas
  assets/styles/       tokens.css y global.css
  components/          componentes reutilizables
  hooks/               hooks sobre Convex (useSesion)
  lib/                 utilidades de fechas, errores y textos
  pages/               una página por pantalla
public/                favicon
e2e/                   pruebas Playwright
docs/referencia-bd/    diseño SQL de referencia y tabla de equivalencias SQL → Convex
```

En iteraciones siguientes se suman `solicitudes/validacion.ts` (HU-A01) y
`comentarios/calificaciones.ts`, como en el diagrama.

## Rutas

| Ruta | Quién | Historia |
| --- | --- | --- |
| `/login`, `/registro`, `/recuperar` | Todos | HU-U01, HU-U02 |
| `/inicio` | Con sesión | Dashboard |
| `/admin/validacion` | Administrativo aprobado | HU-U02 |
| `/admin/horarios` | Administrativo aprobado | HU-H01, HU-H02 |
| `/solicitudes/espacio` | Alumno, docente, foráneo, externo | HU-S01 |
| `/solicitudes/equipos` | Alumno, docente, foráneo, externo | HU-S02 |
| `/mis-solicitudes` | Alumno, docente, foráneo, externo | HU-S03 |
| `/componentes` | Todos | Guía visual de componentes |

## Para los compañeros del grupo

1. Clona el repositorio y entra a la carpeta (sin OneDrive, espacios ni tildes en la ruta).
2. `pnpm install`
3. `pnpm convex dev`: inicia sesión con tu cuenta de Convex. Si te invitaron al equipo de Convex del grupo,
   elige el proyecto existente; si no, crea uno nuevo. Esto genera **tu** `.env.local` (no se sube a Git).
4. En otra terminal: `pnpm seed` y luego `pnpm dev`.

Cada integrante trabaja con su propio deployment de desarrollo, así que los datos de prueba no se mezclan.
