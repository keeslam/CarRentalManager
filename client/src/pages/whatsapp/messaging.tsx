import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Send, MessageCircle, User, Phone, Mail, Check, CheckCheck, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface WhatsAppMessage {
  id: number;
  messageId?: string;
  direction: 'outbound' | 'inbound';
  status: string;
  fromNumber: string;
  toNumber: string;
  content: string;
  customerId?: number;
  customer?: Customer;
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
}

interface Conversation {
  customerId: number;
  customerName: string;
  customerPhone: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export default function WhatsAppMessaging() {
  const { toast } = useToast();
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ['/api/whatsapp/conversations'],
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery<WhatsAppMessage[]>({
    queryKey: ['/api/whatsapp/messages', selectedCustomerId],
    enabled: !!selectedCustomerId,
  });

  const { data: selectedCustomer } = useQuery<Customer>({
    queryKey: ['/api/customers', selectedCustomerId],
    enabled: !!selectedCustomerId,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { customerId: number; content: string }) => {
      return await apiRequest('/api/whatsapp/send', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages', selectedCustomerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/conversations'] });
      setMessageText('');
      toast({
        title: "Message sent",
        description: "Your WhatsApp message has been sent",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error sending message",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!selectedCustomerId || !messageText.trim()) {
      return;
    }

    sendMessageMutation.mutate({
      customerId: selectedCustomerId,
      content: messageText.trim(),
    });
  };

  const getStatusIcon = (status: string, direction: string) => {
    if (direction === 'inbound') {
      return null;
    }

    switch (status) {
      case 'queued':
      case 'sent':
        return <Clock className="h-3 w-3 text-muted-foreground" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'failed':
        return <span className="text-xs text-red-500">!</span>;
      default:
        return <Check className="h-3 w-3 text-muted-foreground" />;
    }
  };

  if (loadingConversations) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">
          Loading conversations...
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-6">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">WhatsApp Messaging</h1>
        <p className="text-muted-foreground">Send and receive WhatsApp messages with your customers</p>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        <div className="col-span-4">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Conversations</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-full">
                {conversations.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground px-4">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No conversations yet</p>
                    <p className="text-sm">Send a message to start chatting</p>
                  </div>
                ) : (
                  <div>
                    {conversations.map((conv) => (
                      <div
                        key={conv.customerId}
                        className={`p-4 cursor-pointer hover:bg-secondary transition-colors border-b ${
                          selectedCustomerId === conv.customerId ? 'bg-secondary' : ''
                        }`}
                        onClick={() => setSelectedCustomerId(conv.customerId)}
                        data-testid={`conversation-${conv.customerId}`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {conv.customerName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-semibold truncate">{conv.customerName}</span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                {format(new Date(conv.lastMessageTime), 'MMM d')}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground truncate mb-1">
                              {conv.lastMessage}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">{conv.customerPhone}</span>
                              {conv.unreadCount > 0 && (
                                <Badge variant="default" className="h-5 min-w-[20px] px-1 text-xs">
                                  {conv.unreadCount}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-8">
          <Card className="h-full flex flex-col">
            {selectedCustomerId && selectedCustomer ? (
              <>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {selectedCustomer.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{selectedCustomer.name}</CardTitle>
                      <div className="flex gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedCustomer.phone}
                        </span>
                        {selectedCustomer.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {selectedCustomer.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="flex-1 p-4 flex flex-col min-h-0">
                  <ScrollArea className="flex-1 mb-4" ref={scrollRef}>
                    {loadingMessages ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Loading messages...
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No messages yet</p>
                        <p className="text-sm">Start the conversation below</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${
                              message.direction === 'outbound' ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <div
                              className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                message.direction === 'outbound'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-secondary'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                              <div className="flex items-center gap-1 mt-1 justify-end">
                                <span className="text-xs opacity-70">
                                  {format(new Date(message.createdAt), 'HH:mm')}
                                </span>
                                {getStatusIcon(message.status, message.direction)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  <div className="flex gap-2">
                    <Input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type a message..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={sendMessageMutation.isPending}
                      data-testid="input-message"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageText.trim() || sendMessageMutation.isPending}
                      data-testid="button-send-message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <User className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Select a conversation</p>
                  <p className="text-sm">Choose a customer to view messages</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
