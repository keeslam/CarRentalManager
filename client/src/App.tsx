import { Switch, Route } from "wouter";
import Dashboard from "@/pages/dashboard";
import VehiclesIndex from "@/pages/vehicles/index";
import VehicleAdd from "@/pages/vehicles/add";
import VehicleDetails from "@/pages/vehicles/[id]";
import VehicleEdit from "@/pages/vehicles/[id]/edit";
import VehicleBulkImport from "@/pages/vehicles/bulk-import";
import CustomersIndex from "@/pages/customers/index";
import CustomerAdd from "@/pages/customers/add";
import CustomerDetails from "@/pages/customers/[id]";
import CustomerEdit from "@/pages/customers/[id]/edit";
import ReservationsIndex from "@/pages/reservations/index";
import ReservationAdd from "@/pages/reservations/add";
import ReservationDetails from "@/pages/reservations/[id]";
import ReservationEdit from "@/pages/reservations/edit/[id]";
import ReservationCalendar from "@/pages/reservations/calendar";
import ExpensesIndex from "@/pages/expenses/index";
import ExpenseAdd from "@/pages/expenses/add";
import DocumentsIndex from "@/pages/documents/index";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import MainLayout from "@/layouts/MainLayout";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/protected-route";

function AppRoutes() {
  return (
    <MainLayout>
      <Switch>
        <ProtectedRoute path="/" component={Dashboard} />
        <ProtectedRoute path="/vehicles" component={VehiclesIndex} />
        <ProtectedRoute path="/vehicles/add" component={VehicleAdd} />
        <ProtectedRoute path="/vehicles/bulk-import" component={VehicleBulkImport} />
        <ProtectedRoute path="/vehicles/:id/edit" component={VehicleEdit} />
        <ProtectedRoute path="/vehicles/:id" component={VehicleDetails} />
        <ProtectedRoute path="/customers" component={CustomersIndex} />
        <ProtectedRoute path="/customers/add" component={CustomerAdd} />
        <ProtectedRoute path="/customers/:id/edit" component={CustomerEdit} />
        <ProtectedRoute path="/customers/:id" component={CustomerDetails} />
        <ProtectedRoute path="/reservations" component={ReservationsIndex} />
        <ProtectedRoute path="/reservations/add" component={ReservationAdd} />
        <ProtectedRoute path="/reservations/calendar" component={ReservationCalendar} />
        <ProtectedRoute path="/reservations/edit/:id" component={ReservationEdit} />
        <ProtectedRoute path="/reservations/:id" component={ReservationDetails} />
        <ProtectedRoute path="/expenses" component={ExpensesIndex} />
        <ProtectedRoute path="/expenses/add" component={ExpenseAdd} />
        <ProtectedRoute path="/documents" component={DocumentsIndex} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
