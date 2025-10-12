import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { insertDriverSchema, Driver } from "@shared/schema";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const driverFormSchema = insertDriverSchema.omit({
  customerId: true,
  createdBy: true,
  updatedBy: true,
}).extend({
  displayName: z.string().min(1, "Display name is required"),
});

type DriverFormValues = z.infer<typeof driverFormSchema>;

interface DriverDialogProps {
  customerId: number;
  driver?: Driver;
  children: React.ReactNode;
  onSuccess?: () => void;
}

export function DriverDialog({ customerId, driver, children, onSuccess }: DriverDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const isEdit = !!driver;

  const form = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: {
      displayName: driver?.displayName ?? "",
      firstName: driver?.firstName ?? "",
      lastName: driver?.lastName ?? "",
      email: driver?.email ?? "",
      phone: driver?.phone ?? "",
      driverLicenseNumber: driver?.driverLicenseNumber ?? "",
      licenseExpiry: driver?.licenseExpiry ?? "",
      isPrimaryDriver: driver?.isPrimaryDriver ?? false,
      status: driver?.status ?? "active",
      notes: driver?.notes ?? "",
      preferredLanguage: driver?.preferredLanguage ?? "nl",
    },
  });

  // Reset form when dialog opens or driver data changes
  useEffect(() => {
    if (open) {
      form.reset({
        displayName: driver?.displayName ?? "",
        firstName: driver?.firstName ?? "",
        lastName: driver?.lastName ?? "",
        email: driver?.email ?? "",
        phone: driver?.phone ?? "",
        driverLicenseNumber: driver?.driverLicenseNumber ?? "",
        licenseExpiry: driver?.licenseExpiry ?? "",
        isPrimaryDriver: driver?.isPrimaryDriver ?? false,
        status: driver?.status ?? "active",
        notes: driver?.notes ?? "",
        preferredLanguage: driver?.preferredLanguage ?? "nl",
      });
    }
  }, [open, driver, form]);

  const mutation = useMutation({
    mutationFn: async (data: DriverFormValues) => {
      const url = isEdit ? `/api/drivers/${driver.id}` : `/api/customers/${customerId}/drivers`;
      const method = isEdit ? 'PATCH' : 'POST';
      const response = await apiRequest(method, url, data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${isEdit ? 'update' : 'create'} driver`);
      }
      return await response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/drivers`] });
      await queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
      
      toast({
        title: isEdit ? "Driver updated" : "Driver added",
        description: `Driver has been successfully ${isEdit ? 'updated' : 'added'}.`,
        variant: "default"
      });
      
      setOpen(false);
      form.reset();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEdit ? 'update' : 'add'} driver`,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: DriverFormValues) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Driver" : "Add Driver"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update driver information" : "Add a new authorized driver for this customer"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Display Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="John Doe" data-testid="input-display-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="John" data-testid="input-first-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="Doe" data-testid="input-last-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} type="email" placeholder="john@example.com" data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="+31 6 12345678" data-testid="input-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="driverLicenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Driver License Number</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="1234567890" data-testid="input-license-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="licenseExpiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Expiry Date</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} type="date" data-testid="input-license-expiry" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preferredLanguage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Language</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "nl"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-language">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="nl">Dutch</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "active"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isPrimaryDriver"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4 md:col-span-2">
                    <div className="space-y-0.5">
                      <FormLabel>Primary Driver</FormLabel>
                      <div className="text-sm text-gray-500">
                        Mark as the primary driver for this customer
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-primary-driver"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ""} placeholder="Additional notes..." rows={3} data-testid="textarea-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                data-testid="button-submit"
              >
                {mutation.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isEdit ? 'Updating...' : 'Adding...'}
                  </>
                ) : (
                  isEdit ? 'Update Driver' : 'Add Driver'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
