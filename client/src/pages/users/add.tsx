import { UserForm } from "@/components/users/user-form";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function UserAdd() {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              Only administrators can add new users. Please contact an administrator if you need assistance.
            </p>
            <Link href="/">
              <Button variant="default">
                Return to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Add New User</h1>
        <Link href="/users">
          <Button variant="outline">Back to Users</Button>
        </Link>
      </div>
      <UserForm />
    </div>
  );
}