import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link } from "wouter";
import { MessageCircle, Mail, Settings, FileText, ExternalLink } from "lucide-react";

export default function CommunicationsPage() {
  return (
    <div className="container mx-auto py-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Communications</h1>
        <p className="text-muted-foreground">
          Manage customer communications and messaging
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/custom-notifications">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" data-testid="card-custom-notifications">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Mail className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle>Email Notifications</CardTitle>
                    <CardDescription>Manage automated email notifications</CardDescription>
                  </div>
                </div>
                <ExternalLink className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
