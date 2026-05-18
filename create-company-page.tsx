/**
 * Create Company Page
 * Allows users to create a new company and become the admin
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signUpNewCompany } from '../../lib/firebase/auth';
import type { SignUpData } from '../../types/multi-tenant';

interface CreateCompanyPageProps {
  onSuccess?: () => void;
}

export const CreateCompanyPage: React.FC<CreateCompanyPageProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    companyName: '',
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'info' | 'account'>('info');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.companyName.trim()) {
      setError('Company name is required');
      return;
    }

    setError(null);
    setStep('account');
  };

  const handleBackStep = () => {
    setError(null);
    setStep('info');
  };

  const validateForm = (): boolean => {
    if (!formData.displayName.trim()) {
      setError('Your name is required');
      return false;
    }

    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (!formData.password || formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordRegex.test(formData.password)) {
      setError('Password must contain uppercase, lowercase, and numbers');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const signUpData: SignUpData = {
        email: formData.email,
        password: formData.password,
        displayName: formData.displayName,
        companyName: formData.companyName,
      };

      await signUpNewCompany(signUpData);

      // Success - redirect to dashboard/onboarding
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/dashboard');
      }
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
        <h1 style={styles.title}>Create Your Company</h1>
        <p style={styles.subtitle}>
          Start your free account and set up your company
        </p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={step === 'info' ? handleNextStep : handleCreateCompany}>
          {/* Step 1: Company Information */}
          {step === 'info' && (
            <div style={styles.formSection}>
              <h2 style={styles.stepTitle}>Step 1: Company Information</h2>

              <div style={styles.formGroup}>
                <label style={styles.label}>Company Name</label>
                <input
                  type="text"
                  name="companyName"
                  placeholder="e.g., Acme Corp"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  style={styles.input}
                  required
                />
                <p style={styles.helperText}>
                  This is your company name that will appear throughout the platform
                </p>
              </div>

              <button type="submit" style={styles.button} disabled={isLoading}>
                Continue
              </button>

              <p style={styles.footerText}>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  style={styles.linkButton}
                >
                  Sign in
                </button>
              </p>
            </div>
          )}

          {/* Step 2: Account Information */}
          {step === 'account' && (
            <div style={styles.formSection}>
              <h2 style={styles.stepTitle}>Step 2: Your Account</h2>

              <div style={styles.companyNameDisplay}>
                Creating company: <strong>{formData.companyName}</strong>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Your Full Name</label>
                <input
                  type="text"
                  name="displayName"
                  placeholder="e.g., John Doe"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Email Address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="your.email@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  style={styles.input}
                  required
                />
                <p style={styles.helperText}>
                  You'll use this email to log in
                </p>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Password</label>
                <input
                  type="password"
                  name="password"
                  placeholder="Min 8 characters"
                  value={formData.password}
                  onChange={handleInputChange}
                  style={styles.input}
                  required
                />
                <p style={styles.helperText}>
                  Must include uppercase, lowercase, and numbers
                </p>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  style={styles.input}
                  required
                />
              </div>

              <button
                type="submit"
                style={styles.button}
                disabled={isLoading}
              >
                {isLoading ? 'Creating Company...' : 'Create Company'}
              </button>

              <button
                type="button"
                onClick={handleBackStep}
                style={styles.secondaryButton}
                disabled={isLoading}
              >
                Back
              </button>

              <p style={styles.termsText}>
                By creating an account, you agree to our{' '}
                <a href="/terms" style={styles.link}>
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" style={styles.link}>
                  Privacy Policy
                </a>
              </p>
            </div>
          )}
        </form>

        <div style={styles.benefits}>
          <h3 style={styles.benefitsTitle}>Why choose us?</h3>
          <ul style={styles.benefitsList}>
            <li>✓ Free to start - no credit card required</li>
            <li>✓ Enterprise-grade security</li>
            <li>✓ Invite team members to collaborate</li>
            <li>✓ Scale as your business grows</li>
            <li>✓ 24/7 customer support</li>
          </ul>
        </div>
      </div>
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
  },

  card: {
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    padding: '40px',
    maxWidth: '500px',
    width: '100%',
  },

  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: '0 0 10px 0',
    textAlign: 'center' as const,
  },

  subtitle: {
    fontSize: '14px',
    color: '#666',
    textAlign: 'center' as const,
    marginBottom: '30px',
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

  formSection: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
  },

  stepTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '20px',
    marginTop: '0',
  },

  companyNameDisplay: {
    background: '#f5f7ff',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '20px',
    fontSize: '14px',
    color: '#333',
    borderLeft: '4px solid #667eea',
  },

  formGroup: {
    marginBottom: '20px',
    display: 'flex' as const,
    flexDirection: 'column' as const,
  },

  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '8px',
  },

  input: {
    padding: '12px 16px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box' as const,
  },

  helperText: {
    fontSize: '12px',
    color: '#666',
    margin: '6px 0 0 0',
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
    marginTop: '10px',
  },

  secondaryButton: {
    padding: '12px 20px',
    background: 'transparent',
    color: '#667eea',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
    marginTop: '10px',
  },

  footerText: {
    fontSize: '14px',
    color: '#666',
    textAlign: 'center' as const,
    marginTop: '20px',
  },

  linkButton: {
    background: 'none',
    border: 'none',
    color: '#667eea',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    textDecoration: 'underline',
    padding: '0',
  },

  termsText: {
    fontSize: '12px',
    color: '#666',
    textAlign: 'center' as const,
    marginTop: '20px',
    lineHeight: '1.6',
  },

  link: {
    color: '#667eea',
    textDecoration: 'none',
  },

  benefits: {
    marginTop: '40px',
    paddingTop: '30px',
    borderTop: '1px solid #eee',
  },

  benefitsTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '12px',
    margin: '0 0 12px 0',
  },

  benefitsList: {
    listStyle: 'none',
    padding: '0',
    margin: '0',
    fontSize: '13px',
    color: '#666',
    lineHeight: '1.8',
  },
};
