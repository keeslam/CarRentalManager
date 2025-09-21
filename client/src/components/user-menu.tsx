import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { useState, useRef, useEffect } from "react";
import {
  User,
  LogOut,
  Settings,
  UserCog,
  ChevronDown,
  Database,
  Globe,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserRole } from "@shared/schema";

export function UserMenu() {
  const { user, logoutMutation } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Get user's initials for avatar
  const getUserInitials = () => {
    if (!user) return "?";
    
    if (user.fullName) {
      const nameParts = user.fullName.split(" ");
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
      }
      return user.fullName[0].toUpperCase();
    }
    
    return user.username[0].toUpperCase();
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef]);

  // Initialize Google Translate when menu opens
  useEffect(() => {
    if (isOpen) {
      const initializeGoogleTranslate = () => {
        const element = document.getElementById('google_translate_element');
        if (element && element.innerHTML === '' && (window as any).google?.translate) {
          new (window as any).google.translate.TranslateElement({
            pageLanguage: 'en',
            includedLanguages: 'en,nl,de,fr,es,it,pt,ru,ja,ko,zh-CN,ar,hi',
            layout: (window as any).google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false,
            gaTrack: false,
            multilanguagePage: true
          }, 'google_translate_element');
          
          // Clean up Google Translate banners but keep dropdown visible
          setTimeout(() => {
            // Hide ONLY the unwanted banner elements
            const bannerFrame = document.querySelector('.goog-te-banner-frame');
            if (bannerFrame) {
              (bannerFrame as HTMLElement).style.display = 'none';
            }
            
            // Hide notification bars
            const notificationBars = document.querySelectorAll('.goog-te-balloon-frame, .goog-te-balloon, .goog-te-ftab');
            notificationBars.forEach(bar => {
              (bar as HTMLElement).style.display = 'none';
            });
            
            // Ensure dropdown is visible and styled
            const dropdown = document.querySelector('#google_translate_element .goog-te-combo');
            if (dropdown) {
              (dropdown as HTMLElement).style.display = 'block';
              (dropdown as HTMLElement).style.visibility = 'visible';
              (dropdown as HTMLElement).style.opacity = '1';
            }
            
            // Reset body positioning
            document.body.style.top = '0';
            document.body.style.marginTop = '0';
          }, 200);
        }
      };

      // Check if Google Translate is already loaded
      if ((window as any).google?.translate) {
        initializeGoogleTranslate();
      } else {
        // Wait for Google Translate to load
        let attempts = 0;
        const checkInterval = setInterval(() => {
          if ((window as any).google?.translate || attempts > 50) {
            clearInterval(checkInterval);
            if ((window as any).google?.translate) {
              initializeGoogleTranslate();
            }
          }
          attempts++;
        }, 100);

        return () => clearInterval(checkInterval);
      }
    }
  }, [isOpen]);


  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button 
        className="flex items-center space-x-1 rounded-full p-1 hover:bg-gray-100 transition-colors duration-200"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Avatar className="h-8 w-8 border border-gray-200">
          <AvatarFallback>{getUserInitials()}</AvatarFallback>
        </Avatar>
        <span className="max-w-[150px] truncate font-medium text-sm hidden sm:block">
          {user.fullName || user.username}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-500 hidden sm:block" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="p-3 border-b border-gray-100">
            <p className="text-sm font-medium">{user.fullName || user.username}</p>
            <p className="text-xs text-gray-500 truncate">{user.email || 'No email set'}</p>
          </div>
          
          <div className="py-1">
            <Link 
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
            >
              <User className="mr-2 h-4 w-4" />
              Profile
            </Link>
            
            <Link 
              href="/profile/edit"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
            >
              <Settings className="mr-2 h-4 w-4" />
              Edit Profile
            </Link>

            <div className="px-4 py-2 border-b border-gray-100">
              <div className="text-xs font-medium text-gray-500 mb-1">Translate Page</div>
              <div id="google_translate_element" className="google-translate-widget"></div>
            </div>

            {/* Admin-only menu items */}
            {user.role === UserRole.ADMIN && (
              <>
                <div className="px-3 py-1 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500">Administration</p>
                </div>
                <Link
                  href="/users"
                  onClick={() => setIsOpen(false)}
                  className="flex w-full items-center px-4 py-2 text-sm text-primary-600 hover:bg-gray-100 text-left font-medium"
                >
                  <UserCog className="mr-2 h-4 w-4" />
                  Users
                </Link>
                <Link
                  href="/admin/backup"
                  onClick={() => setIsOpen(false)}
                  className="flex w-full items-center px-4 py-2 text-sm text-primary-600 hover:bg-gray-100 text-left font-medium"
                >
                  <Database className="mr-2 h-4 w-4" />
                  Backup Management
                </Link>
              </>
            )}
          </div>
          
          <div className="py-1 border-t border-gray-100">
            <button
              className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}