/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth_acciones from "../auth/acciones.js";
import type * as auth_usuarios from "../auth/usuarios.js";
import type * as helpers_correo from "../helpers/correo.js";
import type * as helpers_enums from "../helpers/enums.js";
import type * as helpers_errores from "../helpers/errores.js";
import type * as helpers_fechas from "../helpers/fechas.js";
import type * as helpers_permisos from "../helpers/permisos.js";
import type * as helpers_plantillas from "../helpers/plantillas.js";
import type * as helpers_validaciones from "../helpers/validaciones.js";
import type * as recursos_horarios from "../recursos/horarios.js";
import type * as recursos_lugares from "../recursos/lugares.js";
import type * as recursos_objetos from "../recursos/objetos.js";
import type * as seed from "../seed.js";
import type * as sistema from "../sistema.js";
import type * as solicitudes_comun from "../solicitudes/comun.js";
import type * as solicitudes_historial from "../solicitudes/historial.js";
import type * as solicitudes_prestamos from "../solicitudes/prestamos.js";
import type * as solicitudes_reservas from "../solicitudes/reservas.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "auth/acciones": typeof auth_acciones;
  "auth/usuarios": typeof auth_usuarios;
  "helpers/correo": typeof helpers_correo;
  "helpers/enums": typeof helpers_enums;
  "helpers/errores": typeof helpers_errores;
  "helpers/fechas": typeof helpers_fechas;
  "helpers/permisos": typeof helpers_permisos;
  "helpers/plantillas": typeof helpers_plantillas;
  "helpers/validaciones": typeof helpers_validaciones;
  "recursos/horarios": typeof recursos_horarios;
  "recursos/lugares": typeof recursos_lugares;
  "recursos/objetos": typeof recursos_objetos;
  seed: typeof seed;
  sistema: typeof sistema;
  "solicitudes/comun": typeof solicitudes_comun;
  "solicitudes/historial": typeof solicitudes_historial;
  "solicitudes/prestamos": typeof solicitudes_prestamos;
  "solicitudes/reservas": typeof solicitudes_reservas;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
