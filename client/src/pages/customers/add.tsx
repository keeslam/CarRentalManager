import { CustomerForm } from "@/components/customers/customer-form";

export default function CustomerAdd() {
  // Extract pre-fill data from URL parameters (for portal access requests)
  const params = new URLSearchParams(window.location.search);
  const email = params.get("email");
  const name = params.get("name");
  const phone = params.get("phone");

  // Create initial data object if any parameters exist
  const initialData = (email || name || phone) ? {
    name: name || "",
    email: email || "",
    phone: phone || "",
    firstName: "",
    lastName: "",
    companyName: "",
    address: "",
    postalCode: "",
    city: "",
    country: "",
    debtorNumber: "",
    id: 0,
  } : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add New Customer</h1>
        {initialData && (
          <p className="text-sm text-muted-foreground mt-1">
            Pre-filled from portal access request
          </p>
        )}
      </div>
      <CustomerForm initialData={initialData as any} />
    </div>
  );
}
