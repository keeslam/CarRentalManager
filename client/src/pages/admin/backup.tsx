import { BackupManagement } from "@/components/backup/backup-management";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";
import { Redirect } from "wouter";

export default function BackupPage() {
  const { user } = useAuth();
  
  // Only admins can access this page
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  if (user.role !== UserRole.ADMIN) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <BackupManagement />
    </div>
  );
}