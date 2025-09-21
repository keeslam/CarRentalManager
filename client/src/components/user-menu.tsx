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
  Languages,
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

  // Modern translation functions
  const translatePage = async (targetLanguage: string) => {
    try {
      setIsOpen(false);
      
      // Method 1: Try Chrome's new Built-in Translator API (Chrome 131+)
      if ('Translator' in self) {
        const translator = await (self as any).Translator.create({
          sourceLanguage: 'en',
          targetLanguage: targetLanguage
        });
        
        // Translate all text content
        const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, button, a');
        for (const element of Array.from(textElements)) {
          if (element.textContent && element.textContent.trim()) {
            try {
              const translated = await translator.translate(element.textContent);
              (element as HTMLElement).textContent = translated;
            } catch (e) {
              // Skip elements that can't be translated
            }
          }
        }
        
        translator.destroy();
        return;
      }
      
      // Method 2: Use Google Translate URL redirection (much smoother than widget)
      const currentUrl = encodeURIComponent(window.location.href);
      const translateUrl = `https://translate.google.com/translate?sl=en&tl=${targetLanguage}&u=${currentUrl}`;
      
      // Open in same window for seamless experience
      window.location.href = translateUrl;
      
    } catch (error) {
      console.error('Translation failed:', error);
      
      // Fallback: Google Translate URL redirection
      const currentUrl = encodeURIComponent(window.location.href);
      const translateUrl = `https://translate.google.com/translate?sl=en&tl=${targetLanguage}&u=${currentUrl}`;
      window.location.href = translateUrl;
    }
  };

  const languages = [
    { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'zh-cn', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' }
  ];


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
              <div className="text-xs font-medium text-gray-500 mb-2 flex items-center">
                <Languages className="mr-1 h-3 w-3" />
                Translate Page
              </div>
              <div className="grid grid-cols-2 gap-1">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => translatePage(lang.code)}
                    className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors flex items-center justify-center space-x-1"
                    data-testid={`translate-${lang.code}`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => window.location.reload()}
                className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 transition-colors w-full mt-1"
                data-testid="translate-reset"
              >
                🔄 Reset to English
              </button>
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