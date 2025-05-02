import { CustomerForm } from "@/components/customers/customer-form";

export default function CustomerAdd() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Add New Customer</h1>
      <CustomerForm />
    </div>
  );
}
