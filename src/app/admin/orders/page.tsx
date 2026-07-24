import { Suspense } from "react";
import OrdersPage from "./OrdersPageClient";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading orders...</p>}>
      <OrdersPage />
    </Suspense>
  );
}
