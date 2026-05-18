/**
 * Auth Page - Login & Create Company
 * Unified authentication page with toggle between signin and company creation
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signUpNewCompany, loginUser } from '../../lib/firebase/auth';
import type { SignUpData } from '../../types/multi-tenant';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'create'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login form state
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  });

  // Create company form state
  const [createData, setCreateData] = useState({
    companyName: '',
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // ============================================================================
  // LOGIN HANDLERS
  // ============================================================================

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!loginData.email || !loginData.password) {
        setError('Email and password are required');
        return;
      }

      await loginUser(loginData.email, loginData.password);
      navigate('/dashboard');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // CREATE COMPANY HANDLERS
  // ============================================================================

  const handleCreateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCreateData(prev => ({ ...prev, [name]: value }));
  };

  const validateCreateForm = (): boolean => {
    if (!createData.companyName.trim()) {
      setError('Company name is required');
      return false;
    }

    if (!createData.displayName.trim()) {
      setError('Your name is required');
      return false;
    }

    if (!createData.email.trim()) {
      setError('Email is required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(createData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (!createData.password || createData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordRegex.test(createData.password)) {
      setError('Password must contain uppercase, lowercase, and numbers');
      return false;
    }

    if (createData.password !== createData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateCreateForm()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const signUpData: SignUpData = {
        email: createData.email,
        password: createData.password,
        displayName: createData.displayName,
        companyName: createData.companyName,
      };

      await signUpNewCompany(signUpData);
      navigate('/dashboard');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create company';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* COMPANY LOGO */}
        <div style={styles.logoSection}>
          <div style={styles.logo}>
            <span style={styles.logoText}>🍎</span>
          </div>
          <h2 style={styles.companyName}>Fruits For You</h2>
        </div>

        {/* TABS */}
        <div style={styles.tabs}>
          <button
            style={{
              ...styles.tab,
              ...(mode === 'login' ? styles.tabActive : {}),
            }}
            onClick={() => {
              setMode('login');
              setError(null);
              setCreateData({
                companyName: '',
                displayName: '',
                email: '',
                password: '',
                confirmPassword: '',
              });
            }}
          >
            Sign In
          </button>
          <button
            style={{
              ...styles.tab,
              ...(mode === 'create' ? styles.tabActive : {}),
            }}
            onClick={() => {
              setMode('create');
              setError(null);
              setLoginData({ email: '', password: '' });
            }}
          >
            Create Company
          </button>
        </div>

        {/* ERROR MESSAGE */}
        {error && <div style={styles.error}>{error}</div>}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={styles.form}>
            <h1 style={styles.title}>Sign in to your account</h1>
            <p style={styles.subtitle}>Welcome back! Please enter your details.</p>

            <div style={styles.formGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                value={loginData.email}
                onChange={handleLoginChange}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                value={loginData.password}
                onChange={handleLoginChange}
                style={styles.input}
                required
              />
            </div>

            <button
              type="submit"
              style={styles.button}
              disabled={isLoading}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>

            <p style={styles.helperText}>
              <a href="/forgot-password" style={styles.link}>
                Forgot password?
              </a>
            </p>
          </form>
        )}

        {/* CREATE COMPANY FORM */}
        {mode === 'create' && (
          <form onSubmit={handleCreateCompany} style={styles.form}>
            <h1 style={styles.title}>Create your company</h1>
            <p style={styles.subtitle}>Get started with your new account.</p>

            <div style={styles.formGroup}>
              <label style={styles.label}>Company Name</label>
              <input
                type="text"
                name="companyName"
                placeholder="e.g., Acme Corp"
                value={createData.companyName}
                onChange={handleCreateChange}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Your Full Name</label>
              <input
                type="text"
                name="displayName"
                placeholder="e.g., John Doe"
                value={createData.displayName}
                onChange={handleCreateChange}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                value={createData.email}
                onChange={handleCreateChange}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                name="password"
                placeholder="Min 8 characters"
                value={createData.password}
                onChange={handleCreateChange}
                style={styles.input}
                required
              />
              <p style={styles.helperTextSmall}>
                Must include uppercase, lowercase, and numbers
              </p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Re-enter password"
                value={createData.confirmPassword}
                onChange={handleCreateChange}
                style={styles.input}
                required
              />
            </div>

            <button
              type="submit"
              style={styles.button}
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Company'}
            </button>

            <p style={styles.termsText}>
              By creating an account, you agree to our{' '}
              <a href="/terms" style={styles.link}>
                Terms of Service
              </a>
            </p>
          </form>
        )}
      </div>

      {/* Decorative Background */}
      <div style={styles.decorative1}></div>
      <div style={styles.decorative2}></div>
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex' as const,
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    position: 'relative' as const,
    overflow: 'hidden',
  },

  decorative1: {
    position: 'absolute' as const,
    top: '-50%',
    right: '-10%',
    width: '500px',
    height: '500px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '50%',
    pointerEvents: 'none' as const,
  },

  decorative2: {
    position: 'absolute' as const,
    bottom: '-30%',
    left: '-5%',
    width: '400px',
    height: '400px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '50%',
    pointerEvents: 'none' as const,
  },

  card: {
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    padding: '40px',
    maxWidth: '450px',
    width: '100%',
    position: 'relative' as const,
    zIndex: 1,
  },

  logoSection: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    marginBottom: '30px',
    paddingBottom: '20px',
    borderBottom: '1px solid #eee',
  },

  logo: {
    width: '60px',
    height: '60px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: '12px',
  },

  logoText: {
    fontSize: '32px',
  },

  companyName: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: '0',
  },

  tabs: {
    display: 'flex' as const,
    gap: '0',
    marginBottom: '30px',
    borderBottom: '2px solid #eee',
  },

  tab: {
    flex: 1,
    padding: '12px 20px',
    border: 'none',
    background: 'transparent',
    fontSize: '16px',
    fontWeight: '600',
    color: '#999',
    cursor: 'pointer',
    transition: 'all 0.3s',
    borderBottom: '3px solid transparent',
    marginBottom: '-2px',
  },

  tabActive: {
    color: '#667eea',
    borderBottomColor: '#667eea',
  },

  form: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
  },

  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: '0 0 8px 0',
  },

  subtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '20px',
  },

  error: {
    background: '#fee',
    color: '#c33',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '20px',
    fontSize: '14px',
    border: '1px solid #fcc',
  },

  formGroup: {
    marginBottom: '16px',
    display: 'flex' as const,
    flexDirection: 'column' as const,
  },

  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '6px',
  },

  input: {
    padding: '10px 14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box' as const,
  },

  button: {
    padding: '12px 20px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s',
    marginTop: '8px',
  },

  helperText: {
    fontSize: '13px',
    color: '#666',
    textAlign: 'center' as const,
    marginTop: '12px',
  },

  helperTextSmall: {
    fontSize: '12px',
    color: '#999',
    margin: '4px 0 0 0',
  },

  termsText: {
    fontSize: '12px',
    color: '#666',
    textAlign: 'center' as const,
    marginTop: '12px',
    lineHeight: '1.6',
  },

  link: {
    color: '#667eea',
    textDecoration: 'none',
  },
};
