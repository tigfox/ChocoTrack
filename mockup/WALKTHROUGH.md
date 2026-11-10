# Feedback walkthrough

Run `docker compose up --build` and open http://localhost:8080. Try each scenario, then note answers to the questions at the end.

## 1. Assemble a 6-pack
1. Location: Main Warehouse. Kit: Sampler Kit - 6 Pack. Kits to assemble: 3.
2. Add any 6 mini flavors per kit (use + buttons, the quantity box, or type a SKU/barcode and press Enter).
3. Watch the "Mix per kit" panel reach 6 / 6, then click Assemble.
4. Read the confirmation: do the inventory changes match what you would expect?

## 2. Hit a shortage
1. Set kits to assemble to 10 and add 6 x "Mini - Desert Flower" (low stock).
2. Note the warning and the disabled button.

## 3. Wrong location
1. Switch location to Retail Shop, add "Mini - Uganda 72%" (not stocked there).

## 4. A 12-pack and a 4-pack
1. Choose Sampler Kit - 12 Pack and build a mix of 12. Watch the box preview fill a 2 x 6 grid.
2. Choose Sampler Kit - 4 Pack (1 x 4 grid) and build a mix of 4.

## 5. Print a pick list
1. Build a mix for 2 kits and click **Print pick list** (you don't have to print before assembling).
2. Check the sheet in the print preview: totals to pick, stock on hand, the box layout, and the sign-off line.

## 6. Break kits down
1. Disassemble tab: set kits to break down to 2, enter the 6 mini bars in one kit, and check that the summary says 12 mini bars are returned.

## 7. Stock changes underneath you
1. Tick "Simulate: stock changes..." in Mockup controls, try to assemble, and read the message.

## 8. New kit
1. "Create a new kit" on the Assemble tab.

## Questions
- Is assembling the same mix for N kits at once what you need, or do you need a different mix per kit in one go?
- Is a location picker on every action right, or is there a usual "assembly" location?
- Is the box preview (names on tiles here; product photos in the real app) useful? Does the layout match your boxes?
- Is anything missing from the pick list?
- Any information missing on screen (cost, flavors low on stock, a print-friendly pick list)?
- Anything confusing about the wording?
