import React, { useState } from 'react';
import { auth } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { IconMail, IconLock, IconUser, IconArrowLeft } from '@tabler/icons-react';

// Traduit les codes d'erreur Firebase en messages compréhensibles
const messageErreur = (code) => {
  switch (code) {
    case 'auth/invalid-email': return "Cette adresse email n'est pas valide.";
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password': return "Email ou mot de passe incorrect.";
    case 'auth/email-already-in-use': return "Un compte existe déjà avec cet email.";
    case 'auth/weak-password': return "Le mot de passe doit contenir au moins 6 caractères.";
    case 'auth/too-many-requests': return "Trop de tentatives, réessayez dans quelques minutes.";
    default: return "Une erreur est survenue, réessayez.";
  }
};

export function Auth() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'reset'
  const [nomComplet, setNomComplet] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const [emailEnvoye, setEmailEnvoye] = useState(false);

  const inputStyle = {
    width: '100%', padding: '14px 14px 14px 42px', borderRadius: '14px',
    border: '1px solid #E8DFCF', backgroundColor: '#F7F1E8', color: '#2B2420',
    fontSize: '15px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
  };

  const champIcone = { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#B5A793' };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErreur(''); setChargement(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), motDePasse);
    } catch (error) {
      setErreur(messageErreur(error.code));
    } finally {
      setChargement(false);
    }
  };

  const AVATARS_PAR_DEFAUT = ['🦊', '🐼', '🐨', '🦁', '🐯', '🐸', '🐢', '🦉', '🐝', '🦄', '🐙', '🦋', '🐧', '🦖', '🐺', '🦜'];

  const handleSignup = async (e) => {
    e.preventDefault();
    setErreur('');

    if (!nomComplet.trim()) { setErreur('Indiquez votre prénom et nom.'); return; }
    if (motDePasse.length < 6) { setErreur('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (motDePasse !== confirmation) { setErreur('Les mots de passe ne correspondent pas.'); return; }

    setChargement(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), motDePasse);
      const avatarAleatoire = AVATARS_PAR_DEFAUT[Math.floor(Math.random() * AVATARS_PAR_DEFAUT.length)];
      await updateProfile(cred.user, { displayName: nomComplet.trim(), photoURL: avatarAleatoire });
    } catch (error) {
      setErreur(messageErreur(error.code));
    } finally {
      setChargement(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setErreur(''); setChargement(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setEmailEnvoye(true);
    } catch (error) {
      setErreur(messageErreur(error.code));
    } finally {
      setChargement(false);
    }
  };

  const changerMode = (nouveauMode) => {
    setMode(nouveauMode);
    setErreur('');
    setEmailEnvoye(false);
    setMotDePasse('');
    setConfirmation('');
  };

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#F7F1E8', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&display=swap');`}</style>

      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>LES NOMADES</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#B8863C', fontWeight: '700', letterSpacing: '1px' }}>by Vanessa</p>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '22px', padding: '28px', border: '1px solid #E8DFCF', boxShadow: '0 10px 30px rgba(43,36,32,0.06)' }}>

          {mode === 'reset' ? (
            <>
              <button type="button" onClick={() => changerMode('login')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#8A7B68', fontSize: '13px', fontWeight: '700', cursor: 'pointer', padding: 0, marginBottom: '16px', fontFamily: 'inherit' }}>
                <IconArrowLeft size={15} /> Retour à la connexion
              </button>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '19px', fontWeight: '800', color: '#2B2420' }}>Mot de passe oublié</h3>
              <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: '#8A7B68', lineHeight: '1.5' }}>Entrez votre email, on vous envoie un lien de réinitialisation.</p>

              {emailEnvoye ? (
                <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(184,134,60,0.1)', color: '#2B2420', fontSize: '13.5px', textAlign: 'center' }}>
                  ✅ Email envoyé à <strong>{email}</strong>. Vérifiez votre boîte de réception (et vos spams).
                </div>
              ) : (
                <form onSubmit={handleReset}>
                  <div style={{ position: 'relative', marginBottom: '14px' }}>
                    <IconMail size={18} style={champIcone} />
                    <input type="email" placeholder="Votre email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} required />
                  </div>
                  {erreur && <p style={{ color: '#B3453A', fontSize: '13px', margin: '0 0 14px 0' }}>{erreur}</p>}
                  <button type="submit" disabled={chargement} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#B8863C', color: '#FFF', fontWeight: '800', fontSize: '14px', cursor: chargement ? 'default' : 'pointer', opacity: chargement ? 0.7 : 1, fontFamily: 'inherit' }}>
                    {chargement ? 'Envoi...' : 'Envoyer le lien'}
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', backgroundColor: '#F7F1E8', padding: '4px', borderRadius: '14px', marginBottom: '22px' }}>
                <button type="button" onClick={() => changerMode('login')} style={{ flex: 1, border: 'none', background: mode === 'login' ? '#FFFFFF' : 'transparent', color: '#2B2420', padding: '10px', borderRadius: '11px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', boxShadow: mode === 'login' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none' }}>
                  Connexion
                </button>
                <button type="button" onClick={() => changerMode('signup')} style={{ flex: 1, border: 'none', background: mode === 'signup' ? '#FFFFFF' : 'transparent', color: '#2B2420', padding: '10px', borderRadius: '11px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', boxShadow: mode === 'signup' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none' }}>
                  Créer un compte
                </button>
              </div>

              <form onSubmit={mode === 'login' ? handleLogin : handleSignup}>
                {mode === 'signup' && (
                  <div style={{ position: 'relative', marginBottom: '12px' }}>
                    <IconUser size={18} style={champIcone} />
                    <input type="text" placeholder="Prénom et nom" value={nomComplet} onChange={(e) => setNomComplet(e.target.value)} style={inputStyle} required />
                  </div>
                )}

                <div style={{ position: 'relative', marginBottom: '12px' }}>
                  <IconMail size={18} style={champIcone} />
                  <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} required />
                </div>

                <div style={{ position: 'relative', marginBottom: mode === 'signup' ? '12px' : '8px' }}>
                  <IconLock size={18} style={champIcone} />
                  <input type="password" placeholder="Mot de passe" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} style={inputStyle} required />
                </div>

                {mode === 'signup' && (
                  <div style={{ position: 'relative', marginBottom: '8px' }}>
                    <IconLock size={18} style={champIcone} />
                    <input type="password" placeholder="Confirmer le mot de passe" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} style={inputStyle} required />
                  </div>
                )}

                {mode === 'login' && (
                  <div style={{ textAlign: 'right', marginBottom: '14px' }}>
                    <button type="button" onClick={() => changerMode('reset')} style={{ background: 'none', border: 'none', color: '#B8863C', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}

                {erreur && <p style={{ color: '#B3453A', fontSize: '13px', margin: '0 0 14px 0' }}>{erreur}</p>}

                <button type="submit" disabled={chargement} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#2B2420', color: '#FFF', fontWeight: '800', fontSize: '14.5px', cursor: chargement ? 'default' : 'pointer', opacity: chargement ? 0.7 : 1, marginTop: '6px', fontFamily: 'inherit' }}>
                  {chargement ? 'Un instant...' : (mode === 'login' ? 'Se connecter' : 'Créer mon compte')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
