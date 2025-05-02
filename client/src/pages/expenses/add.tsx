import { ExpenseForm } from "@/components/expenses/expense-form";

export default function ExpenseAdd() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Record New Expense</h1>
      <ExpenseForm />
    </div>
  );
}
