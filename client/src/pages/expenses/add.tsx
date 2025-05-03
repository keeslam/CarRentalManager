import { ExpenseForm } from "@/components/expenses/expense-form";
import { useEffect, useState } from "react";

export default function ExpenseAdd() {
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  
  // Extract vehicleId from URL parameters
  useEffect(() => {
    // With wouter, we need to access window.location directly
    const urlParams = new URLSearchParams(window.location.search);
    const vehicleIdParam = urlParams.get("vehicleId");
    
    if (vehicleIdParam) {
      console.log("Found vehicleId in URL:", vehicleIdParam);
      setVehicleId(Number(vehicleIdParam));
    }
  }, []);
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Record New Expense</h1>
      <ExpenseForm preselectedVehicleId={vehicleId} />
    </div>
  );
}
