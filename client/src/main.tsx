import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "@/hooks/use-auth";
import { LanguageProvider } from "@/contexts/LanguageContext";

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <App />
        <Toaster />
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);
