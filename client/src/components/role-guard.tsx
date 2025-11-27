import { useAuth } from "@/hooks/use-auth";
import { Lock } from "lucide-react";

interface RoleGuardProps {
  children: React.ReactNode;
  requiredSection: string;
  fallback?: React.ReactNode;
}

export function RoleGuard({ children, requiredSection, fallback }: RoleGuardProps) {
  const { hasAccess, user } = useAuth();

  if (!hasAccess(requiredSection)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Lock className="h-16 w-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-4">
          You don't have permission to access this section.
        </p>
        <p className="text-sm text-gray-500">
          Your role: <span className="font-medium capitalize">{user?.role}</span>
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
