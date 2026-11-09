import { test, expect } from "@playwright/test";

test("la guía de componentes carga y se conecta a Convex", async ({ page }) => {
  await page.goto("/componentes");
  await expect(page.getByText("Guía de Componentes")).toBeVisible();
  await expect(page.getByText("Conexión con Convex:")).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: "e2e/e2e-screenshots/fase0-componentes.png", fullPage: true });
});
