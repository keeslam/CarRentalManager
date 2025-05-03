import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, User as UserIcon, Mail, Calendar } from "lucide-react";

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const [_, navigate] = useLocation();

  // Redirect to login page if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Format dates for display
  const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown";
  const updatedAt = user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : "Unknown";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Profile</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>User Information</CardTitle>
            <Badge 
              variant={user.active ? "success" : "destructive"}
              className="w-fit"
            >
              {user.active ? "Active" : "Inactive"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Username</p>
                <p className="font-medium">{user.username}</p>
              </div>
            </div>

            {user.fullName && (
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium">{user.fullName}</p>
                </div>
              </div>
            )}

            {user.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="font-medium">
                  {user.role === UserRole.ADMIN ? (
                    <Badge variant="destructive">Administrator</Badge>
                  ) : user.role === UserRole.MANAGER ? (
                    <Badge>Manager</Badge>
                  ) : (
                    <Badge variant="outline">Regular User</Badge>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Member Since</p>
                <p className="font-medium">{createdAt}</p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Link href="/profile/change-password" className="w-full">
              <Button variant="outline" className="w-full">
                Change Password
              </Button>
            </Link>
            {user.role === UserRole.ADMIN && (
              <Link href="/users" className="w-full">
                <Button variant="default" className="w-full">
                  User Management
                </Button>
              </Link>
            )}
          </CardFooter>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Permissions & Access</CardTitle>
            <CardDescription>
              Your role and permissions in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.role === UserRole.ADMIN ? (
              <div className="text-sm">
                <h3 className="font-medium text-base">Administrator</h3>
                <p className="my-2">
                  As an administrator, you have full access to all system features and functionality, including:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-4">
                  <li>User management (create, view, edit, delete users)</li>
                  <li>Role and permission assignment</li>
                  <li>System configuration and settings</li>
                  <li>All vehicle and customer management features</li>
                  <li>Complete access to financial information</li>
                  <li>Document management and uploads</li>
                </ul>
              </div>
            ) : user.role === UserRole.MANAGER ? (
              <div className="text-sm">
                <h3 className="font-medium text-base">Manager</h3>
                <p className="my-2">
                  As a manager, you have access to most system features with some restrictions:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-4">
                  <li>Full vehicle and customer management</li>
                  <li>Reservation creation and modification</li>
                  <li>Access to most financial information</li>
                  <li>Document management and uploads</li>
                  <li>Cannot manage users or system settings</li>
                </ul>
              </div>
            ) : (
              <div className="text-sm">
                <h3 className="font-medium text-base">Regular User</h3>
                <p className="my-2">
                  As a regular user, you have limited access to the system:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-4">
                  <li>View vehicles and customer information</li>
                  <li>Create new reservations</li>
                  <li>Limited access to financial information</li>
                  <li>Cannot modify system settings or manage users</li>
                  <li>Additional permissions as granted by administrators</li>
                </ul>
              </div>
            )}

            {user.permissions && user.permissions.length > 0 && (
              <div className="mt-6">
                <h3 className="font-medium text-base mb-2">Additional Permissions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {user.permissions.map((permission) => (
                    <Badge key={permission} variant="outline" className="justify-start">
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}