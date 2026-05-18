import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/contexts/LanguageContext";
import { Redirect } from "wouter";
import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

export default function AuthPage() {
  const { user, login, signUp, loading } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>("login");
  const [registerLoading, setRegisterLoading] = useState(false);
  
  // Define schemas with translations
  const loginSchema = z.object({
    email: z.string().email(t('auth.invalidEmail')),
    password: z.string().min(6, t('auth.passwordMinLength')),
  });

  const registerSchema = z.object({
    email: z.string().email(t('auth.invalidEmail')),
    password: z.string().min(6, t('auth.passwordMinLength')),
    confirmPassword: z.string(),
    name: z.string().min(2, t('auth.nameRequired')),
    role: z.string().min(1, t('auth.roleRequired')),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('auth.passwordsDoNotMatch'),
    path: ["confirmPassword"],
  });

  // Available roles for registration
  const availableRoles = [
    { value: 'admin', label: 'Administrateur' },
    { value: 'quality', label: 'Qualité' },
    { value: 'logistics', label: 'Logistique' },
    { value: 'reception', label: 'Réception' },
    { value: 'production', label: 'Production' },
    { value: 'personnel', label: 'Personnel' },
    { value: 'comptabilite', label: 'Comptabilité' },
    { value: 'maintenance', label: 'Maintenance' },
  ];

  // Login form
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onLoginSubmit = async (values: z.infer<typeof loginSchema>) => {
    try {
      await login(values.email, values.password);
    } catch (error) {
      console.error("Login failed:", error);
      toast.error(t('auth.loginFailed') || "Échec de connexion");
    }
  };

  // Register form
  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      name: "",
      role: "",
    },
  });

  const onRegisterSubmit = async (values: z.infer<typeof registerSchema>) => {
    setRegisterLoading(true);
    try {
      // Use the signUp function from auth provider
      await signUp(values.email, values.password, values.name, values.role);
      // Clear form after successful registration
      registerForm.reset();
      // Switch to login tab
      setActiveTab("login");
      // Show success message
      toast.success(t('auth.registrationSuccess') || "Inscription réussie! Vous pouvez maintenant vous connecter.");
    } catch (error: any) {
      console.error("Registration error:", error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        toast.error(t('auth.emailAlreadyExists') || "Cet email est déjà utilisé.");
      } else if (error.code === 'auth/weak-password') {
        toast.error(t('auth.weakPassword') || "Le mot de passe est trop faible.");
      } else {
        toast.error(t('auth.registrationFailed') || "Échec de l'inscription.");
      }
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <>
      {user ? (
        <Redirect to="/" />
      ) : (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg">
          {/* Company Logo & Branding */}
          <div className="flex flex-col items-center pt-8 pb-4">
            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center mb-3">
              <span className="text-3xl">🍎</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Fruits For You</h1>
          </div>

          <CardHeader>
            <CardTitle className="text-2xl text-center">
              <span className="text-primary-600">Convo Bio</span> - {t('common.avocadoTraceability')}
            </CardTitle>
            <CardDescription className="text-center">
              {t('auth.accessYourSpace')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100">
                <TabsTrigger value="login" className="text-xs sm:text-sm">{t('auth.login')}</TabsTrigger>
                <TabsTrigger value="register" className="text-xs sm:text-sm">{t('auth.register')}</TabsTrigger>
                <TabsTrigger value="create-company" className="text-xs sm:text-sm font-bold text-purple-600">+ Create Co.</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('auth.email')}</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder={t('auth.enterEmail')} 
                              {...field} 
                              disabled={loading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('auth.password')}</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder={t('auth.enterPassword')} 
                              {...field} 
                              disabled={loading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('auth.signingIn')}
                        </>
                      ) : (
                        t('auth.signIn')
                      )}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
              
              <TabsContent value="register">
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('auth.name')}</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder={t('auth.enterFullName')} 
                              {...field} 
                              disabled={registerLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('auth.email')}</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder={t('auth.enterEmail')} 
                              {...field} 
                              disabled={registerLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('auth.role')}</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            disabled={registerLoading}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('auth.selectRole')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableRoles.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('auth.password')}</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder={t('auth.enterPassword')} 
                              {...field} 
                              disabled={registerLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('auth.confirmPassword')}</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder={t('auth.confirmYourPassword')} 
                              {...field} 
                              disabled={registerLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="text-xs text-muted-foreground">
                      {t('auth.registrationNote')}
                    </div>
                    <Button type="submit" className="w-full" disabled={registerLoading}>
                      {registerLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('auth.signingUp')}
                        </>
                      ) : (
                        t('auth.signUp')
                      )}
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              {/* Create Company Tab */}
              <TabsContent value="create-company" className="mt-0">
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">🚀 Start Your Company</h2>
                    <p className="text-sm text-gray-600">
                      Begin managing your operations immediately
                    </p>
                  </div>

                  <form className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Company Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Fruits Corp or Your Farm Name"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Your Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., John Smith"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="your.email@example.com"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
                      />
                      <p className="text-xs text-gray-600 mt-2">
                        ✓ At least 8 characters | ✓ Capital letter | ✓ Number
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
                      />
                    </div>

                    <Button className="w-full mt-6 h-11 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 font-semibold text-white rounded-lg transition transform hover:scale-105">
                      🎯 Create Company & Get Started
                    </Button>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                      <p className="text-xs text-blue-900">
                        <strong>✨ Free Plan:</strong> Unlimited users, basic features. Upgrade anytime!
                      </p>
                    </div>

                    <p className="text-xs text-gray-600 text-center mt-4">
                      Already have an account?{' '}
                      <button
                        type="button"
                        className="font-semibold text-purple-600 hover:underline cursor-pointer"
                        onClick={() => setActiveTab('login')}
                      >
                        Sign in here
                      </button>
                    </p>
                  </form>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col items-center text-sm text-muted-foreground">
            <div className="text-center">
              {t('auth.forgotPassword')} <a href="#" className="text-primary-600 hover:underline">
                {t('auth.contactAdmin')}
              </a>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
      )}
    </>
  );
}