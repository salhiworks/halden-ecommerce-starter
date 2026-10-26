import { expect, test } from "@playwright/test";
import { addToBag } from "./fixtures";

test.describe("shopping", () => {
  test("the homepage shows the store's own sections", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Category directory and product rows come from the demo catalog.
    await expect(page.getByRole("link", { name: /Audio & Tech/ }).first()).toBeVisible();
    await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("search finds products from the header", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search" }).first().click();
    await page.getByRole("searchbox", { name: "Search products" }).fill("hoodie");
    await expect(page.getByRole("link", { name: /Heavyweight Hoodie/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/shop\?q=hoodie/);
    await expect(page.getByRole("heading", { name: "Heavyweight Hoodie" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Canvas Tote" })).toHaveCount(0);
  });

  test("a category page lists only its products", async ({ page }) => {
    await page.goto("/categories/bags-accessories");
    await expect(page.getByRole("heading", { name: "Leather Backpack" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fleece Crewneck" })).toHaveCount(0);
  });

  test("a size must be chosen before adding to the bag", async ({ page }) => {
    await page.goto("/products/fleece-crewneck");
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByRole("alert").filter({ hasText: "Size" })).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("button", { name: "M", exact: true }).click();
    await page.getByTestId("add-to-cart").click();
    const bag = page.getByRole("dialog");
    await expect(bag).toBeVisible();
    await expect(bag).toContainText("Fleece Crewneck");
    await expect(bag).toContainText("M");
  });

  test("the bag keeps its lines and totals across pages", async ({ page }) => {
    await addToBag(page, "canvas-tote");
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Canvas Tote" }).or(page.getByText("Canvas Tote").first())).toBeVisible();
    await expect(page.getByText("$24").first()).toBeVisible();
    await expect(page.getByTestId("cart-button")).toContainText("1");
  });

  test("a sold-out size can't be bought", async ({ page }) => {
    // Suede Ankle Boots in 39 have no stock in the demo store.
    await page.goto("/products/suede-ankle-boots");
    await page.getByRole("button", { name: /^39/ }).click();
    await expect(page.getByTestId("add-to-cart")).toBeDisabled();
  });
});
