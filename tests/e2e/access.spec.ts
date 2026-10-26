import { expect, test } from "@playwright/test";
import { NO_SESSION, OWNER } from "./fixtures";

/** Everything here runs as a visitor who is not signed in. */
test.use({ storageState: NO_SESSION });

test("every dashboard page sends visitors to the sign-in screen", async ({ page }) => {
  for (const path of ["/admin", "/admin/orders", "/admin/products", "/admin/products/new", "/admin/categories", "/admin/storefront", "/admin/settings"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/admin\/login$/);
  }
});

test("the setup screen closes once the store has an owner", async ({ page }) => {
  await page.goto("/admin/setup");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("a wrong password is refused", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "don't match" })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("photo uploads need a signed-in owner", async ({ request }) => {
  const response = await request.post("/api/admin/media", {
    multipart: { file: { name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) } },
  });
  expect(response.status()).toBe(401);
});

test("an order page is private without its secret link", async ({ page }) => {
  const response = await page.goto("/orders/00000000-0000-4000-8000-000000000000?key=guess");
  expect(response?.status()).toBe(404);
});

test("the dashboard asks search engines not to index it", async ({ request }) => {
  const response = await request.get("/admin/login");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
});
