import { expect, test } from "@playwright/test";
import { addToBag, expectNoHorizontalScroll } from "./fixtures";

/** No page scrolls sideways, from a small phone to a wide desktop. */

const WIDTHS = [320, 390, 768, 1024, 1440];

const STORE_PAGES = [
  "/",
  "/shop",
  "/categories/apparel",
  "/collections/gift-guide",
  "/products/everyday-organic-tee",
  "/cart",
  "/checkout",
  "/pages/contact",
  "/pages/returns",
];

const DASHBOARD_PAGES = ["/admin", "/admin/orders", "/admin/products", "/admin/products/new", "/admin/categories", "/admin/storefront", "/admin/settings"];

for (const width of WIDTHS) {
  test(`shop pages fit a ${width}px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await addToBag(page, "canvas-tote");
    for (const path of STORE_PAGES) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
  });

  test(`dashboard pages fit a ${width}px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of DASHBOARD_PAGES) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
  });
}
