import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

const quickActions = [
  {
    label: "New Reservation",
    icon: "calendar-plus",
    href: "/reservations/add",
    primary: true,
  },
  {
    label: "Add Vehicle",
    icon: "car",
    href: "/vehicles/add",
  },
  {
    label: "Add Customer",
    icon: "user-plus",
    href: "/customers/add",
  },
  {
    label: "Upload Document",
    icon: "upload",
    href: "/documents",
  },
  {
    label: "Add Damage Report",
    icon: "alert-triangle",
    href: "/documents/upload?type=damage",
  },
  {
    label: "Record Expense",
    icon: "receipt",
    href: "/expenses/add",
  },
];

export function QuickActions() {
  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium text-gray-800">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href}>
              <Button
                variant={action.primary ? "default" : "outline"}
                className={
                  action.primary
                    ? "bg-primary-600 text-white hover:bg-primary-700"
                    : "bg-primary-50 text-primary-600 hover:bg-primary-100"
                }
                size="sm"
              >
                <ActionIcon name={action.icon} className="mr-1 h-4 w-4" />
                {action.label}
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface ActionIconProps {
  name: string;
  className?: string;
}

function ActionIcon({ name, className = "" }: ActionIconProps) {
  switch (name) {
    case "calendar-plus":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-calendar-plus ${className}`}
        >
          <path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
          <line x1="19" x2="19" y1="16" y2="22" />
          <line x1="16" x2="22" y1="19" y2="19" />
        </svg>
      );
    case "car":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-car ${className}`}
        >
          <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" />
          <circle cx="6.5" cy="16.5" r="2.5" />
          <circle cx="16.5" cy="16.5" r="2.5" />
        </svg>
      );
    case "user-plus":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-user-plus ${className}`}
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" x2="19" y1="8" y2="14" />
          <line x1="22" x2="16" y1="11" y2="11" />
        </svg>
      );
    case "upload":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-upload ${className}`}
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </svg>
      );
    case "alert-triangle":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-alert-triangle ${className}`}
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "receipt":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-receipt ${className}`}
        >
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <path d="M12 17.5v-11" />
        </svg>
      );
    default:
      return null;
  }
}
