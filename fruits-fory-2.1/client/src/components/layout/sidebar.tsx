import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  Home,
  PlusSquare,
  QrCode,
  FileText,
  ChartBar,
  Calculator,
  Layers,
  History,
  Tractor,
  Users,
  PackageCheck,
  Leaf,
  FileBarChart,
  BarChart3,
  Warehouse,
  ChevronDown,
  ChevronRight,
  Truck,
  Package,
  ClipboardList,
  UserCog,
  Calendar,
  LayoutTemplate,
  ArchiveRestore,
  ShieldCheck,
  ChevronLeft,
  Construction,
  Plus,
  Lock,
  Clock,
  DollarSign,
  // New unique icons for each page
  Bell,
  UserPlus,
  ShoppingCart,
  Search,
  Archive,
  ClipboardCheck,
  Clipboard,
  Recycle,
  Factory,
  Wrench,
  Settings,
  FileSpreadsheet,
  TrendingUp,
  Box,
  Zap,
  Target,
  Monitor,
  BookOpen,
  Mail,
  LogOut,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Sidebar() {
  const [location, navigate] = useLocation();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user, hasAccess, signOut } = useAuth();
  const { t, isRTL } = useLanguage();

  const isActive = (path: string) => {
    return location === path;
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const handleLogout = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir vous déconnecter?')) {
      try {
        // Clear localStorage data
        localStorage.clear();
        
        // Clear sessionStorage data
        sessionStorage.clear();
        
        // Sign out from Firebase
        await signOut();
        
        // Force redirect to login page
        window.location.href = '/auth';
      } catch (error) {
        console.error('Error during logout:', error);
        // Force redirect even if signOut fails
        window.location.href = '/auth';
      }
    }
  };

  const renderSection = (title: string, items: any[], sectionKey: string) => {
    const hasAccessToSection = hasAccess(sectionKey);
    
    // If no access to section, don't render it at all
    if (!hasAccessToSection) {
      return null;
    }

    return (
      <div>
        <div
          className={cn(
            "mt-6 py-2 px-4 text-xs uppercase flex items-center cursor-pointer rounded-md transition-all duration-300 ease-in-out",
            "text-neutral-500 hover:bg-neutral-700"
          )}
          onClick={() => toggleSection(sectionKey)}
        >
          {expandedSections.includes(sectionKey) ? (
            <ChevronDown className="h-4 w-4 mr-2" />
          ) : (
            <ChevronRight className="h-4 w-4 mr-2" />
          )}
          {isSidebarOpen && (
            <span className="flex items-center">
              {title}
            </span>
          )}
        </div>
        
        {expandedSections.includes(sectionKey) && (
          <ul>
            {items.filter(item => hasAccess(item.section || sectionKey)).map((item, index) => (
              <li key={index} className="mb-1">
                {hasAccessToSection ? (
                  // Accessible items
                  item.isExternal ? (
                    <a href={item.path} target="_blank" rel="noopener noreferrer">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "flex items-center p-3 rounded-md transition-colors cursor-pointer",
                              "hover:bg-neutral-700 text-neutral-300"
                            )}
                          >
                            {item.icon}
                            {isSidebarOpen && <span className="ml-2">{item.title}</span>}
                          </div>
                        </TooltipTrigger>
                        {!isSidebarOpen && (
                          <TooltipContent>{item.title}</TooltipContent>
                        )}
                      </Tooltip>
                    </a>
                  ) : (
                    <Link href={item.path}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "flex items-center p-3 rounded-md transition-colors cursor-pointer",
                              isActive(item.path)
                                ? "bg-green-700 text-white shadow-md"
                                : "hover:bg-neutral-700 text-neutral-300"
                            )}
                          >
                            {item.icon}
                            {isSidebarOpen && <span className="ml-2">{item.title}</span>}
                          </div>
                        </TooltipTrigger>
                        {!isSidebarOpen && (
                          <TooltipContent>{item.title}</TooltipContent>
                        )}
                      </Tooltip>
                    </Link>
                  )
                ) : (
                  // Locked items - visible but not clickable
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "flex items-center p-3 rounded-md transition-colors cursor-not-allowed opacity-60",
                          "text-neutral-500 hover:bg-red-900/10"
                        )}
                      >
                        {item.icon}
                        {isSidebarOpen && <span className="ml-2">{item.title}</span>}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      Accès restreint - Contactez l'administrateur
                    </TooltipContent>
                  </Tooltip>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  // All menu items with icons
  const mainItems = [
    {
      title: t('nav.dashboard'),
      icon: <Home className="h-5 w-5 mr-2" />,
      path: "/",
    },
    {
      title: t('dashboard.notifications'),
      icon: <Bell className="h-5 w-5 mr-2" />,
      path: "/communication-dashboard",
    },
    {
      title: t('common.add') + " " + t('common.entry'),
      icon: <UserPlus className="h-5 w-5 mr-2" />,
      path: "/new-entry",
    },
    {
      title: t('common.clientOrder'),
      icon: <ShoppingCart className="h-5 w-5 mr-2" />,
      path: "/commandeclinet",
    },
    {
      title: t('common.scanCode'),
      icon: <QrCode className="h-5 w-5 mr-2" />,
      path: "/scan",
    },
  ];  // const traceabilityItems = [
  //   {
  //     title: "Rapports PDF",
  //     icon: <FileText className="h-5 w-5 mr-2" />,
  //     path: "/reports",
  //   },
  //   // {
  //   //   title: "Statistiques",
  //   //   icon: <BarChart3 className="h-5 w-5 mr-2" />,
  //   //   path: "/statistics",
  //   // },
  // ];

  const adminItems = [
    {
      title: t('personnel.employees'),
      icon: <Users className="h-5 w-5 mr-2" />,
      path: "/users",
    },

    {
      title: t('common.manageLots'),
      icon: <PackageCheck className="h-5 w-5 mr-2" />,
      path: "/lots",
    },
    {
      title: t('common.manageFarms'),
      icon: <Tractor className="h-5 w-5 mr-2" />,
      path: "/farms",
    },

  ];

  const logisticsItems = [
    {
      title: t('logistics.reports'),
      icon: <FileText className="h-5 w-5 mr-2" />,
      path: "/rapport-generating",
    },
    {
      title: t('logistics.inventory'),
      icon: <Box className="h-5 w-5 mr-2" />,
      path: "/inventory",
    }, 
    {
      title: t('logistics.expeditionSheet'),
      icon: <Truck className="h-5 w-5 mr-2" />,
      path: "/logistique/fichedexpidition",
    },
    {
      title: t('packing list'),
      icon: <Package  className="h-5 w-5 mr-2" />,
      path: "/packinglist",
    },
        {
      title: t('common.archive'),
      icon: <Archive className="h-5 w-5 mr-2" />,
      path: "https://archifage.fruitsforyou.ma",
      isExternal: true,
    },
        {
      title: 'Suivi emballages',
      icon: <Package className="h-5 w-5 mr-2" />,
      path: "/suivi-emballages",
    },
 

  ];

  const quality = [
    {
      title: t('quality.title'),
      icon: <ShieldCheck className="h-5 w-5 mr-2" />,
      path: "/qualitycontrol",
    },
    {
      title: t('quality.reports'),
      icon: <FileBarChart className="h-5 w-5 mr-2" />,
      path: "/Rapportqualité",
    },
    {
      title: 'Archive Qualité',
      icon: <Archive className="h-5 w-5 mr-2" />,
      path: "/quality-archive",
    },
  ];

  const ReceptionItems = [
    {
      title: 'Suivi réception',
      icon: <Clipboard className="h-5 w-5 mr-2" />,
      path: "/suivi-reception",
    },
    {
      title: 'Contrôle à la réception',
      icon: <ClipboardCheck className="h-5 w-5 mr-2" />,
      path: "/controle-reception",
    },
    {
      title: 'Suivi déchets vendu ',
      icon: <Recycle className="h-5 w-5 mr-2" />,
      path: "/suivi-dechets",
    },

        {
      title: 'full Reception Avocat',
      icon: <Recycle className="h-5 w-5 mr-2" />,
      path: "/full-Reception-Avocat",
    },

  ];

  const personnelItems = [
    {
      title: t('personnel.title'),
      icon: <UserCog className="h-5 w-5 mr-2" />,
      path: "/personnelmanagement",
    },
    {
      title: t('personnel.schedule'),
      icon: <Calendar className="h-5 w-5 mr-2" />,
      path: "/schedules",
    },
    {
      title: t('personnel.workHoursHistory'),
      icon: <Clock className="h-5 w-5 mr-2" />,
      path: "/work-hours-history",
    },
    {
      title: t('personnel.payroll'),
      icon: <DollarSign className="h-5 w-5 mr-2" />,
      path: "/fiche-de-paie",
    },
  ];

  const production = [
    {
      title: t('production.consumption'),
      icon: <Calculator className="h-5 w-5 mr-2" />,
      path: "/calculedeconsomation",
    },
    {
      title: t('production.tracking'),
      icon: <TrendingUp className="h-5 w-5 mr-2" />,
      path: "/historiquedeconsomation",
    },
    {
      title: t('production.title'),
      icon: <Factory className="h-5 w-5 mr-2" />,
      path: "/suivi-production",
    },
        {
      title: t('common.warehouses'),
      icon: <Warehouse className="h-5 w-5 mr-2" />,
      path: "/warehouses",
    },
        {
      title: t('ficheDechet'),
      icon: <StickyNote  className="h-5 w-5 mr-2" />,
      path: "/ficheDechet",
    },
  ];

  const Comptabilité = [
    {
      title: t('accounting.templates'),
      icon: <FileSpreadsheet className="h-5 w-5 mr-2" />,
      path: "/Templates",
    },
    {
      title: t('accounting.invoiceArchive'),
      icon: <ArchiveRestore className="h-5 w-5 mr-2" />,
      path: "https://archifage.fruitsforyou.ma",
      isExternal: true,
    },
  ];

  const maintenanceItems = [
            {
      title: 'Suivi déchets',
      icon: <Recycle className="h-5 w-5 mr-2" />,
      path: "/dechet-vendu",
    },
   
               {
      title: 'TESTING SUIVI RECEPTION',
      icon: <Recycle className="h-5 w-5 mr-2" />,
      path: "/nouvelleSUIVIRECEPTION",
    },
  

  ];

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "bg-neutral-800 text-white flex-shrink-0 h-screen flex flex-col transition-all duration-300 ease-in-out shadow-lg",
          isSidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-neutral-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isSidebarOpen ? (
              <img 
                src="/assets/fruitsforyou_white.png" 
                alt="Fruits For You" 
                className="h-8 w-auto"
              />
            ) : (
              <img 
                src="/assets/fruitsforyou_white.png" 
                alt="Fruits For You" 
                className="h-6 w-6 object-contain"
              />
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="text-neutral-400 hover:text-white focus:outline-none"
          >
            {isSidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>

 {/* User Info */}
{user && isSidebarOpen && (
  <div className="p-4 bg-neutral-900 border-b border-neutral-700 space-y-2">
    {/* Email */}
    <div className="text-sm text-green-400 font-medium truncate">
      {user.email}
    </div>

    {/* Admin badge */}
    {user.role === 'admin' && (
      <div className="text-xs text-yellow-400 flex items-center">
        <ShieldCheck className="h-3 w-3 mr-1" />
        Full Access
      </div>
    )}

    {/* Role */}
    <div className="flex flex-col items-start space-y-1">
      <div className="text-xs text-neutral-500">{t('common.role')}:</div>
      <div
        className={cn(
          "px-2 py-1 rounded-full text-xs font-medium",
          user.role === 'admin' ? 'bg-red-100 text-red-800' :
          user.role === 'quality' ? 'bg-blue-100 text-blue-800' :
          user.role === 'logistics' ? 'bg-purple-100 text-purple-800' :
          user.role === 'reception' ? 'bg-green-100 text-green-800' :
          user.role === 'production' ? 'bg-yellow-100 text-yellow-800' :
          user.role === 'personnel' ? 'bg-pink-100 text-pink-800' :
          user.role === 'comptabilite' ? 'bg-indigo-100 text-indigo-800' :
          user.role === 'maintenance' ? 'bg-orange-100 text-orange-800' :
          'bg-gray-100 text-gray-800'
        )}
      >
        {user.role === 'comptabilite' ? t('nav.accounting') : user.role?.toUpperCase()}
      </div>
    </div>
  </div>
)}

        {/* Navigation */}
          <nav className="p-2 flex-grow overflow-y-auto scrollbar-hide">
          {renderSection(t('nav.menu'), mainItems, "menu")}
          {renderSection(t('nav.admin'), adminItems, "admin")}
          {renderSection(t('nav.logistics'), logisticsItems, "logistics")}
          {renderSection(t('nav.quality'), quality, "quality")}
          {renderSection(t('nav.reception'), ReceptionItems, "reception")}
          {renderSection(t('nav.production'), production, "production")}
          {renderSection(t('nav.personnel'), personnelItems, "personnel")}
          {renderSection(t('nav.accounting'), Comptabilité, "Comptabilité")}
          {renderSection('Maintenance', maintenanceItems, "maintenance")}
        </nav>

        {/* Logout Button */}
        <div className="border-t border-neutral-700 p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className={cn(
                  "w-full flex items-center p-3 rounded-md transition-colors cursor-pointer",
                  "hover:bg-red-700 text-neutral-300 hover:text-white"
                )}
              >
                <LogOut className="h-5 w-5" />
                {isSidebarOpen && <span className="ml-2">{('logout')}</span>}
              </button>
            </TooltipTrigger>
            {!isSidebarOpen && (
              <TooltipContent>{('logout')}</TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Bottom Section with Version and Info */}
        {isSidebarOpen && (
          <div className="p-2 border-t border-neutral-700 text-center text-xs text-neutral-500">
            <div>Version 1.0</div>
            <div>© 2025 Convo Bio Compliance</div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
