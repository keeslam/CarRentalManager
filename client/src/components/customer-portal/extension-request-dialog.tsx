import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Calendar } from "lucide-react";
import { format, addDays } from "date-fns";
import type { Reservation } from "@shared/schema";

const extensionRequestSchema = z.object({
  requestedEndDate: z.string().min(1, "Please select an end date"),
  reason: z.string().min(10, "Please provide a reason (at least 10 characters)"),
});

type ExtensionRequestFormData = z.infer<typeof extensionRequestSchema>;

interface ExtensionRequestDialogProps {
  rental: Reservation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExtensionRequestDialog({ rental, open, onOpenChange }: ExtensionRequestDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate minimum date (tomorrow or current end date + 1 day)
  const minDate = rental.endDate 
    ? format(addDays(new Date(rental.endDate), 1), 'yyyy-MM-dd')
    : format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const form = useForm<ExtensionRequestFormData>({
    resolver: zodResolver(extensionRequestSchema),
    defaultValues: {
      requestedEndDate: "",
      reason: "",
    },
  });

  const createExtensionMutation = useMutation({
    mutationFn: async (data: ExtensionRequestFormData) => {
      const res = await apiRequest("POST", "/api/customer/extension-requests", {
        body: JSON.stringify({
          reservationId: rental.id,
          ...data,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create extension request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/rentals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customer/extension-requests"] });
      toast({
        title: "Extension Request Submitted",
        description: "Your extension request has been sent to the rental company for review.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Submit Request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ExtensionRequestFormData) => {
    setIsSubmitting(true);
    try {
      await createExtensionMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Request Rental Extension</DialogTitle>
          <DialogDescription>
            Request to extend your rental for {rental.vehicle?.brand} {rental.vehicle?.model}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Current Start Date:</span>
              <span className="font-medium">{format(new Date(rental.startDate), 'MMM dd, yyyy')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Current End Date:</span>
              <span className="font-medium">
                {rental.endDate ? format(new Date(rental.endDate), 'MMM dd, yyyy') : 'Open-ended'}
              </span>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="requestedEndDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requested New End Date</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        {...field}
                        type="date"
                        min={minDate}
                        className="pl-10"
                        disabled={isSubmitting}
                        data-testid="input-requested-end-date"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Extension</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Please provide a reason for the extension request..."
                      className="min-h-[100px]"
                      disabled={isSubmitting}
                      data-testid="input-extension-reason"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                data-testid="button-cancel-extension"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-submit-extension"
              >
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
