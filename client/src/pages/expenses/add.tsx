import { ExpenseForm } from "@/components/expenses/expense-form";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

export default function ExpenseAdd() {
  const [searchParams] = useLocation();
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  
  // Extract vehicleId from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(searchParams);
    const vehicleIdParam = urlParams.get("vehicleId");
    
    if (vehicleIdParam) {
      setVehicleId(Number(vehicleIdParam));
    }
  }, [searchParams]);
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Record New Expense</h1>
      <ExpenseForm preselectedVehicleId={vehicleId} />
    </div>
  );
}
