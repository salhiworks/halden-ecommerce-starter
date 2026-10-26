import { expect, test, type Page } from "@playwright/test";
import { expectToast } from "./fixtures";

/** The owner manages the catalog; every change shows up in the shop. */

test.describe.configure({ mode: "serial" });

const PHOTO = "public/demo/products/insulated-steel-bottle/1.jpg";

async function openProduct(page: Page, name: string) {
  await page.goto(`/admin/products?q=${encodeURIComponent(name)}`);
  await page.getByRole("link", { name }).first().click();
  await expect(page.getByTestId("product-name")).toHaveValue(name);
}

async function save(page: Page, toast = "Product saved") {
  await page.getByTestId("save-product").click();
  await expectToast(page, toast);
}

test("create a product with a photo and sizes, and see it in the shop", async ({ page }) => {
  await page.goto("/admin/products");
  await page.getByTestId("new-product").click();
  await expect(page).toHaveURL(/\/admin\/products\/new$/);

  await page.getByTestId("product-name").fill("Trail Water Bottle");
  await page.getByLabel("Short line").fill("Keeps water cold for a day's walk");

  await page.locator('input[type="file"]').first().setInputFiles(PHOTO);
  await expect(page.getByLabel("Description of photo 1")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Description of photo 1").fill("Steel water bottle on a white table");

  await page.getByRole("button", { name: "Add an option" }).click();
  await expect(page.getByLabel("Option name")).toHaveValue("Size");
  const values = page.getByLabel("Add a value to Size");
  await values.fill("500 ml");
  await values.press("Enter");
  await values.fill("750 ml");
  await values.press("Enter");

  await page.getByLabel("Price for 500 ml", { exact: true }).fill("30");
  await page.getByLabel("Price for 750 ml", { exact: true }).fill("36");
  await page.getByRole("switch", { name: "Track stock" }).click();
  await page.getByLabel("Stock for 500 ml", { exact: true }).fill("4");
  await page.getByLabel("Stock for 750 ml", { exact: true }).fill("0");

  await page.getByLabel("Category").selectOption({ label: "Home & Kitchen" });
  await page.getByRole("radio", { name: /^Active/ }).check();
  await page.getByTestId("save-product").click();
  await expectToast(page, "Product created");
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);

  await page.goto("/products/trail-water-bottle");
  await expect(page.getByRole("heading", { level: 1, name: "Trail Water Bottle" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Steel water bottle on a white table" }).first()).toBeVisible();
  await expect(page.getByText("$30").first()).toBeVisible();
  // The 750 ml has no stock: shown, but not buyable.
  await page.getByRole("button", { name: /^750 ml/ }).click();
  await expect(page.getByTestId("add-to-cart")).toBeDisabled();

  await page.goto("/categories/home-kitchen");
  await expect(page.getByRole("heading", { name: "Trail Water Bottle" })).toBeVisible();
});

test("a price change is live at once", async ({ page }) => {
  await openProduct(page, "Trail Water Bottle");
  await page.getByLabel("Price for 500 ml", { exact: true }).fill("28");
  await save(page);
  await page.goto("/products/trail-water-bottle");
  await expect(page.getByText("$28").first()).toBeVisible();
});

test("a draft is hidden from the shop, and archived products explain themselves", async ({ page }) => {
  await openProduct(page, "Trail Water Bottle");
  await page.getByRole("radio", { name: /^Draft/ }).check();
  await save(page);
  expect((await page.goto("/products/trail-water-bottle"))?.status()).toBe(404);
  await page.goto("/shop?q=trail");
  await expect(page.getByRole("heading", { name: "Trail Water Bottle" })).toHaveCount(0);

  await openProduct(page, "Trail Water Bottle");
  await page.getByRole("radio", { name: /^Archived/ }).check();
  await save(page);
  await page.goto("/products/trail-water-bottle");
  await expect(page.getByTestId("add-to-cart")).toHaveCount(0);
});

test("delete a product", async ({ page }) => {
  await openProduct(page, "Trail Water Bottle");
  await page.getByRole("button", { name: "Delete product" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete product" }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  expect((await page.goto("/products/trail-water-bottle"))?.status()).toBe(404);
});

test("categories: create, hide and delete", async ({ page }) => {
  await page.goto("/admin/categories");
  await page.getByTestId("new-category").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Garden Tools");
  await expect(dialog.getByLabel("URL handle")).toHaveValue("garden-tools");
  await dialog.getByTestId("save-grouping").click();
  await expectToast(page, "Garden Tools created");

  // An empty category stays out of the shop's menu, but its page exists.
  expect((await page.goto("/categories/garden-tools"))?.status()).toBe(200);

  await page.goto("/admin/categories");
  await page.getByRole("listitem").filter({ hasText: "Garden Tools" }).getByRole("button", { name: "Edit" }).click();
  await page.getByRole("dialog").getByRole("switch", { name: "Visible in the store" }).click();
  await page.getByRole("dialog").getByTestId("save-grouping").click();
  await expectToast(page, "Garden Tools saved");
  expect((await page.goto("/categories/garden-tools"))?.status()).toBe(404);

  await page.goto("/admin/categories");
  await page.getByRole("listitem").filter({ hasText: "Garden Tools" }).getByRole("button", { name: "Edit" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete category" }).click();
  await expectToast(page, "Garden Tools deleted");
  await expect(page.getByRole("listitem").filter({ hasText: "Garden Tools" })).toHaveCount(0);
});

test("categories can be reordered", async ({ page }) => {
  await page.goto("/admin/categories");
  const names = page.getByTestId("grouping-name");
  const first = await names.first().textContent();
  const second = await names.nth(1).textContent();
  await page.getByRole("button", { name: `Move ${second} up` }).click();
  await expect(names.first()).toHaveText(second!);
  await page.reload();
  await expect(names.first()).toHaveText(second!);
  // Put it back for the other tests.
  await page.getByRole("button", { name: `Move ${first} up` }).click();
  await expect(names.first()).toHaveText(first!);
});

test("collections: hand-pick products from any category", async ({ page }) => {
  await page.goto("/admin/collections");
  await page.getByTestId("new-collection").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Weekend Picks");
  await dialog.getByLabel("Find a product").fill("tote");
  await dialog.getByRole("checkbox", { name: /Canvas Tote/ }).check();
  await dialog.getByLabel("Find a product").fill("dutch");
  await dialog.getByRole("checkbox", { name: /Dutch Oven/ }).check();
  await expect(dialog).toContainText("2 selected");
  await dialog.getByTestId("save-grouping").click();
  await expectToast(page, "Weekend Picks created");

  await page.goto("/collections/weekend-picks");
  await expect(page.getByRole("heading", { name: "Canvas Tote" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Dutch Oven/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fleece Crewneck" })).toHaveCount(0);

  // Clean up: the products stay, only the collection goes.
  await page.goto("/admin/collections");
  await page.getByRole("listitem").filter({ hasText: "Weekend Picks" }).getByRole("button", { name: "Edit" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete collection" }).click();
  await expectToast(page, "Weekend Picks deleted");
  expect((await page.goto("/products/canvas-tote"))?.status()).toBe(200);
});
