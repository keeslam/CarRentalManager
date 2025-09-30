import { Switch, Route, Redirect } from "wouter";
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
import ExpenseDetails from "@/pages/expenses/[id]";
import VehicleExpensesPage from "@/pages/expenses/vehicle/[id]";
import DocumentsIndex from "@/pages/documents/index";
import ContractViewer from "@/pages/documents/contract/[id]";
import TemplateEditor from "@/pages/documents/template-editor";
import ReportsPage from "@/pages/reports/index";
import NotificationsPage from "@/pages/notifications/index";
import CustomNotificationsPage from "@/pages/notifications/custom-notifications";
import CustomerCommunications from "@/pages/CustomerCommunications";
import SearchResults from "@/pages/search-results";
import UsersIndex from "@/pages/users/index";
import UserAdd from "@/pages/users/add";
import UserDetails from "@/pages/users/[id]";
import UserEdit from "@/pages/users/[id]/edit";
import ProfilePage from "@/pages/profile";
import ProfileEditPage from "@/pages/profile/edit";
import ChangePasswordPage from "@/pages/profile/change-password";
import BackupPage from "@/pages/admin/backup";
import MaintenanceCalendar from "@/pages/maintenance/calendar";
import SettingsPage from "@/pages/settings/index";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import MainLayout from "@/layouts/MainLayout";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { SocketProvider } from "@/hooks/use-socket";
import { ProtectedRoute } from "@/components/protected-route";

function AppRoutes() {
  const { user } = useAuth();
  
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
        <ProtectedRoute path="/reservations" component={ReservationCalendar} />
        <ProtectedRoute path="/reservations/add" component={ReservationAdd} />
        <ProtectedRoute path="/reservations/list" component={ReservationsIndex} />
        <ProtectedRoute path="/reservations/edit/:id" component={ReservationEdit} />
        <ProtectedRoute path="/reservations/:id" component={ReservationDetails} />
        <ProtectedRoute path="/maintenance" component={MaintenanceCalendar} />
        <ProtectedRoute path="/expenses" component={ExpensesIndex} />
        <ProtectedRoute path="/expenses/add" component={ExpenseAdd} />
        <ProtectedRoute path="/expenses/vehicle/:id" component={VehicleExpensesPage} />
        <ProtectedRoute path="/expenses/edit/:id" component={ExpenseAdd} />
        <ProtectedRoute path="/expenses/:id" component={ExpenseDetails} />
        <ProtectedRoute path="/documents" component={DocumentsIndex} />
        <ProtectedRoute path="/documents/contract/:id" component={ContractViewer} />
        <ProtectedRoute path="/documents/template-editor" component={TemplateEditor} />
        <ProtectedRoute path="/reports" component={ReportsPage} />
        <ProtectedRoute path="/notifications" component={NotificationsPage} />
        <ProtectedRoute path="/notifications/custom" component={CustomNotificationsPage} />
        <ProtectedRoute path="/communications" component={CustomerCommunications} />
        <Route path="/search-results">
          {() => {
            const { user } = useAuth();
            return user ? <SearchResults /> : <Redirect to="/auth" />;
          }}
        </Route>
        <ProtectedRoute path="/users" component={UsersIndex} />
        <ProtectedRoute path="/users/add" component={UserAdd} />
        <ProtectedRoute path="/users/:id/edit" component={UserEdit} />
        <ProtectedRoute path="/users/:id" component={UserDetails} />
        <ProtectedRoute path="/profile" component={ProfilePage} />
        <ProtectedRoute path="/profile/edit" component={ProfileEditPage} />
        <ProtectedRoute path="/profile/change-password" component={ChangePasswordPage} />
        <ProtectedRoute path="/admin/backup" component={BackupPage} />
        <ProtectedRoute path="/settings" component={SettingsPage} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function App() {
  return (
    <SocketProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </SocketProvider>
  );
}

export default App;
