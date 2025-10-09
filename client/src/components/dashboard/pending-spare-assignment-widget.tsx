import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Car } from "lucide-react";
import { Reservation } from "@shared/schema";
import { formatDate } from "@/lib/format-utils";
import { useState } from "react";
import { SpareVehicleAssignmentDialog } from "@/components/reservations/spare-vehicle-assignment-dialog";

export function PendingSpareAssignmentWidget() {
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedPlaceholder, setSelectedPlaceholder] = useState<Reservation | null>(null);

  // Using 30 days lookahead to show all upcoming placeholders
  const { data: pendingAssignments, isLoading } = useQuery<Reservation[]>({
    queryKey: ["/api/placeholder-reservations/needing-assignment?daysAhead=30"],
  });

  // Sort by start date (closest first) - copy to avoid mutating cache
  const sortedAssignments = [...(pendingAssignments ?? [])].sort((a, b) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  const handleAssignClick = (placeholder: Reservation) => {
    setSelectedPlaceholder(placeholder);
    setAssignmentDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setAssignmentDialogOpen(open);
    if (!open) setSelectedPlaceholder(null);
  };

  return (
    <>
      <Card className="overflow-hidden h-full">
        <CardHeader className="bg-orange-500 py-3 px-4 flex-row justify-between items-center space-y-0">
          <CardTitle className="text-base font-medium text-gray-900">
            Spare Vehicle Assignments
          </CardTitle>
          <Car className="w-5 h-5 text-gray-900" />
        </CardHeader>
        <CardContent className="p-4">
          <div className="mb-3">
            <div 
              className="text-xl font-semibold"
              data-testid="text-pending-spares-count"
            >
              {isLoading ? "-" : sortedAssignments?.length || 0}
            </div>
            <p className="text-xs text-gray-500">
              TBD spare vehicles needing assignment
            </p>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center p-4">
                <svg 
                  className="animate-spin h-5 w-5 text-orange-500" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            ) : sortedAssignments?.length === 0 ? (
              <div 
                className="text-center py-4 text-gray-500"
                data-testid="status-no-pending-spares"
              >
                No pending spare assignments
              </div>
            ) : (
              sortedAssignments?.map(placeholder => (
                <div 
                  key={placeholder.id} 
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md border-l-4 border-orange-500"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <div 
                        className="font-medium text-sm"
                        data-testid={`text-spare-needed-${placeholder.id}`}
                      >
                        {placeholder.customer?.name || t('dashboard.unknownCustomer')}
                      </div>
                      <span className="text-xs text-gray-400">#{placeholder.id}</span>
                    </div>
                    {(placeholder.customer?.phone || placeholder.customer?.email) && (
                      <div className="text-xs text-gray-600">
                        {placeholder.customer?.phone || placeholder.customer?.email}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <CalendarDays className="w-3 h-3" />
                      {formatDate(placeholder.startDate)}
                      {placeholder.endDate && ` - ${formatDate(placeholder.endDate)}`}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAssignClick(placeholder)}
                    data-testid={`button-assign-spare-${placeholder.id}`}
                    className="text-xs ml-2"
                  >
                    Assign
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Spare Vehicle Assignment Dialog */}
      {selectedPlaceholder && (
        <SpareVehicleAssignmentDialog
          open={assignmentDialogOpen}
          onOpenChange={handleDialogClose}
          placeholderReservations={[selectedPlaceholder]}
        />
      )}
    </>
  );
}