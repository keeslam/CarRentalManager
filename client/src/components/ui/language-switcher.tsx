import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const changeLanguage = (language: string) => {
    i18n.changeLanguage(language);
  };

  const currentLanguage = i18n.language || 'en';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" data-testid="language-switcher">
          <Globe className="h-4 w-4 mr-2" />
          {currentLanguage === 'en' ? t('english') : t('dutch')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => changeLanguage('en')}
          className={currentLanguage === 'en' ? 'bg-accent' : ''}
          data-testid="language-en"
        >
          🇺🇸 {t('english')}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => changeLanguage('nl')}
          className={currentLanguage === 'nl' ? 'bg-accent' : ''}
          data-testid="language-nl"
        >
          🇳🇱 {t('dutch')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}