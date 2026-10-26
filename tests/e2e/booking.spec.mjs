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

async function selectSeat(page, seatNumber, tableId="A") {
  const key=tableId+":"+seatNumber;
  const circle=page.locator(`g[data-seat-key="${key}"] circle`).last();
  await circle.click();
  await expect(page.locator(`g[data-seat-key="${key}"] circle`).first()).toHaveAttribute("fill","#f5a047");
}

async function focusTable(page, tableId="A") {
  await page.locator(`rect[data-table-id="${tableId}"]`).click();
}

async function selectTable(page, tableId) {
  await page.locator(`rect[data-seat-key="${tableId}"]`).click();
}

test("family booking assigns two adult seats and one optional child seat for $375", async ({page}) => {
  await begin(page);
  await attendees(page,2,2);
  await page.getByRole("button", { name: "Choose adult seats →" }).click();
  await focusTable(page);
  await selectSeat(page,1);
  await selectSeat(page,2);
  await expect(page.getByText("2/2 adult seats assigned")).toBeVisible();
  await page.getByRole("button", { name: "Children's seats →" }).click();
  await selectSeat(page,3);
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
  await selectSeat(page,1);
  await page.locator('g[data-seat-key="A:1"] circle').last().click();
  await expect(page.getByText("This seat belongs to another guest.", {exact:false})).toBeVisible();
  await expect(page.locator('g[data-seat-key="A:1"] circle').first()).toHaveAttribute("fill","#f5a047");
  await selectSeat(page,2);
  await expect(page.getByRole("button", { name: "Review →" })).toBeEnabled();
});

test("whole-table booking uses table capacity and no individual assignment", async ({page}) => {
  await begin(page,"whole");
  await attendees(page,5);
  await page.getByRole("button", { name: "Choose tables →" }).click();
  await selectTable(page,"A");
  await expect(page.getByText("Available places for adults: 4/5")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review →" })).toBeDisabled();
  await selectTable(page,"B");
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

test("adult admission is included in the table place, even with legacy mode configured", async ({page}) => {
  await begin(page,"legacy");
  await attendees(page,1);
  await page.getByRole("button", { name:"Choose adult seats →" }).click();
  await selectSeat(page,1);
  await page.getByRole("button", { name:"Review →" }).click();
  await expect(page.getByText("$105.00").first()).toBeVisible();
});

test("unpriced adult seats still allow review but show pending price", async ({page}) => {
  await begin(page,"unpriced");
  await attendees(page,1);
  await page.getByRole("button", { name:"Choose adult seats →" }).click();
  await selectSeat(page,1);
  await expect(page.getByRole("button", { name:"Review →" })).toBeEnabled();
  await page.getByRole("button", { name:"Review →" }).click();
  await expect(page.getByRole("heading", { name:"Review your selection" })).toBeVisible();
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

test("editing adult seats preserves another adult and the child's seat", async ({page}) => {
  await begin(page);
  await attendees(page,2,1);
  await page.getByRole("button", { name:"Choose adult seats →" }).click();
  await selectSeat(page,1);
  await selectSeat(page,2);
  await page.getByRole("button", { name:"Children's seats →" }).click();
  await selectSeat(page,3);
  await page.getByRole("button", { name:"Review booking →" }).click();
  await page.getByRole("button", { name:"3 · Adult seats" }).click();
  await page.getByRole("button", { name:/Adult 1.*Table A/ }).click();
  await selectSeat(page,4);
  await expect(page.locator('g[data-seat-key="A:1"] circle').first()).toHaveAttribute("fill","#fff");
  await expect(page.locator('g[data-seat-key="A:2"] circle').first()).toHaveAttribute("fill","#f5a047");
  await expect(page.locator('g[data-seat-key="A:3"] circle').first()).toHaveAttribute("fill","#f5a047");
  await page.getByRole("button", { name:"Children's seats →" }).click();
  await page.getByRole("button", { name:"Review booking →" }).click();
  await expect(page.getByText("Adult 1 — Table A · 4", {exact:false})).toBeVisible();
  await expect(page.getByText("Child 1 — Table A · 3", {exact:false})).toBeVisible();
  await expect(page.getByText("$345.00").first()).toBeVisible();
});

test("changing ticket quantities resets indexed guests and seat assignments", async ({page}) => {
  await begin(page);
  await attendees(page,1,1);
  await page.getByRole("button", { name:"Choose adult seats →" }).click();
  await selectSeat(page,1);
  await page.getByRole("button", { name:"Children's seats →" }).click();
  await page.getByRole("button", { name:"Review booking →" }).click();
  await page.getByRole("button", { name:"1 · Attendees" }).click();
  await page.getByRole("button", { name:"Increase quantity: Adult" }).click();
  await expect(page.getByText("Seats: 0", {exact:false})).toBeVisible();
  await page.getByRole("button", { name:"Enter guest info →" }).click();
  await expect(page.locator("fieldset").first().locator('input[type="text"]')).toHaveValue("");
  await expect(page.locator("fieldset").nth(2).locator("select")).toHaveValue("");
});

test("mobile booking screens do not overflow horizontally", async ({page,isMobile}) => {
  test.skip(!isMobile, "The overflow constraint applies to mobile viewport");
  await begin(page);
  await attendees(page,2,2);
  await page.getByRole("button", { name:"Choose adult seats →" }).click();
  const dimensions=await page.evaluate(()=>({
    clientWidth:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth+2);
});

test("missing adult seat prices never strand a family before child seating", async ({page}) => {
  await begin(page,"unpriced");
  await attendees(page,2,2);
  await page.getByRole("button", { name:"Choose adult seats →" }).click();
  await focusTable(page);
  await selectSeat(page,1);
  await selectSeat(page,2);
  await expect(page.getByText("2/2 adult seats assigned")).toBeVisible();
  await expect(page.getByText("One or more selected seats have no configured price.",{exact:false})).toBeVisible();
  await expect(page.getByRole("button", {name:"Children's seats →"})).toBeEnabled();
  await page.getByRole("button", {name:"Children's seats →"}).click();
  await page.getByRole("button", {name:"Review booking →"}).click();
  await expect(page.getByRole("heading",{name:"Review your selection"})).toBeVisible();
  await expect(page.getByText("Price pending").first()).toBeVisible();
});

test("the venue map is the only seat picker, without a full table-by-table list", async ({page}) => {
  await begin(page);
  await attendees(page,1);
  await page.getByRole("button", { name:"Choose adult seats →" }).click();
  await expect(page.getByRole("heading",{name:"Choose seats by table"})).toHaveCount(0);
  await expect(page.getByRole("group",{name:"Venue seating plan"})).toBeVisible();
  await focusTable(page);
  await selectSeat(page,1);
  await expect(page.getByText("1/1 adult seats assigned")).toBeVisible();
});

test("no adult admission price is displayed before choosing a table place",async({page})=>{
 await begin(page);
 await page.getByRole("button",{name:"Increase quantity: Adult"}).click();
 await expect(page.getByText("Choose a table seat to see the adult price")).toBeVisible();
 await page.getByRole("button",{name:"Enter guest info →"}).click();
 const adult=page.locator("fieldset").first();
 await adult.locator('input[type="text"]').fill("Guest");
 await adult.locator('input[type="email"]').fill("guest@example.com");
 await adult.locator('input[type="tel"]').fill("0211234567");
 await page.getByRole("button",{name:"Choose adult seats →"}).click();
 await focusTable(page);
 await selectSeat(page,1);
 await expect(page.getByText("$105.00").first()).toBeVisible();
 await page.getByRole("button",{name:"Review →"}).click();
 await expect(page.getByText("Included in seat prices")).toBeVisible();
});

test("customer can submit a booking REQUEST and see the saved reference (mock backend)",async({page})=>{
 let request=null;
 let marketingCalls=0;
 await page.route("**/rest/v1/rpc/marketing_opt_in",async route=>{
  marketingCalls++;
  await route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:"true"});
 });
 await page.route("**/rest/v1/rpc/submit_booking",async route=>{
  if(route.request().method()==="OPTIONS"){
   await route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-methods":"POST,OPTIONS","access-control-allow-headers":"authorization,apikey,content-type,x-client-info"}});
   return;
  }
  request=JSON.parse(route.request().postData()??"{}");
  await route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({reference:"YMR-TEST00000001",status:"requested",total_cents:37500})});
 });
 await begin(page,"submit");
 await attendees(page,2,2);
 await page.getByRole("button",{name:"Choose adult seats →"}).click();
 await focusTable(page);
 await selectSeat(page,1);
 await selectSeat(page,2);
 await page.getByRole("button",{name:"Children's seats →"}).click();
 await selectSeat(page,3);
 await page.getByRole("button",{name:"Review booking →"}).click();
 await page.getByRole("checkbox",{name:/I understand Marina\x27s event organisers/}).check();
 await page.getByRole("button",{name:"Submit booking request"}).click();
 await expect(page.getByText("YMR-TEST00000001")).toBeVisible();
 await expect(page.getByText("seats are NOT reserved yet",{exact:false})).toBeVisible();
 expect(request.p_tickets.map(t=>t.quantity)).toEqual([2,2]);
 expect(request.p_guests.map(g=>g.name)).toEqual(["Adult 1","Adult 2","Child 1","Child 2"]);
 expect(request.p_selections.map(s=>s.guest_index)).toEqual([0,1,2]);
 expect(JSON.stringify(request)).not.toContain("price_cents");
 expect(marketingCalls).toBe(0);
});

test("guest form names the missing adult field, focuses it, and then proceeds",async({page})=>{
 await begin(page);
 await page.getByRole("button",{name:"Increase quantity: Adult"}).click();
 await page.getByRole("button",{name:"Increase quantity: Adult"}).click();
 await page.getByRole("button",{name:"Increase quantity: Child"}).click();
 await page.getByRole("button",{name:"Increase quantity: Child"}).click();
 await page.getByRole("button",{name:"Enter guest info →"}).click();
 const guests=page.locator("fieldset");
 for(let i=0;i<2;i++){
  await guests.nth(i).locator('input[type="text"]').fill(i===0?"Marina":"Fox");
  await guests.nth(i).locator('input[type="tel"]').fill("0211234567");
 }
 await guests.nth(0).locator('input[type="email"]').fill("marina@example.com");
 await guests.nth(1).locator('input[type="email"]').fill("wrong-email");
 for(let i=2;i<4;i++){
  await guests.nth(i).locator('input[type="text"]').fill("Child "+(i-1));
  await guests.nth(i).locator("select").selectOption("1");
 }
 await page.getByRole("button",{name:"Choose adult seats →"}).click();
 await expect(page.getByRole("alert")).toContainText("Adult 2: valid email address");
 await expect(page.locator('[data-guest-index="1"][data-guest-field="email"]')).toBeFocused();
 await guests.nth(1).locator('input[type="email"]').fill("fox@example.com");
 await expect(page.getByRole("alert")).toHaveCount(0);
 await page.getByRole("button",{name:"Choose adult seats →"}).click();
 await expect(page.getByRole("heading",{name:"Assign a seat to each adult"})).toBeVisible();
});

test("guest form makes a missing child's parent explicit",async({page})=>{
 await begin(page);
 await attendees(page,1,1);
 await page.locator("fieldset").nth(1).locator("select").selectOption("");
 await page.getByRole("button",{name:"Choose adult seats →"}).click();
 await expect(page.getByRole("alert")).toContainText("Child 1: accompanying adult");
 await expect(page.locator('[data-guest-index="1"][data-guest-field="parent"]')).toBeFocused();
 await page.locator("fieldset").nth(1).locator("select").selectOption("0");
 await page.getByRole("button",{name:"Choose adult seats →"}).click();
 await expect(page.getByRole("heading",{name:"Assign a seat to each adult"})).toBeVisible();
});

test("marketing checkbox is separate, unchecked by default, and only an explicit opt-in is sent",async({page})=>{
 const calls=[];
 await page.route("**/rest/v1/rpc/submit_booking",async route=>{
  calls.push({name:"booking",payload:JSON.parse(route.request().postData()??"{}")});
  await route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({reference:"YMR-TEST00000002",status:"requested",total_cents:10500})});
 });
 await page.route("**/rest/v1/rpc/marketing_opt_in",async route=>{
  calls.push({name:"marketing",payload:JSON.parse(route.request().postData()??"{}")});
  await route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:"true"});
 });
 await begin(page,"submit");
 await attendees(page,1);
 await page.getByRole("button",{name:"Choose adult seats →"}).click();
 await selectSeat(page,1);
 await page.getByRole("button",{name:"Review →"}).click();
 const optIn=page.getByRole("checkbox",{name:"Email me about future Yumorilnik events (optional)"});
 await expect(optIn).not.toBeChecked();
 await optIn.check();
 await page.getByRole("checkbox",{name:/I understand Marina's event organisers/}).check();
 await page.getByRole("button",{name:"Submit booking request"}).click();
 await expect(page.getByText("YMR-TEST00000002")).toBeVisible();
 await expect(page.getByText("Future-event invitations:",{exact:false})).toBeVisible();
 expect(calls.map(c=>c.name)).toEqual(["booking","marketing"]);
 expect(calls[0].payload.p_client_request_id).toBe(calls[1].payload.p_client_request_id);
 expect(calls[1].payload.p_adult_guest_index).toBe(0);
});

test("unsubscribing requires a user click, not merely opening a link",async({page})=>{
 const token="55555555-5555-4555-8555-555555555555";
 let posts=0;
 await page.route("**/rest/v1/rpc/marketing_unsubscribe",async route=>{
  posts++;
  expect(JSON.parse(route.request().postData()??"{}").p_token).toBe(token);
  await route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:"true"});
 });
 await page.goto("/unsubscribe?token="+token);
 await page.getByRole("button",{name:"EN",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Stop future invitations"})).toBeVisible();
 expect(posts).toBe(0);
 await page.getByRole("button",{name:"Unsubscribe from marketing"}).click();
 await expect(page.getByText("Unsubscribed.",{exact:false})).toBeVisible();
 expect(posts).toBe(1);
});
