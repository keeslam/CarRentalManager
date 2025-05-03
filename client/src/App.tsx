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
import MainLayout from "@/layouts/MainLayout";

function App() {
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/vehicles" component={VehiclesIndex} />
        <Route path="/vehicles/add" component={VehicleAdd} />
        <Route path="/vehicles/bulk-import" component={VehicleBulkImport} />
        <Route path="/vehicles/:id/edit" component={VehicleEdit} />
        <Route path="/vehicles/:id" component={VehicleDetails} />
        <Route path="/customers" component={CustomersIndex} />
        <Route path="/customers/add" component={CustomerAdd} />
        <Route path="/customers/:id/edit" component={CustomerEdit} />
        <Route path="/customers/:id" component={CustomerDetails} />
        <Route path="/reservations" component={ReservationsIndex} />
        <Route path="/reservations/add" component={ReservationAdd} />
        <Route path="/reservations/calendar" component={ReservationCalendar} />
        <Route path="/reservations/edit/:id" component={ReservationEdit} />
        <Route path="/reservations/:id" component={ReservationDetails} />
        <Route path="/expenses" component={ExpensesIndex} />
        <Route path="/expenses/add" component={ExpenseAdd} />
        <Route path="/documents" component={DocumentsIndex} />
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

export default App;
