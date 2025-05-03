import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnDef } from "@tanstack/react-table";
import { User, UserRole } from "@shared/schema";
import { Shield, ShieldCheck, User as UserIcon, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const { user: currentUser } = useAuth();
  
  // Only admins should be able to view this page
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  
  // Fetch users
  const { data: users = [], isLoading } = useQuery<Omit<User, "password">[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      // Only fetch if user is admin
      if (!isAdmin) return [];
      
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      return response.json();
    },
    enabled: isAdmin, // Only fetch if user is admin
  });
  
  // Filter users based on search term
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.fullName && user.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Define columns for the table
  const columns: ColumnDef<Omit<User, "password">>[] = [
    {
      accessorKey: "username",
      header: "Username",
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-2">
            {!user.active ? (
              <UserX className="h-4 w-4 text-muted-foreground" />
            ) : (
              <UserIcon className="h-4 w-4 text-primary" />
            )}
            <span>{user.username}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "fullName",
      header: "Name",
      cell: ({ row }) => row.original.fullName || "-",
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => row.original.email || "-",
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const role = row.original.role;
        let badge;
        
        switch (role) {
          case UserRole.ADMIN:
            badge = <Badge variant="destructive">Admin</Badge>;
            break;
          case UserRole.MANAGER:
            badge = <Badge variant="default">Manager</Badge>;
            break;
          default:
            badge = <Badge variant="outline">User</Badge>;
        }
        
        return (
          <div className="flex items-center gap-2">
            {role === UserRole.ADMIN ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            {badge}
          </div>
        );
      },
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => {
        const active = row.original.active;
        return (
          <Badge variant={active ? "success" : "secondary"}>
            {active ? "Active" : "Inactive"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const user = row.original;
        
        // Don't allow editing the current user from this page
        // They should use the profile page instead
        const isSelf = user.id === currentUser?.id;
        
        return (
          <div className="flex justify-end gap-2">
            <Link href={`/users/${user.id}`}>
              <Button variant="ghost" size="sm">
                View
              </Button>
            </Link>
            <Link href={`/users/${user.id}/edit`}>
              <Button variant="outline" size="sm" disabled={isSelf}>
                Edit
              </Button>
            </Link>
          </div>
        );
      },
    },
  ];
  
  // If not admin, show access denied
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to access the user management area.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              Only administrators can manage users. Please contact an administrator if you need assistance.
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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Link href="/users/add">
          <Button>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus mr-2">
              <line x1="12" x2="12" y1="5" y2="19" />
              <line x1="5" x2="19" y1="12" y2="12" />
            </svg>
            Add User
          </Button>
        </Link>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>User Database</CardTitle>
          <CardDescription>
            Manage system users, assign roles, and set permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <DataTable 
            columns={columns} 
            data={filteredUsers} 
            searchColumn="username"
          />
        </CardContent>
      </Card>
    </div>
  );
}