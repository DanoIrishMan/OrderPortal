import { Suspense } from "react";
import StockOrderImportPage from "./StockOrderImportPageClient";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading...</p>}>
      <StockOrderImportPage />
    </Suspense>
  );
}
