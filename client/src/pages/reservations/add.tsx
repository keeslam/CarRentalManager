import { ReservationForm } from "@/components/reservations/reservation-form";

export default function ReservationAdd() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Create New Reservation</h1>
      <ReservationForm />
    </div>
  );
}
