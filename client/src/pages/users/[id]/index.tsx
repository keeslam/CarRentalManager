import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Loader2, Edit, Shield, User as UserIcon, Mail, Calendar, Check, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { UserRole, UserPermission } from "@shared/schema";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function UserView() {
  const { id } = useParams();
  const userId = parseInt(id);
  const [_, navigate] = useLocation();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  
  // Check if viewing self (different UI treatment)
  const isSelf = currentUser?.id === userId;
  
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: [`/api/users/${userId}`],
    queryFn: async () => {
      if (!isAdmin && !isSelf) return null;
      
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch user data");
      }
      return await response.json();
    },
    enabled: isAdmin || isSelf,
  });

  if (!isAdmin && !isSelf) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to view this user's details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              Only administrators can view user details. Please contact an administrator if you need assistance.
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
              {error instanceof Error ? error.message : "User not found or you don't have permission to view this user."}
            </p>
            <Link href={isAdmin ? "/users" : "/"}>
              <Button variant="default">
                {isAdmin ? "Back to Users" : "Return to Dashboard"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Format dates for display
  const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown";
  const updatedAt = user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : "Unknown";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Details: {user.username}</h1>
        <div className="flex gap-2">
          {isAdmin && !isSelf && (
            <Link href={`/users/${userId}/edit`}>
              <Button>
                <Edit className="h-4 w-4 mr-2" />
                Edit User
              </Button>
            </Link>
          )}
          <Link href={isSelf ? "/" : "/users"}>
            <Button variant="outline">
              Back to {isSelf ? "Dashboard" : "Users"}
            </Button>
          </Link>
        </div>
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
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">{createdAt}</p>
              </div>
            </div>

            {user.createdBy && (
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Created By</p>
                  <p className="font-medium">{user.createdBy}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="font-medium">{updatedAt}</p>
              </div>
            </div>

            {user.updatedBy && (
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Updated By</p>
                  <p className="font-medium">{user.updatedBy}</p>
                </div>
              </div>
            )}
          </CardContent>
          {isSelf && (
            <CardFooter>
              <Link href="/profile/change-password" className="w-full">
                <Button variant="outline" className="w-full">
                  Change Password
                </Button>
              </Link>
            </CardFooter>
          )}
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>
              User permissions and access control
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="role" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="role">Role Description</TabsTrigger>
                <TabsTrigger value="permissions">Detailed Permissions</TabsTrigger>
              </TabsList>
              <TabsContent value="role" className="space-y-4 pt-4">
                {user.role === UserRole.ADMIN ? (
                  <div className="text-sm">
                    <h3 className="font-medium text-base">Administrator</h3>
                    <p className="my-2">
                      Administrators have full access to all system features and functionality, including:
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
                      Managers have access to most system features with some restrictions:
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
                      Regular users have limited access to the system:
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
              </TabsContent>
              <TabsContent value="permissions" className="pt-4">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {user.role === UserRole.ADMIN 
                      ? "Administrators have all permissions by default." 
                      : "The following specific permissions have been granted to this user:"}
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    {Object.values(UserPermission).map((permission) => {
                      const hasPermission = 
                        user.role === UserRole.ADMIN || 
                        (user.permissions && user.permissions.includes(permission));
                      
                      return (
                        <div 
                          key={permission} 
                          className={`flex items-center gap-2 p-2 rounded-md border ${
                            hasPermission ? "bg-muted/30" : "bg-background"
                          }`}
                        >
                          {hasPermission ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className={hasPermission ? "font-medium" : "text-muted-foreground"}>
                            {permission}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}