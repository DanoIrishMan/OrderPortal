import { Suspense } from "react";
import PdfImportPage from "@/app/admin/imports/pdf/PdfImportPageClient";

export default function StaffPdfImportPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading...</p>}>
      <PdfImportPage />
    </Suspense>
  );
}
