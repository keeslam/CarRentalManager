import { ReservationForm } from "@/components/reservations/reservation-form-fixed";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AddReservationPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card className="border-none shadow-none">
        <CardHeader className="px-0">
          <CardTitle className="text-2xl">New Reservation</CardTitle>
          <CardDescription>
            Create a new reservation by selecting a vehicle and customer
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ReservationForm />
        </CardContent>
      </Card>
    </div>
  );
}