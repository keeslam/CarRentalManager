import { useState, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { SidebarNav } from "@/components/sidebar-nav";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  
  const title = getPageTitle(location);
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 w-64 bg-white shadow-md z-30 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-primary-600">Auto Lease LAM</h1>
            <button 
              className="md:hidden text-gray-500"
              onClick={() => setSidebarOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x">
                <path d="M18 6 6 18"/>
                <path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>
        </div>
        
        <SidebarNav />
      </aside>

      {/* Header */}
      <header className="bg-white shadow-sm md:ml-64">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <button 
              className="md:hidden text-gray-500 mr-4"
              onClick={() => setSidebarOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu">
                <line x1="4" x2="20" y1="12" y2="12"/>
                <line x1="4" x2="20" y1="6" y2="6"/>
                <line x1="4" x2="20" y1="18" y2="18"/>
              </svg>
            </button>
            <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-full py-2 pl-10 pr-4 text-gray-700 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search absolute left-3 top-2.5 text-gray-500">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
            </div>
            <button className="p-2 rounded-full hover:bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bell text-gray-600">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
              </svg>
            </button>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user text-gray-600">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700">Admin</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="md:ml-64 pt-4 px-4 pb-12">
        {children}
      </main>
    </div>
  );
}

function getPageTitle(location: string): string {
  if (location === "/") return "Dashboard";
  if (location.startsWith("/vehicles")) return "Vehicles";
  if (location.startsWith("/customers")) return "Customers";
  if (location.startsWith("/reservations")) return "Reservations";
  if (location.startsWith("/expenses")) return "Expenses";
  if (location.startsWith("/documents")) return "Documents";
  return "Auto Lease LAM";
}
