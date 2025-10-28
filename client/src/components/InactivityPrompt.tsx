import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

interface InactivityPromptProps {
  onReauthenticate: (password: string) => Promise<boolean>;
  username: string;
}

export function InactivityPrompt({ onReauthenticate, username }: InactivityPromptProps) {
  const [isInactive, setIsInactive] = useState(false);
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();
  
  const resetTimer = useCallback(() => {
    // Only reset if not already inactive
    if (!isInactive) {
      // Clear existing timeout
      if (window.inactivityTimeout) {
        clearTimeout(window.inactivityTimeout);
      }
      
      // Set new timeout
      window.inactivityTimeout = setTimeout(() => {
        setIsInactive(true);
        console.log('⏰ User inactive for 15 minutes - prompting for re-authentication');
      }, INACTIVITY_TIMEOUT);
    }
  }, [isInactive]);
  
  useEffect(() => {
    // Activity events to track
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });
    
    // Start initial timer
    resetTimer();
    
    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer, true);
      });
      if (window.inactivityTimeout) {
        clearTimeout(window.inactivityTimeout);
      }
    };
  }, [resetTimer]);
  
  const handleReauthenticate = async () => {
    if (!password) {
      toast({
        title: "Password Required",
        description: "Please enter your password to continue",
        variant: "destructive",
      });
      return;
    }
    
    setIsVerifying(true);
    try {
      const success = await onReauthenticate(password);
      
      if (success) {
        setIsInactive(false);
        setPassword('');
        resetTimer();
        toast({
          title: "Re-authenticated",
          description: "You can now continue working",
        });
      } else {
        toast({
          title: "Authentication Failed",
          description: "Incorrect password. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };
  
  const handleLogout = () => {
    window.location.href = '/api/logout';
  };
  
  return (
    <Dialog open={isInactive} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Session Inactive</DialogTitle>
          <DialogDescription>
            You've been inactive for 15 minutes. Please re-enter your password to continue working.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              disabled
              className="bg-gray-100"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isVerifying) {
                  handleReauthenticate();
                }
              }}
              placeholder="Enter your password"
              autoFocus
              data-testid="input-reauth-password"
            />
          </div>
        </div>
        
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={handleLogout}
            disabled={isVerifying}
            data-testid="button-logout"
          >
            Logout
          </Button>
          <Button 
            onClick={handleReauthenticate}
            disabled={isVerifying || !password}
            data-testid="button-reauthenticate"
          >
            {isVerifying ? "Verifying..." : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Extend Window interface to include our timeout
declare global {
  interface Window {
    inactivityTimeout?: NodeJS.Timeout;
  }
}
