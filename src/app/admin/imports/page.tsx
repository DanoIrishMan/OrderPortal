import { PageHeader } from "@/components/PageHeader";
import { OrderUploadHub } from "@/components/OrderUploadTabs";

export default function AdminOrderUploadPage() {
  return (
    <div>
      <PageHeader
        title="Order Upload"
        description="Upload in-house PDF orders or the weekly production CSV"
      />
      <OrderUploadHub />
    </div>
  );
}
