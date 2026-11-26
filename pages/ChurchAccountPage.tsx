import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './ChurchPages.css';
import { loginChurch, registerChurch, setChurchToken } from '../services/churchService';

const ChurchAccountPage: React.FC<{ mode: 'signup' | 'signin' }> = ({ mode }) => {
  const navigate = useNavigate();
  const signup = mode === 'signup';
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = signup
        ? await registerChurch({ name, contactName, email, password, city })
        : await loginChurch(email, password);
      setChurchToken(result.token);
      navigate('/church');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="church-screen">
      <div className="church-screen-bg" />
      <div className="church-wrap">
        <Link className="church-link" to="/">Back</Link>
        <h1 className="church-sign">{signup ? 'Church plan' : 'Church sign in'}</h1>
        <form className="church-card" onSubmit={submit}>
          <p className="church-note">
            This sign-in is for a church. It is separate from a family sign-in.
          </p>
          <div className="church-plan">
            <strong>$1,000</strong>
            <span>per year for 50 family seats. One church, one code. No card on this page.</span>
          </div>
          {signup && (
            <>
              <label className="church-label" htmlFor="church-name">Church name</label>
              <input id="church-name" className="church-input" value={name} onChange={(e) => setName(e.target.value)} required />
              <label className="church-label" htmlFor="church-contact">Your name</label>
              <input id="church-contact" className="church-input" value={contactName} onChange={(e) => setContactName(e.target.value)} required />
              <label className="church-label" htmlFor="church-city">City</label>
              <input id="church-city" className="church-input" value={city} onChange={(e) => setCity(e.target.value)} required />
            </>
          )}
          <label className="church-label" htmlFor="church-email">Email</label>
          <input id="church-email" className="church-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="church-label" htmlFor="church-password">Password</label>
          <input id="church-password" className="church-input" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="church-error" role="alert">{error}</p>}
          <div className="church-actions">
            <button className="church-button" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : signup ? 'Create church' : 'Sign in'}
            </button>
            {signup
              ? <Link className="church-link" to="/church/sign-in">Already have a church login</Link>
              : <Link className="church-link" to="/church/sign-up">Create a church</Link>}
          </div>
        </form>
      </div>
    </div>
  );
};

export const ChurchSignUpPage = () => <ChurchAccountPage mode="signup" />;
export const ChurchSignInPage = () => <ChurchAccountPage mode="signin" />;
