import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

const AuthDebugger: React.FC = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Demo@2024!');
  const [result, setResult] = useState<string>('');

  const testAuth = async () => {
    try {
      console.log('Testing auth with:', { email, password });
      await signIn(email, password);
      setResult('Success!');
    } catch (error) {
      console.error('Auth test failed:', error);
      setResult(`Error: ${error}`);
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px' }}>
      <h3>Auth Debugger</h3>
      <div>
        <label>Email:</label>
        <input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          style={{ margin: '5px', padding: '5px' }}
        />
      </div>
      <div>
        <label>Password:</label>
        <input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)}
          style={{ margin: '5px', padding: '5px' }}
        />
      </div>
      <button onClick={testAuth} style={{ margin: '10px', padding: '5px 10px' }}>
        Test Auth
      </button>
      <div>Result: {result}</div>
    </div>
  );
};

export default AuthDebugger;
