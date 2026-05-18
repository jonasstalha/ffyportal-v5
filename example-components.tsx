/**
 * Example React Components for Multi-Tenant Architecture
 * These are starter templates - customize for your UI framework
 */

import React, { useState } from 'react';
import {
  signUpNewCompany,
  signUpWithInvitation,
  loginUser,
  logoutUser,
} from '../auth-service';
import { useCompany, useCurrentUser, useIsAdmin } from '../company-context';
import {
  canAddMoreUsers,
  getFeatureAvailability,
} from '../permission-system';
import {
  sendCompanyInvitation,
  removeUserFromCompany,
} from '../cloud-functions-multi-tenant';

// ============================================================================
// SIGN UP FORM - NEW COMPANY
// ============================================================================

export interface SignUpFormProps {
  onSuccess?: () => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await signUpNewCompany({
        email,
        password,
        displayName,
        companyName,
      });

      // Success - redirect to dashboard
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign up failed';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2>Create Your Company</h2>

      {error && <div style={styles.error}>{error}</div>}

      <input
        type="text"
        placeholder="Company Name"
        value={companyName}
        onChange={e => setCompanyName(e.target.value)}
        required
        style={styles.input}
      />

      <input
        type="text"
        placeholder="Your Name"
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        required
        style={styles.input}
      />

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        style={styles.input}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
        style={styles.input}
      />

      <button
        type="submit"
        disabled={isLoading}
        style={styles.button}
      >
        {isLoading ? 'Creating...' : 'Create Account'}
      </button>

      <p style={styles.helperText}>
        By signing up, you create a new company on our platform
      </p>
    </form>
  );
};

// ============================================================================
// SIGN UP - JOIN COMPANY VIA INVITATION
// ============================================================================

export interface JoinCompanyFormProps {
  inviteCode: string;
  onSuccess?: () => void;
}

export const JoinCompanyForm: React.FC<JoinCompanyFormProps> = ({
  inviteCode,
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await signUpWithInvitation({
        email,
        password,
        displayName,
        inviteCode,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join company';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2>Join Company</h2>

      {error && <div style={styles.error}>{error}</div>}

      <input
        type="text"
        placeholder="Your Name"
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        required
        style={styles.input}
      />

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        style={styles.input}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
        style={styles.input}
      />

      <button type="submit" disabled={isLoading} style={styles.button}>
        {isLoading ? 'Joining...' : 'Join Company'}
      </button>
    </form>
  );
};

// ============================================================================
// USER MANAGEMENT COMPONENT (ADMIN ONLY)
// ============================================================================

export interface UserManagementProps {
  users: any[];
  onRefresh?: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  onRefresh,
}) => {
  const { currentCompanyId, currentCompany } = useCompany();
  const isAdmin = useIsAdmin();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'employee'>('employee');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isAdmin) {
    return <div style={styles.error}>You don't have permission to manage users</div>;
  }

  const canAddUser = canAddMoreUsers(
    users.length,
    currentCompany?.metadata?.maxUsers,
    currentCompany?.subscriptionPlan || 'free'
  );

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canAddUser) {
      setError('User limit reached for your plan');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // In a real app, this would call Cloud Function
      // For now, just show success message
      setSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('employee');

      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send invitation';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to remove this user?')) {
      return;
    }

    try {
      // Call remove user function
      // await removeUserFromCompany(currentCompanyId, userId);
      alert('User removed successfully');

      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      alert('Failed to remove user');
    }
  };

  const features = getFeatureAvailability(currentCompany?.subscriptionPlan || 'free');

  return (
    <div style={styles.container}>
      <h3>Team Members ({users.length})</h3>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {/* Invite Form */}
      {canAddUser && (
        <form onSubmit={handleSendInvitation} style={styles.form}>
          <h4>Invite Team Member</h4>

          <input
            type="email"
            placeholder="Email address"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            required
            style={styles.input}
          />

          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value as any)}
            style={styles.input}
          >
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            {/* Only show admin option if plan supports it */}
            {features.dedicatedSupport && <option value="admin">Admin</option>}
          </select>

          <button type="submit" disabled={isLoading} style={styles.button}>
            {isLoading ? 'Sending...' : 'Send Invitation'}
          </button>
        </form>
      )}

      {!canAddUser && (
        <div style={styles.warning}>
          User limit reached for your plan. Upgrade to add more users.
        </div>
      )}

      {/* Users List */}
      <div style={styles.usersList}>
        {users.map(user => (
          <div key={user.id} style={styles.userCard}>
            <div>
              <strong>{user.displayName}</strong>
              <br />
              <small>{user.email}</small>
              <br />
              <span style={styles.role}>{user.role}</span>
            </div>

            <button
              onClick={() => handleRemoveUser(user.id)}
              style={styles.removeButton}
              disabled={user.id === currentCompany?.ownerId}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// COMPANY SETTINGS COMPONENT
// ============================================================================

export const CompanySettings: React.FC = () => {
  const { currentCompany } = useCompany();
  const features = getFeatureAvailability(currentCompany?.subscriptionPlan || 'free');

  if (!currentCompany) {
    return <div>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      <h2>Company Settings</h2>

      <div style={styles.section}>
        <h3>{currentCompany.name}</h3>
        <p>Plan: <strong>{currentCompany.subscriptionPlan}</strong></p>
        <p>Status: <strong>{currentCompany.status}</strong></p>
      </div>

      <div style={styles.section}>
        <h3>Features Available</h3>
        <ul>
          {Object.entries(features).map(([feature, available]) => (
            <li key={feature}>
              <span>{feature}: </span>
              <strong style={{ color: available ? 'green' : 'red' }}>
                {available ? '✓' : '✗'}
              </strong>
            </li>
          ))}
        </ul>
      </div>

      <div style={styles.section}>
        <h3>Billing</h3>
        <button style={styles.button}>Manage Subscription</button>
      </div>
    </div>
  );
};

// ============================================================================
// LOGOUT COMPONENT
// ============================================================================

export const LogoutButton: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logoutUser();
      // Redirect to login page
      window.location.href = '/login';
    } catch (err) {
      alert('Logout failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      style={styles.button}
    >
      {isLoading ? 'Logging out...' : 'Logout'}
    </button>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  form: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '12px',
    maxWidth: '400px',
  },
  input: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold' as const,
  },
  removeButton: {
    padding: '6px 12px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  error: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '12px',
  },
  success: {
    backgroundColor: '#d4edda',
    color: '#155724',
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '12px',
  },
  warning: {
    backgroundColor: '#fff3cd',
    color: '#856404',
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '12px',
  },
  container: {
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  section: {
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid #ddd',
  },
  usersList: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '12px',
    marginTop: '20px',
  },
  userCard: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    display: 'flex' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  role: {
    display: 'inline-block',
    padding: '4px 8px',
    backgroundColor: '#e9ecef',
    borderRadius: '3px',
    fontSize: '12px',
    marginTop: '4px',
  },
  helperText: {
    fontSize: '12px',
    color: '#666',
    marginTop: '12px',
  },
};
