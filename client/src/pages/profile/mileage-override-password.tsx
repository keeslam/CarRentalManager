import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Shield, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Form validation schema
const mileageOverridePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type MileageOverridePasswordFormValues = z.infer<typeof mileageOverridePasswordSchema>;

export default function MileageOverridePasswordPage() {
  const { user, isLoading } = useAuth();
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [hasExistingPassword, setHasExistingPassword] = useState<boolean | null>(null);

  // Redirect to login page if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  const form = useForm<MileageOverridePasswordFormValues>({
    resolver: zodResolver(mileageOverridePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const setPasswordMutation = useMutation({
    mutationFn: async (data: MileageOverridePasswordFormValues) => {
      const res = await apiRequest("POST", `/api/users/${user?.id}/mileage-override-password`, {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to set mileage override password");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Mileage override password has been set successfully.",
      });
      form.reset();
      setHasExistingPassword(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MileageOverridePasswordFormValues) => {
    setPasswordMutation.mutate(data);
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold">Mileage Override Password</h1>
        </div>
        <Link href="/profile">
          <Button variant="outline">Back to Profile</Button>
        </Link>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Important Security Feature</AlertTitle>
        <AlertDescription>
          This password is required when decreasing vehicle mileage to prevent accidental or fraudulent odometer rollbacks. 
          Keep this password secure and different from your login password.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>
            {hasExistingPassword === false ? "Set Mileage Override Password" : "Change Mileage Override Password"}
          </CardTitle>
          <CardDescription>
            {hasExistingPassword === false 
              ? "Create a password that will be required when decreasing vehicle mileage."
              : "Update your mileage override password. You'll need to enter your current account password to verify your identity."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Account Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Enter your current account password" 
                        {...field}
                        data-testid="input-current-password"
                      />
                    </FormControl>
                    <FormDescription>
                      For security, please enter your account password to verify your identity.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Mileage Override Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Enter new mileage override password" 
                        {...field}
                        data-testid="input-new-override-password"
                      />
                    </FormControl>
                    <FormDescription>
                      This password will be required when decreasing vehicle mileage.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Confirm new password" 
                        {...field}
                        data-testid="input-confirm-override-password"
                      />
                    </FormControl>
                    <FormDescription>
                      Re-enter the new password to confirm.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-4">
                <Link href="/profile">
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button 
                  type="submit" 
                  disabled={setPasswordMutation.isPending}
                  data-testid="button-save-override-password"
                >
                  {setPasswordMutation.isPending ? "Saving..." : "Set Password"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
