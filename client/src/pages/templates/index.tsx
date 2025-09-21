import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Mail, 
  Eye,
  Save,
  X,
  FileText
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { EmailTemplate } from "@shared/schema";

type TemplateCategory = 'apk' | 'maintenance' | 'custom';

interface NewTemplate {
  name: string;
  subject: string;
  content: string;
  category: TemplateCategory;
}

export default function TemplateBuilderPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | "all">("all");
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);
  
  // Form states
  const [newTemplate, setNewTemplate] = useState<NewTemplate>({
    name: "",
    subject: "",
    content: "",
    category: "custom"
  });
  
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  // Fetch all email templates
  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (template: NewTemplate) => {
      return await apiRequest("POST", "/api/email-templates", template);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({
        title: "Template Created",
        description: "Your template has been created successfully.",
      });
      setIsCreateDialogOpen(false);
      setNewTemplate({ name: "", subject: "", content: "", category: "custom" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create template: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async (template: EmailTemplate) => {
      return await apiRequest("PUT", `/api/email-templates/${template.id}`, template);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({
        title: "Template Updated",
        description: "Your template has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setEditingTemplate(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update template: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      return await apiRequest("DELETE", `/api/email-templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({
        title: "Template Deleted",
        description: "The template has been deleted successfully.",
      });
      setTemplateToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete template: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Filter templates based on search and category
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.subject.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeCategory === "all" || template.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Group templates by category for display
  const templatesByCategory = {
    apk: filteredTemplates.filter(t => t.category === 'apk'),
    maintenance: filteredTemplates.filter(t => t.category === 'maintenance'),
    custom: filteredTemplates.filter(t => t.category === 'custom'),
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'apk': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'maintenance': return 'bg-green-100 text-green-800 border-green-200';
      case 'custom': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'apk': return <FileText className="h-3 w-3" />;
      case 'maintenance': return <Mail className="h-3 w-3" />;
      case 'custom': return <Edit className="h-3 w-3" />;
      default: return <Mail className="h-3 w-3" />;
    }
  };

  const handleCreateTemplate = () => {
    if (!newTemplate.name || !newTemplate.subject || !newTemplate.content) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    createTemplateMutation.mutate(newTemplate);
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate({ ...template });
    setIsEditDialogOpen(true);
  };

  const handleUpdateTemplate = () => {
    if (!editingTemplate) return;
    
    if (!editingTemplate.name || !editingTemplate.subject || !editingTemplate.content) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    updateTemplateMutation.mutate(editingTemplate);
  };

  const handlePreviewTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setIsPreviewDialogOpen(true);
  };

  const handleDeleteTemplate = (template: EmailTemplate) => {
    setTemplateToDelete(template);
  };

  const confirmDeleteTemplate = () => {
    if (templateToDelete) {
      deleteTemplateMutation.mutate(templateToDelete.id);
    }
  };

  const TemplateCard = ({ template }: { template: EmailTemplate }) => (
    <Card className="transition-all hover:shadow-md" data-testid={`template-card-${template.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {getCategoryIcon(template.category)}
              {template.name}
            </CardTitle>
            <CardDescription className="mt-1">
              {template.subject}
            </CardDescription>
          </div>
          <Badge className={`${getCategoryColor(template.category)} text-xs`}>
            {template.category.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {template.content.length > 100 
            ? `${template.content.substring(0, 100)}...` 
            : template.content
          }
        </div>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => handlePreviewTemplate(template)}
            data-testid={`button-preview-${template.id}`}
          >
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => handleEditTemplate(template)}
            data-testid={`button-edit-${template.id}`}
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => handleDeleteTemplate(template)}
            className="text-red-600 hover:text-red-700"
            data-testid={`button-delete-${template.id}`}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
        {template.lastUsed && (
          <div className="text-xs text-muted-foreground mt-2">
            Last used: {new Date(template.lastUsed).toLocaleDateString()}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading templates...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Builder</h1>
          <p className="text-muted-foreground">
            Create and manage email templates for customer communications
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-template">
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates by name or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-templates"
                />
              </div>
            </div>
            <Select value={activeCategory} onValueChange={(value: any) => setActiveCategory(value)}>
              <SelectTrigger className="w-48" data-testid="select-category-filter">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="apk">APK Reminders</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Templates Display */}
      <Tabs value={activeCategory} onValueChange={(value: any) => setActiveCategory(value)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All ({filteredTemplates.length})</TabsTrigger>
          <TabsTrigger value="apk">APK ({templatesByCategory.apk.length})</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance ({templatesByCategory.maintenance.length})</TabsTrigger>
          <TabsTrigger value="custom">Custom ({templatesByCategory.custom.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          {filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No templates found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery ? "Try adjusting your search terms" : "Get started by creating your first template"}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Template
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map(template => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          )}
        </TabsContent>

        {(['apk', 'maintenance', 'custom'] as const).map(category => (
          <TabsContent key={category} value={category} className="space-y-6">
            {templatesByCategory[category].length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    {getCategoryIcon(category)}
                    <h3 className="text-lg font-medium mb-2">No {category} templates</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first {category} template to get started
                    </p>
                    <Button onClick={() => {
                      setNewTemplate(prev => ({ ...prev, category }));
                      setIsCreateDialogOpen(true);
                    }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create {category.charAt(0).toUpperCase() + category.slice(1)} Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templatesByCategory[category].map(template => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Template Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>
              Create a new email template for customer communications
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Template Name *</label>
                <Input
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter template name"
                  data-testid="input-new-template-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Category *</label>
                <Select 
                  value={newTemplate.category} 
                  onValueChange={(value: TemplateCategory) => setNewTemplate(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger data-testid="select-new-template-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apk">APK Reminders</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Subject Line *</label>
              <Input
                value={newTemplate.subject}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Enter email subject"
                data-testid="input-new-template-subject"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email Content *</label>
              <Textarea
                value={newTemplate.content}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Enter email content..."
                className="min-h-[200px]"
                data-testid="textarea-new-template-content"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTemplate}
              disabled={createTemplateMutation.isPending}
              data-testid="button-save-new-template"
            >
              {createTemplateMutation.isPending ? "Creating..." : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Modify your email template
            </DialogDescription>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Template Name *</label>
                  <Input
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                    placeholder="Enter template name"
                    data-testid="input-edit-template-name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Category *</label>
                  <Select 
                    value={editingTemplate.category} 
                    onValueChange={(value: TemplateCategory) => setEditingTemplate(prev => prev ? ({ ...prev, category: value }) : null)}
                  >
                    <SelectTrigger data-testid="select-edit-template-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apk">APK Reminders</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Subject Line *</label>
                <Input
                  value={editingTemplate.subject}
                  onChange={(e) => setEditingTemplate(prev => prev ? ({ ...prev, subject: e.target.value }) : null)}
                  placeholder="Enter email subject"
                  data-testid="input-edit-template-subject"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email Content *</label>
                <Textarea
                  value={editingTemplate.content}
                  onChange={(e) => setEditingTemplate(prev => prev ? ({ ...prev, content: e.target.value }) : null)}
                  placeholder="Enter email content..."
                  className="min-h-[200px]"
                  data-testid="textarea-edit-template-content"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateTemplate}
              disabled={updateTemplateMutation.isPending}
              data-testid="button-save-edit-template"
            >
              {updateTemplateMutation.isPending ? "Updating..." : "Update Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>
              Preview how this template will appear in emails
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-white">
                <div className="border-b pb-3 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm text-gray-600">From: Car Rental System</div>
                    <Badge className={getCategoryColor(selectedTemplate.category)}>
                      {selectedTemplate.category.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="font-medium text-sm text-gray-600 mt-1">To: customer@example.com</div>
                  <div className="font-bold text-lg mt-2">{selectedTemplate.subject}</div>
                </div>
                <div className="whitespace-pre-wrap text-gray-900">
                  {selectedTemplate.content}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                <div><strong>Template:</strong> {selectedTemplate.name}</div>
                <div><strong>Category:</strong> {selectedTemplate.category}</div>
                <div><strong>Created:</strong> {new Date(selectedTemplate.createdAt).toLocaleDateString()}</div>
                {selectedTemplate.lastUsed && (
                  <div><strong>Last Used:</strong> {new Date(selectedTemplate.lastUsed).toLocaleDateString()}</div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              Close
            </Button>
            {selectedTemplate && (
              <Button onClick={() => {
                setIsPreviewDialogOpen(false);
                handleEditTemplate(selectedTemplate);
              }}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Template
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!templateToDelete} onOpenChange={() => setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteTemplate}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-template"
            >
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}