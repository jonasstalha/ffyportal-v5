import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
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

  // DEBUG: Log user data every time sidebar renders
  useEffect(() => {
    console.log("🔍 SIDEBAR - User object:", user);
    console.log("🔍 SIDEBAR - User role:", user?.role);
    console.log("🔍 SIDEBAR - User email:", user?.email);
    console.log("🔍 SIDEBAR - User UID:", user?.uid);
  }, [user]);

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
        localStorage.clear();
        sessionStorage.clear();
        await signOut();
        window.location.href = '/auth';
      } catch (error) {
        console.error('Error during logout:', error);
        window.location.href = '/auth';
      }
    }
  };

  // Define role-based access for sections
  const getSectionRoles = (sectionKey: string): string[] => {
    const sectionRoles: Record<string, string[]> = {
      // Main menu accessible to all authenticated users
      "menu": ["admin", "quality", "logistics", "reception", "production", "personnel", "comptabilite", "maintenance"],
      
      // Admin section - only for admins
      "admin": ["admin"],
      
      // Logistics section
      "logistics": ["admin", "logistics"],
      
      // Quality section
      "quality": ["admin", "quality"],
      
      // Reception section
      "reception": ["admin", "reception"],
      
      // Production section
      "production": ["admin", "production"],
      
      // Personnel section
      "personnel": ["admin", "personnel"],
      
      // Accounting section
      "Comptabilité": ["admin", "comptabilite"],
      
      // Maintenance section
      "maintenance": ["admin", "maintenance"]
    };
    
    return sectionRoles[sectionKey] || [];
  };

  // Check if user has access to a specific section
  const hasAccessToSection = (sectionKey: string): boolean => {
    if (!user) return false;
    
    // Admin always has access to everything
    if (user.role === 'admin') return true;

    // Normalize role variants to canonical tokens for comparisons
    const normalizeRoleLocal = (r?: string) => {
      if (!r) return '';
      const v = String(r).toLowerCase().trim();
      if (v === 'logistique') return 'logistics';
      if (v === 'qualite' || v === 'qualité') return 'quality';
      if (v === 'comptability' || v === 'comptabilité' || v === 'comptabilite') return 'comptabilite';
      if (v === 'comptabilite') return 'comptabilite';
      // keep common english variants
      if (v === 'logistics') return 'logistics';
      if (v === 'production') return 'production';
      if (v === 'reception') return 'reception';
      if (v === 'personnel') return 'personnel';
      if (v === 'maintenance') return 'maintenance';
      if (v === 'quality') return 'quality';
      if (v === 'operator') return 'operator';
      if (v === 'client') return 'client';
      if (v === 'support') return 'support';
      return v;
    };

    const normalizedUserRole = normalizeRoleLocal(user.role);
    const allowedRoles = getSectionRoles(sectionKey);

    // Check both raw and normalized role against allowed roles and also accept some synonyms
    return allowedRoles.includes(user.role) || allowedRoles.includes(normalizedUserRole);
  };

  // Menu items with role restrictions at item level
  const menuConfig = {
    menu: {
      title: t('nav.menu'),
      items: [
        {
          title: t('nav.dashboard'),
          icon: <Home className="h-5 w-5 mr-2" />,
          path: "/",
          allowedRoles: ["admin", "quality", "logistics", "reception", "production", "personnel", "comptabilite", "maintenance"],
        },
        {
          title: t('dashboard.notifications'),
          icon: <Bell className="h-5 w-5 mr-2" />,
          path: "/communication-dashboard",
          allowedRoles: ["admin", "quality", "logistics", "reception", "production", "personnel", "comptabilite", "maintenance"],
        },
        {
          title: t('common.add') + " " + t('common.entry'),
          icon: <UserPlus className="h-5 w-5 mr-2" />,
          path: "/new-entry",
          allowedRoles: ["admin", "reception"],
        },
        {
          title: t('common.clientOrder'),
          icon: <ShoppingCart className="h-5 w-5 mr-2" />,
          path: "/commandeclinet",
          allowedRoles: ["admin", "logistics", "comptabilite"],
        },
        {
          title: t('common.scanCode'),
          icon: <QrCode className="h-5 w-5 mr-2" />,
          path: "/scan",
          allowedRoles: ["admin", "quality", "logistics", "reception", "production"],
        },
      ],
    },
    admin: {
      title: t('nav.admin'),
      items: [
        {
          title: t('personnel.employees'),
          icon: <Users className="h-5 w-5 mr-2" />,
          path: "/users",
          allowedRoles: ["admin"],
        },
        {
          title: t('common.manageLots'),
          icon: <PackageCheck className="h-5 w-5 mr-2" />,
          path: "/lots",
          allowedRoles: ["admin"],
        },
        {
          title: t('common.manageFarms'),
          icon: <Tractor className="h-5 w-5 mr-2" />,
          path: "/farms",
          allowedRoles: ["admin"],
        },
      ],
    },
    logistics: {
      title: t('nav.logistics'),
      items: [
        {
          title: t('logistics.reports'),
          icon: <FileText className="h-5 w-5 mr-2" />,
          path: "/rapport-generating",
          allowedRoles: ["admin", "logistics"],
        },
        {
          title: t('logistics.inventory'),
          icon: <Box className="h-5 w-5 mr-2" />,
          path: "/inventory",
          allowedRoles: ["admin", "logistics"],
        },
        {
          title: t('logistics.expeditionSheet'),
          icon: <Truck className="h-5 w-5 mr-2" />,
          path: "/logistique/fichedexpidition",
          allowedRoles: ["admin", "logistics"],
        },
        {
          title: t('packing list'),
          icon: <Package className="h-5 w-5 mr-2" />,
          path: "/packinglist",
          allowedRoles: ["admin", "logistics"],
        },
        {
          title: 'Suivi emballages',
          icon: <Package className="h-5 w-5 mr-2" />,
          path: "/suivi-emballages",
          allowedRoles: ["admin", "logistics"],
        },
        {
          title: 'archive logistique',
          icon: <Package className="h-5 w-5 mr-2" />,
          path: "/archive-logistique",
          allowedRoles: ["admin", "logistics"],
        },
      ],
    },
    quality: {
      title: t('nav.quality'),
      items: [
        {
          title: t('quality.title'),
          icon: <ShieldCheck className="h-5 w-5 mr-2" />,
          path: "/qualitycontrol",
          allowedRoles: ["admin", "quality"],
        },
        {
          title: t('quality.reports'),
          icon: <FileBarChart className="h-5 w-5 mr-2" />,
          path: "/Rapportqualité",
          allowedRoles: ["admin", "quality"],
        },
        {
          title: 'Archive Qualité',
          icon: <Archive className="h-5 w-5 mr-2" />,
          path: "/quality-archive",
          allowedRoles: ["admin", "quality"],
        },
      ],
    },
    reception: {
      title: t('nav.reception'),
      items: [
        {
          title: 'SUIVI RECEPTION',
          icon: <Recycle className="h-5 w-5 mr-2" />,
          path: "/nouvelleSUIVIRECEPTION",
          allowedRoles: ["admin", "reception"],
        },
        {
          title: 'les jours de réception',
          icon: <Clipboard className="h-5 w-5 mr-2" />,
          path: "/suivi-reception",
          allowedRoles: ["admin", "reception"],
        },
        {
          title: 'full Reception Avocat',
          icon: <Recycle className="h-5 w-5 mr-2" />,
          path: "/full-Reception-Avocat",
          allowedRoles: ["admin", "reception"],
        },
        {
          title: 'Contrôle à la réception',
          icon: <ClipboardCheck className="h-5 w-5 mr-2" />,
          path: "/controle-reception",
          allowedRoles: ["admin", "reception", "quality"],
        },
        {
          title: 'Suivi déchets',
          icon: <Recycle className="h-5 w-5 mr-2" />,
          path: "/dechet-vendu",
          allowedRoles: ["admin", "reception", "maintenance"],
        },
                {
          title: 'BoxTraking',
          icon: <Recycle className="h-5 w-5 mr-2" />,
          path: "/BoxTraking",
          allowedRoles: ["admin", "reception", "maintenance"],
        },
      ],
    },
    production: {
      title: t('nav.production'),
      items: [
        {
          title: t('production.consumption'),
          icon: <Calculator className="h-5 w-5 mr-2" />,
          path: "/calculedeconsomation",
          allowedRoles: ["admin", "production"],
        },
        {
          title: t('consomation stock'),
          icon: <TrendingUp className="h-5 w-5 mr-2" />,
          path: "/historiquedeconsomation",
          allowedRoles: ["admin", "production"],
        },
        {
          title: t('suivi production'),
          icon: <Factory className="h-5 w-5 mr-2" />,
          path: "/suivi-production",
          allowedRoles: ["admin", "production"],
        },
        {
          title: t('common.warehouses'),
          icon: <Warehouse className="h-5 w-5 mr-2" />,
          path: "/warehouses",
          allowedRoles: ["admin", "production", "logistics"],
        },
        {
          title: t('ficheDechet'),
          icon: <StickyNote className="h-5 w-5 mr-2" />,
          path: "/ficheDechet",
          allowedRoles: ["admin", "production"],
        },
      ],
    },
    personnel: {
      title: t('nav.personnel'),
      items: [
        {
          title: t('personnel.title'),
          icon: <UserCog className="h-5 w-5 mr-2" />,
          path: "/personnelmanagement",
          allowedRoles: ["admin", "personnel"],
        },
        {
          title: t('personnel.schedule'),
          icon: <Calendar className="h-5 w-5 mr-2" />,
          path: "/schedules",
          allowedRoles: ["admin", "personnel"],
        },
        {
          title: t('personnel.workHoursHistory'),
          icon: <Clock className="h-5 w-5 mr-2" />,
          path: "/work-hours-history",
          allowedRoles: ["admin", "personnel"],
        },
        {
          title: t('personnel.payroll'),
          icon: <DollarSign className="h-5 w-5 mr-2" />,
          path: "/fiche-de-paie",
          allowedRoles: ["admin", "personnel", "comptabilite"],
        },
      ],
    },
    Comptabilité: {
      title: t('nav.accounting'),
      items: [
        {
          title: t('accounting.templates'),
          icon: <FileSpreadsheet className="h-5 w-5 mr-2" />,
          path: "/Templates",
          allowedRoles: ["admin", "comptabilite"],
        },
        {
          title: t('accounting.invoiceArchive'),
          icon: <ArchiveRestore className="h-5 w-5 mr-2" />,
          path: "https://archifage.fruitsforyou.ma",
          isExternal: true,
          allowedRoles: ["admin", "comptabilite"],
        },
      ],
    },
    maintenance: {
      title: 'Maintenance',
      items: [
        {
          title: 'Suivi déchets vendu',
          icon: <Recycle className="h-5 w-5 mr-2" />,
          path: "/suivi-dechets",
          allowedRoles: ["admin", "maintenance"],
        },
      ],
    },
  };

  const renderSection = (sectionKey: keyof typeof menuConfig) => {
    const section = menuConfig[sectionKey];
    
    // DEBUG: Log section access
    console.log(`🔍 Checking access for section "${sectionKey}":`);
    console.log(`   User role: "${user?.role}"`);
    console.log(`   Has access: ${hasAccessToSection(sectionKey)}`);
    
    // Check if user has access to this section
    if (!hasAccessToSection(sectionKey)) {
      console.log(`   ❌ No access to "${sectionKey}"`);
      return null;
    }
    
    console.log(`   ✅ Has access to "${sectionKey}"`);
    
    // Filter items based on user role
    const accessibleItems = section.items.filter(item => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      const normalized = (role: string | undefined) => {
        if (!role) return '';
        const v = String(role).toLowerCase().trim();
        if (v === 'logistique') return 'logistics';
        if (v === 'qualite' || v === 'qualité') return 'quality';
        if (v === 'comptability' || v === 'comptabilité' || v === 'comptabilite') return 'comptabilite';
        return v;
      };

      const userRoleNorm = normalized(user.role);
      // Allow access if either raw or normalized user role is listed in allowedRoles
      return item.allowedRoles?.includes(user.role) || item.allowedRoles?.includes(userRoleNorm);
    });

    // If no items are accessible after filtering, don't render the section
    if (accessibleItems.length === 0) {
      return null;
    }

    return (
      <div key={sectionKey}>
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
              {section.title}
            </span>
          )}
        </div>
        
        {expandedSections.includes(sectionKey) && (
          <ul>
            {accessibleItems.map((item, index) => (
              <li key={index} className="mb-1">
                {item.isExternal ? (
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
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

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
            {/* Add debug info */}


            <div className="text-sm text-green-400 font-medium truncate">
              {user.email}
            </div>

            {user.role === 'admin' && (
              <div className="text-xs text-yellow-400 flex items-center">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Full Access
              </div>
            )}

            <div className="flex flex-col items-start space-y-1">
              <div className="text-xs text-neutral-500">Role:</div>
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
                {/* Show the actual role value */}
                {user.role === 'admin' ? 'Administrateur' :
                user.role === 'quality' ? 'Qualité' :
                user.role === 'logistics' ? 'Logistique' :
                user.role === 'reception' ? 'Réception' :
                user.role === 'production' ? 'Production' :
                user.role === 'personnel' ? 'Personnel' :
                user.role === 'comptabilite' ? 'Comptabilité' :
                user.role === 'maintenance' ? 'Maintenance' :
                user.role || 'N/A'}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-2 flex-grow overflow-y-auto scrollbar-hide">
          {Object.keys(menuConfig).map((sectionKey) => 
            renderSection(sectionKey as keyof typeof menuConfig)
          )}
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
                {isSidebarOpen && <span className="ml-2">{t('logout')}</span>}
              </button>
            </TooltipTrigger>
            {!isSidebarOpen && (
              <TooltipContent>{t('logout')}</TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Bottom Section */}
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