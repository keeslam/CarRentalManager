import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { UserForm } from "@/components/users/user-form";
import { useAuth } from "@/hooks/use-auth";
import { UserRole, UserPermission } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function UserEdit() {
  const { id } = useParams();
  const userId = parseInt(id);
  const [_, navigate] = useLocation();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const canManageUsers = isAdmin || currentUser?.permissions?.includes(UserPermission.MANAGE_USERS);
  
  // Prevent editing yourself through this page
  const isSelf = currentUser?.id === userId;
  
  // If user cannot manage users, redirect to dashboard
  useEffect(() => {
    if (!canManageUsers) {
      navigate("/");
    }
    
    // If trying to edit yourself, redirect to profile page
    if (isSelf) {
      navigate("/profile");
    }
  }, [canManageUsers, isSelf, navigate]);

  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: [`/api/users/${userId}`],
    queryFn: async () => {
      if (!canManageUsers || isSelf) return null;
      
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch user data");
      }
      return await response.json();
    },
    enabled: canManageUsers && !isSelf && !isNaN(userId),
  });

  if (!canManageUsers) {
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
              You need the "Manage Users" permission to edit users. Please contact an administrator if you need assistance.
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>
              Failed to load user information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              {error instanceof Error ? error.message : "User not found or you don't have permission to edit this user."}
            </p>
            <Link href="/users">
              <Button variant="default">
                Back to Users
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
        <h1 className="text-2xl font-bold">Edit User: {user.username}</h1>
        <Link href="/users">
          <Button variant="outline">Back to Users</Button>
        </Link>
      </div>
      <UserForm user={user} isEdit={true} />
    </div>
  );
}