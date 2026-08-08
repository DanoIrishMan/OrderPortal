import { Suspense } from "react";
import StockOrderImportPage from "@/app/admin/imports/stock-order/StockOrderImportPageClient";

export default function StaffStockOrderImportPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading...</p>}>
      <StockOrderImportPage />
    </Suspense>
  );
}
