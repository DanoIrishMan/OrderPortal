import { PageHeader } from "@/components/PageHeader";
import { OrderUploadHub } from "@/components/OrderUploadTabs";

export default function StaffOrderUploadPage() {
  return (
    <div>
      <PageHeader
        title="Order Upload"
        description="Upload in-house PDF orders, stock/embroidery Excel files, or the weekly production CSV for your assigned clients"
      />
      <OrderUploadHub />
    </div>
  );
}
