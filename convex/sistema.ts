/**
 * Equivalente a GET /api/health del informe (CP-01).
 */
import { query } from "./_generated/server";

export const salud = query({
  args: {},
  handler: async () => ({ status: "OK", servicio: "Sistema de Reservas y Préstamos FISI" }),
});
