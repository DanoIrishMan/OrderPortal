import { parseStockOrderXlsx, stockOrderToParsedRow } from "../src/lib/stock-order-xlsx-parser";

async function main() {
  const p = await parseStockOrderXlsx(
    "public/samples/Bohemians FC European Set A95937 04.08.26.xlsx"
  );
  const row = stockOrderToParsedRow(p);
  console.log(
    JSON.stringify(
      {
        orderNumber: p.orderNumber,
        customerName: p.customerName,
        totalQuantity: p.totalQuantity,
        lineItems: p.lineItems.map((i) => ({
          desc: i.description,
          qty: i.quantity,
          sizes: i.sizes,
        })),
        embroidery: p.embroidery,
        section: p.section,
        rowQty: row.quantity,
        rowOrder: row.orderNumber,
        warnings: p.warnings,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
