import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Key, ShieldCheck, Copy, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PortalLoginDialogProps {
  customerId: number;
  customerEmail: string;
  children: React.ReactNode;
}

interface PortalLoginStatus {
  hasPortalAccess: boolean;
  email?: string;
  lastLogin?: string;
}

interface PasswordResponse {
  message: string;
  email: string;
  customerId?: number;
}

export function PortalLoginDialog({ customerId, customerEmail, children }: PortalLoginDialogProps) {
  const [open, setOpen] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  // Query portal login status
  const { data: portalStatus, isLoading } = useQuery<PortalLoginStatus>({
    queryKey: [`/api/customers/${customerId}/portal-login`],
    enabled: open,
  });

  // Create portal login mutation
  const createLoginMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/customers/${customerId}/portal-login`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create portal login");
      }
      return await response.json() as PasswordResponse;
    },
    onSuccess: (data) => {
      setEmailSent(true);
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/portal-login`] });
      toast({
        title: "Portal login created",
        description: data.message || "Login credentials have been sent to the customer's email.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/customers/${customerId}/portal-login/reset`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reset password");
      }
      return await response.json() as PasswordResponse;
    },
    onSuccess: (data) => {
      setEmailSent(true);
      toast({
        title: "Password reset",
        description: data.message || "New login credentials have been sent to the customer's email.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Clear email sent status when closing dialog
      setEmailSent(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Customer Portal Login
          </DialogTitle>
          <DialogDescription>
            Manage customer portal access and credentials
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current Status */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Portal Access Status</span>
                {portalStatus?.hasPortalAccess ? (
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                ) : (
                  <Key className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {portalStatus?.hasPortalAccess ? "Portal access enabled" : "No portal access"}
              </p>
              {portalStatus?.email && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Login email: {portalStatus.email}
                </p>
              )}
              {portalStatus?.lastLogin && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Last login: {new Date(portalStatus.lastLogin).toLocaleString()}
                </p>
              )}
            </div>

            {/* Email Sent Confirmation */}
            {emailSent && (
              <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <AlertDescription className="space-y-2">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    ✅ Email sent successfully!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Login credentials have been sent to <strong>{customerEmail}</strong>
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    The customer will receive an email with their login details and can change their password after logging in.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="space-y-2">
              {!portalStatus?.hasPortalAccess ? (
                <Button
                  className="w-full"
                  onClick={() => createLoginMutation.mutate()}
                  disabled={createLoginMutation.isPending}
                  data-testid="button-create-portal-login"
                >
                  {createLoginMutation.isPending ? "Creating..." : "Create Portal Login"}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => resetPasswordMutation.mutate()}
                  disabled={resetPasswordMutation.isPending}
                  data-testid="button-reset-password"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                </Button>
              )}
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Customer portal URL: {window.location.origin}/customer-portal/login
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
