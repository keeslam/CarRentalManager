import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Check, X, Calendar, User, Car, Clock } from "lucide-react";
import { format } from "date-fns";

interface ExtensionRequest {
  id: number;
  reservationId: number;
  customerId: number;
  vehicleId: number | null;
  currentEndDate: string | null;
  requestedEndDate: string;
  reason: string | null;
  status: string;
  staffNotes: string | null;
  reviewedBy: number | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  reservation?: any;
  customer?: any;
  vehicle?: any;
}

export default function ExtensionRequestsPage() {
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<ExtensionRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  // Fetch all extension requests
  const { data: requests, isLoading } = useQuery<ExtensionRequest[]>({
    queryKey: ["/api/extension-requests"],
  });

  // Review mutation (approve/reject)
  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes: string }) => {
      const res = await apiRequest("PATCH", `/api/extension-requests/${id}`, {
        body: JSON.stringify({ status, staffNotes: notes }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to process request");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/extension-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/extension-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      
      toast({
        title: variables.status === 'approved' ? "Request Approved" : "Request Rejected",
        description: `The extension request has been ${variables.status}.`,
      });
      
      setSelectedRequest(null);
      setReviewNotes("");
      setActionType(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleReview = (request: ExtensionRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(action);
    setReviewNotes("");
  };

  const confirmReview = () => {
    if (!selectedRequest || !actionType) return;
    
    reviewMutation.mutate({
      id: selectedRequest.id,
      status: actionType === 'approve' ? 'approved' : 'rejected',
      notes: reviewNotes,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-600">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading extension requests...</p>
        </div>
      </div>
    );
  }

  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];
  const processedRequests = requests?.filter(r => r.status !== 'pending') || [];

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Rental Extension Requests</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Review and manage customer rental extension requests
        </p>
      </div>

      {/* Pending Requests */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Pending Requests</CardTitle>
          <CardDescription>
            {pendingRequests.length} request(s) awaiting review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-8">
              <Check className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                No pending extension requests
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <Card key={request.id} className="border-2 border-amber-200 dark:border-amber-800" data-testid={`card-request-${request.id}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">
                            Request #{request.id}
                          </h3>
                          {getStatusBadge(request.status)}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Submitted {format(new Date(request.createdAt), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReview(request, 'reject')}
                          disabled={reviewMutation.isPending}
                          data-testid={`button-reject-${request.id}`}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleReview(request, 'approve')}
                          disabled={reviewMutation.isPending}
                          data-testid={`button-approve-${request.id}`}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">Customer:</span>
                        <span className="font-medium">{request.customer?.name || `Customer #${request.customerId}`}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Car className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">Vehicle:</span>
                        <span className="font-medium">
                          {request.vehicle ? `${request.vehicle.brand} ${request.vehicle.model}` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">Current End:</span>
                        <span className="font-medium">
                          {request.currentEndDate ? format(new Date(request.currentEndDate), 'MMM dd, yyyy') : 'Open-ended'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">Requested End:</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {format(new Date(request.requestedEndDate), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>

                    {request.reason && (
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-sm">
                          <span className="font-medium">Reason:</span> {request.reason}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processed Requests */}
      {processedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Processed Requests</CardTitle>
            <CardDescription>
              Previously reviewed extension requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {processedRequests.map((request) => (
                <Card key={request.id} className="border" data-testid={`card-processed-${request.id}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">
                            Request #{request.id}
                          </h3>
                          {getStatusBadge(request.status)}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Reviewed {request.reviewedAt ? format(new Date(request.reviewedAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">Customer:</span>
                        <span className="font-medium">{request.customer?.name || `Customer #${request.customerId}`}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">Requested End:</span>
                        <span className="font-medium">
                          {format(new Date(request.requestedEndDate), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>

                    {request.staffNotes && (
                      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-sm">
                          <span className="font-medium">Staff Notes:</span> {request.staffNotes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve' : 'Reject'} Extension Request
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' 
                ? 'Approve this extension request and update the rental end date.' 
                : 'Reject this extension request and notify the customer.'}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm">
                  <strong>Customer:</strong> {selectedRequest.customer?.name || `Customer #${selectedRequest.customerId}`}
                </p>
                <p className="text-sm mt-1">
                  <strong>Requested End Date:</strong> {format(new Date(selectedRequest.requestedEndDate), 'MMM dd, yyyy')}
                </p>
              </div>

              <div>
                <Label htmlFor="reviewNotes">
                  Staff Notes {actionType === 'reject' && '(Required for rejection)'}
                </Label>
                <Textarea
                  id="reviewNotes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about this decision..."
                  className="mt-2"
                  data-testid="input-review-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedRequest(null)}
              disabled={reviewMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmReview}
              disabled={reviewMutation.isPending || (actionType === 'reject' && !reviewNotes.trim())}
              variant={actionType === 'approve' ? 'default' : 'destructive'}
              data-testid="button-confirm-review"
            >
              {reviewMutation.isPending ? 'Processing...' : `Confirm ${actionType === 'approve' ? 'Approval' : 'Rejection'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
