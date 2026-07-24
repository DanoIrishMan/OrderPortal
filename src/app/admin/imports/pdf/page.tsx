import { Suspense } from "react";
import PdfImportPage from "./PdfImportPageClient";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading...</p>}>
      <PdfImportPage />
    </Suspense>
  );
}
