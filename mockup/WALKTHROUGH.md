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

## 4. A 12-pack
1. Choose Sampler Kit - 12 Pack and build a mix of 12.

## 5. Break kits down
1. Disassemble tab: set kits to break down to 2, enter the 6 mini bars in one kit, and check that the summary says 12 mini bars are returned.

## 6. Stock changes underneath you
1. Tick "Simulate: stock changes..." in Mockup controls, try to assemble, and read the message.

## 7. New kit
1. "Create a new kit" on the Assemble tab.

## Questions
- Is assembling the same mix for N kits at once what you need, or do you need a different mix per kit in one go?
- Is a location picker on every action right, or is there a usual "assembly" location?
- Any information missing on screen (cost, flavors low on stock, a print-friendly pick list)?
- Anything confusing about the wording?
