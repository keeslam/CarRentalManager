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
        <Link href="/whatsapp/messaging">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" data-testid="card-whatsapp-messaging">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <MessageCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>WhatsApp Messaging</CardTitle>
                    <CardDescription>Send and receive WhatsApp messages with customers</CardDescription>
                  </div>
                </div>
                <ExternalLink className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/settings/whatsapp">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" data-testid="card-whatsapp-settings">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Settings className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>WhatsApp Settings</CardTitle>
                    <CardDescription>Configure WhatsApp integration and notifications</CardDescription>
                  </div>
                </div>
                <ExternalLink className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/settings/whatsapp/templates">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" data-testid="card-whatsapp-templates">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <FileText className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle>Message Templates</CardTitle>
                    <CardDescription>Manage WhatsApp message templates</CardDescription>
                  </div>
                </div>
                <ExternalLink className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>
        </Link>

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
