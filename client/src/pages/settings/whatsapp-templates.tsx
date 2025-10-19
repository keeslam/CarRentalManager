import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageSquare, Plus, Edit, Trash2, Copy } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface WhatsAppTemplate {
  id?: number;
  name: string;
  category: string;
  content: string;
  variables: string[];
}

const defaultTemplates: WhatsAppTemplate[] = [
  {
    name: "Booking Confirmation",
    category: "confirmation",
    content: "Hello {{customerName}}, your reservation for {{vehicleBrand}} {{vehicleModel}} ({{licensePlate}}) is confirmed! Pickup date: {{startDate}}. We look forward to serving you!",
    variables: ["customerName", "vehicleBrand", "vehicleModel", "licensePlate", "startDate"]
  },
  {
    name: "Pickup Reminder",
    category: "reminder",
    content: "Hi {{customerName}}! Reminder: Your rental pickup is tomorrow at {{startDate}}. Vehicle: {{vehicleBrand}} {{vehicleModel}}. Please bring your driver's license and payment method. See you soon!",
    variables: ["customerName", "startDate", "vehicleBrand", "vehicleModel"]
  },
  {
    name: "Return Reminder",
    category: "reminder",
    content: "Hello {{customerName}}, your rental period ends tomorrow ({{endDate}}). Please return the {{vehicleBrand}} {{vehicleModel}} with a full tank. Thank you for choosing us!",
    variables: ["customerName", "endDate", "vehicleBrand", "vehicleModel"]
  },
  {
    name: "Payment Due",
    category: "payment",
    content: "Hi {{customerName}}, payment of €{{amount}} is due for your rental. Please complete payment at your earliest convenience. Thank you!",
    variables: ["customerName", "amount"]
  },
  {
    name: "Invoice Delivery",
    category: "invoice",
    content: "Hello {{customerName}}, your invoice #{{invoiceNumber}} for €{{amount}} is ready. Thank you for your business!",
    variables: ["customerName", "invoiceNumber", "amount"]
  }
];

export default function WhatsAppTemplatesPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [formData, setFormData] = useState<WhatsAppTemplate>({
    name: "",
    category: "general",
    content: "",
    variables: []
  });

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery<WhatsAppTemplate[]>({
    queryKey: ["/api/whatsapp/templates"],
    placeholderData: []
  });

  // Save template mutation
  const saveMutation = useMutation({
    mutationFn: async (template: WhatsAppTemplate) => {
      if (template.id) {
        return apiRequest(`/api/whatsapp/templates/${template.id}`, {
          method: 'PUT',
          body: JSON.stringify(template),
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        return apiRequest('/api/whatsapp/templates', {
          method: 'POST',
          body: JSON.stringify(template),
          headers: { 'Content-Type': 'application/json' },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
      toast({
        title: "Success",
        description: "Template saved successfully",
      });
      setIsAddDialogOpen(false);
      setEditingTemplate(null);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive",
      });
    }
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/whatsapp/templates/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      category: "general",
      content: "",
      variables: []
    });
  };

  const handleEdit = (template: WhatsAppTemplate) => {
    setEditingTemplate(template);
    setFormData(template);
    setIsAddDialogOpen(true);
  };

  const handleSave = () => {
    // Extract variables from content
    const variableMatches = formData.content.match(/\{\{(\w+)\}\}/g);
    const variables = variableMatches 
      ? variableMatches.map(v => v.replace(/\{\{|\}\}/g, ''))
      : [];

    saveMutation.mutate({
      ...formData,
      id: editingTemplate?.id,
      variables
    });
  };

  const handleLoadDefault = (template: WhatsAppTemplate) => {
    setEditingTemplate(null);
    setFormData({
      ...template,
      name: `${template.name} (Copy)`
    });
    setIsAddDialogOpen(true);
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      confirmation: "bg-green-100 text-green-800",
      reminder: "bg-blue-100 text-blue-800",
      payment: "bg-amber-100 text-amber-800",
      invoice: "bg-purple-100 text-purple-800",
      general: "bg-gray-100 text-gray-800"
    };
    return colors[category] || colors.general;
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-8 w-8" />
            WhatsApp Message Templates
          </h1>
          <p className="text-muted-foreground">Create and manage message templates for customer communications</p>
        </div>
        <Button onClick={() => {
          resetForm();
          setEditingTemplate(null);
          setIsAddDialogOpen(true);
        }} data-testid="button-add-template">
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </Button>
      </div>

      {/* Default Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Default Templates</CardTitle>
          <CardDescription>Pre-built templates you can customize and use</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {defaultTemplates.map((template, idx) => (
              <Card key={idx} className="border-dashed">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <Badge className={getCategoryBadge(template.category)}>
                      {template.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground line-clamp-2">{template.content}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleLoadDefault(template)}
                    data-testid={`button-load-default-${idx}`}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Your Custom Templates</CardTitle>
          <CardDescription>Templates you've created or customized</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No custom templates yet. Create one using the button above or start from a default template.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Content Preview</TableHead>
                  <TableHead>Variables</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id} data-testid={`template-row-${template.id}`}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>
                      <Badge className={getCategoryBadge(template.category)}>
                        {template.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate">{template.content}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {template.variables.map((v, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {v}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(template)}
                          data-testid={`button-edit-${template.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => template.id && deleteMutation.mutate(template.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${template.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Add New Template'}</DialogTitle>
            <DialogDescription>
              Use {'{{'} variableName {'}}'}  syntax for dynamic values like {'{{'} customerName {'}}'}  or {'{{'} startDate {'}}'} 
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                placeholder="e.g., Booking Confirmation"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-template-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="e.g., confirmation, reminder, payment"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                data-testid="input-template-category"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Message Content</Label>
              <Textarea
                id="content"
                rows={6}
                placeholder="Enter your message template here. Use {{variableName}} for dynamic values."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                data-testid="textarea-template-content"
              />
              <p className="text-xs text-muted-foreground">
                Detected variables: {formData.content.match(/\{\{(\w+)\}\}/g)?.join(', ') || 'None'}
              </p>
            </div>
            {!formData.name && (
              <p className="text-sm text-red-500">Template name is required</p>
            )}
            {!formData.content && (
              <p className="text-sm text-red-500">Message content is required</p>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsAddDialogOpen(false);
                resetForm();
              }}
              data-testid="button-cancel-template"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!formData.name || !formData.content || saveMutation.isPending}
              data-testid="button-save-template"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
