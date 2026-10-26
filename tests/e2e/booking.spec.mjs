import { test, expect } from "@playwright/test";

async function begin(page, scenario="zone") {
  await page.goto("/booking-test?scenario=" + scenario);
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "How many tickets?" })).toBeVisible();
}

async function attendees(page, adults, children=0) {
  for (let i=0;i<adults;i++) await page.getByRole("button", { name: "Increase quantity: Adult" }).click();
  for (let i=0;i<children;i++) await page.getByRole("button", { name: "Increase quantity: Child" }).click();
  await page.getByRole("button", { name: "Enter guest info →" }).click();
  const guests=page.locator("fieldset");
  for (let i=0;i<adults;i++){
    const guest=guests.nth(i);
    await guest.locator('input[type="text"]').fill("Adult " + (i+1));
    await guest.locator('input[type="email"]').fill("adult" + i + "@example.com");
    await guest.locator('input[type="tel"]').fill("0211234567");
  }
  for (let i=0;i<children;i++){
    const guest=guests.nth(adults+i);
    await guest.locator('input[type="text"]').fill("Child " + (i+1));
    await guest.locator("select").selectOption("0");
  }
}

async function openTable(page,label="Table A") {
  const details=page.locator("details").filter({has:page.locator("summary", { hasText:label })});
  if ((await details.getAttribute("open")) === null) {
    await details.locator("summary").click();
  }
}

test("family booking assigns two adult seats and one optional child seat for $375", async ({page}) => {
  await begin(page);
  await attendees(page,2,2);
  await page.getByRole("button", { name: "Choose adult seats →" }).click();
  await openTable(page);
  await page.getByTestId("seat-option-A:1").click();
  await page.getByTestId("seat-option-A:2").click();
  await expect(page.getByText("2/2 adult seats assigned")).toBeVisible();
  await page.getByRole("button", { name: "Children's seats →" }).click();
  await openTable(page);
  await page.getByTestId("seat-option-A:3").click();
  await page.getByRole("button", { name: "Review booking →" }).click();
  await expect(page.getByRole("heading", { name: "Review your selection" })).toBeVisible();
  await expect(page.getByText("$375.00").first()).toBeVisible();
  await expect(page.getByText("1 without a reserved seat", { exact:false })).toBeVisible();
  await expect(page.getByText("Adult 1 — Table A · 1", { exact:false })).toBeVisible();
  await expect(page.getByText("Adult 2 — Table A · 2", { exact:false })).toBeVisible();
  await expect(page.getByText("Child 1 — Table A · 3", { exact:false })).toBeVisible();
});

test("assigned adult seat cannot be silently taken by another guest", async ({page}) => {
  await begin(page);
  await attendees(page,2);
  await page.getByRole("button", { name: "Choose adult seats →" }).click();
  await openTable(page);
  await page.getByTestId("seat-option-A:1").click();
  await page.getByTestId("seat-option-A:1").click();
  await expect(page.getByText("This seat belongs to another guest.", {exact:false})).toBeVisible();
  await expect(page.getByTestId("seat-option-A:1")).toHaveAttribute("aria-pressed","true");
  await page.getByTestId("seat-option-A:2").click();
  await expect(page.getByRole("button", { name: "Review →" })).toBeEnabled();
});

test("whole-table booking uses table capacity and no individual assignment", async ({page}) => {
  await begin(page,"whole");
  await attendees(page,5);
  await page.getByRole("button", { name: "Choose tables →" }).click();
  await page.getByTestId("table-option-A").click();
  await expect(page.getByText("Available places for adults: 4/5")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review →" })).toBeDisabled();
  await page.getByTestId("table-option-B").click();
  await expect(page.getByText("Available places for adults: 6/5")).toBeVisible();
  await page.getByRole("button", { name: "Review →" }).click();
  await expect(page.getByRole("heading", { name:"Selected tables" })).toBeVisible();
  await expect(page.getByText("$320.00").first()).toBeVisible();
});

test("general admission goes directly from guest details to review", async ({page}) => {
  await begin(page,"general");
  await attendees(page,1);
  await expect(page.getByRole("button", { name:"Adult seats" })).toHaveCount(0);
  await page.getByRole("button", { name:"Review →" }).click();
  await expect(page.getByRole("heading", { name:"Review your selection" })).toBeVisible();
  await expect(page.getByText("$45.00").first()).toBeVisible();
});

test("explicit legacy pricing charges admission plus a seat even with zones", async ({page}) => {
  await begin(page,"legacy");
  await attendees(page,1);
  await page.getByRole("button", { name:"Choose adult seats →" }).click();
  await openTable(page);
  await page.getByTestId("seat-option-A:1").click();
  await page.getByRole("button", { name:"Review →" }).click();
  await expect(page.getByText("$60.00").first()).toBeVisible();
});

test("seat without a configured price prevents review", async ({page}) => {
  await begin(page,"unpriced");
  await attendees(page,1);
  await page.getByRole("button", { name:"Choose adult seats →" }).click();
  await openTable(page);
  await page.getByTestId("seat-option-A:1").click();
  await expect(page.getByRole("button", { name:"Review →" })).toBeDisabled();
  await expect(page.getByText("Price pending").first()).toBeVisible();
});

test("language selection persists when navigating through booking steps", async ({page}) => {
  await page.goto("/booking-test?scenario=general");
  await page.getByRole("button", { name:"EN", exact:true }).click();
  await attendees(page,1);
  await expect(page.getByRole("heading", { name:"Guest details" })).toBeVisible();
  await page.getByRole("button", { name:"RU", exact:true }).click();
  await expect(page.getByRole("heading", { name:"Данные гостей" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name:"Сколько билетов?" })).toBeVisible();
});
