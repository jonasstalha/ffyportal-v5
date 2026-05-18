/**
 * Welcome/Get Started Page
 * Shows options to create a new company or join an existing one
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>Welcome to Fruits For You Portal</h1>
        <p style={styles.description}>
          Manage your company's operations efficiently with our platform
        </p>

        <div style={styles.optionsGrid}>
          {/* Create Company Option */}
          <div
            style={styles.optionCard}
            onClick={() => navigate('/create-company')}
          >
            <div style={styles.optionIcon}>🏢</div>
            <h2 style={styles.optionTitle}>Create Company</h2>
            <p style={styles.optionDescription}>
              Start a new company and become the admin. You'll set up your account, 
              invite team members, and manage your operations from day one.
            </p>
            <button style={styles.optionButton}>
              Get Started →
            </button>
          </div>

          {/* Join Company Option */}
          <div
            style={styles.optionCard}
            onClick={() => navigate('/join-company')}
          >
            <div style={styles.optionIcon}>👥</div>
            <h2 style={styles.optionTitle}>Join Existing Company</h2>
            <p style={styles.optionDescription}>
              Already have an invitation code? Join your company's workspace 
              and start collaborating with your team immediately.
            </p>
            <button style={styles.optionButton}>
              Join Company →
            </button>
          </div>
        </div>

        <div style={styles.signInSection}>
          <p style={styles.signInText}>
            Already have an account?{' '}
            <button
              style={styles.signInLink}
              onClick={() => navigate('/login')}
            >
              Sign in
            </button>
          </p>
        </div>

        {/* Features */}
        <div style={styles.features}>
          <h3 style={styles.featuresTitle}>Why Choose Us?</h3>
          <div style={styles.featuresGrid}>
            <div style={styles.featureItem}>
              <span style={styles.featureIconSmall}>🔒</span>
              <p>Enterprise-grade security</p>
            </div>
            <div style={styles.featureItem}>
              <span style={styles.featureIconSmall}>👤</span>
              <p>Team management & roles</p>
            </div>
            <div style={styles.featureItem}>
              <span style={styles.featureIconSmall}>📊</span>
              <p>Real-time analytics</p>
            </div>
            <div style={styles.featureItem}>
              <span style={styles.featureIconSmall}>⚡</span>
              <p>Fast & reliable</p>
            </div>
          </div>
        </div>
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
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '40px 20px',
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

  content: {
    maxWidth: '1000px',
    margin: '0 auto',
    position: 'relative' as const,
    zIndex: 1,
  },

  title: {
    fontSize: '48px',
    fontWeight: '800',
    color: 'white',
    margin: '0 0 16px 0',
    textAlign: 'center' as const,
    textShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
  },

  description: {
    fontSize: '20px',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center' as const,
    marginBottom: '60px',
    maxWidth: '600px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },

  optionsGrid: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '30px',
    marginBottom: '60px',
  },

  optionCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '40px 30px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'transform 0.3s, box-shadow 0.3s',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
  },

  optionIcon: {
    fontSize: '60px',
    marginBottom: '20px',
  },

  optionTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: '0 0 16px 0',
  },

  optionDescription: {
    fontSize: '15px',
    color: '#666',
    lineHeight: '1.6',
    marginBottom: '24px',
    minHeight: '80px',
  },

  optionButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },

  signInSection: {
    textAlign: 'center' as const,
    marginBottom: '60px',
  },

  signInText: {
    fontSize: '16px',
    color: 'rgba(255, 255, 255, 0.9)',
  },

  signInLink: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '0',
  },

  features: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '16px',
    padding: '40px',
    textAlign: 'center' as const,
  },

  featuresTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: '0 0 40px 0',
  },

  featuresGrid: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '30px',
  },

  featureItem: {
    padding: '20px',
  },

  featureIconSmall: {
    fontSize: '40px',
    display: 'block',
    marginBottom: '12px',
  },

  featureItemText: {
    fontSize: '15px',
    color: '#333',
    fontWeight: '500',
  },
};
