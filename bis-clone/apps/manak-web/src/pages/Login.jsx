import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../api';

export default function Login() {
  const [email, setEmail] = useState('demo@bis-mitra.in');
  const [password, setPassword] = useState('Demo@123');
  const [captcha, setCaptcha] = useState('1234');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await login(email, password, captcha);
      localStorage.setItem('manak_token', data.token);
      navigate('/dashboard');
    } catch {
      setError('Invalid credentials or captcha');
    }
  };

  return (
    <div className="login-page">
      <div className="login-brand">
        <div style={{ width: 80, height: 80, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🔷</div>
        <h2>Bureau of Indian Standards</h2>
        <p>The National Standards Body of India</p>
      </div>
      <div className="login-card">
        <Link to="/dashboard" style={{ float: 'right', fontSize: 12, color: '#003366' }}>Home</Link>
        <h3>Sign In to eBIS</h3>
        {error && <p style={{ color: 'red', marginBottom: 12 }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input data-testid="login-username" type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter Email or Username" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input data-testid="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter Password" />
          </div>
          <div className="form-group">
            <label>Captcha</label>
            <div className="captcha-row">
              <div className="captcha-box" data-testid="captcha-display">1234</div>
              <input data-testid="login-captcha" type="text" value={captcha} onChange={e => setCaptcha(e.target.value)} placeholder="Enter the above text" style={{ flex: 1 }} />
            </div>
          </div>
          <button type="submit" className="login-btn" data-testid="login-submit">Sign in</button>
        </form>
      </div>
    </div>
  );
}
