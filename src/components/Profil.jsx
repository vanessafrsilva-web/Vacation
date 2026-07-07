import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { auth } from '../firebase';
import {
  updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from 'firebase/auth';
import { IconX, IconUser, IconLock } from '@tabler/icons-react';

const messageErreurMdp = (code) => {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return "Mot de passe actuel incorrect.";
    case 'auth/weak-password': return "Le nouveau mot de passe doit contenir au moins 6 caractères.";
    case 'auth/too-many-requests': return "Trop de tentatives, réessayez dans quelques minutes.";
    default: return "Une erreur est survenue, réessayez.";
  }
};

const AVATARS = ['🦊', '🐼', '🐨', '🦁', '🐯', '🐸', '🐢', '🦉', '🐝', '🦄', '🐙', '🦋', '🐧', '🦖', '🐺', '🦜'];

export function Profil({ utilisateur, onClose, onMiseAJour }) {
  const [nom, setNom] = useState(utilisateur?.displayName || '');
  const [nomEnregistre, setNomEnregistre] = useState(false);
  const [avatarActuel, setAvatarActuel] = useState(utilisateur?.photoURL || '');

  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreurMdp, setErreurMdp] = useState('');
  const [mdpEnregistre, setMdpEnregistre] = useState(false);
  const [chargement, setChargement] = useState(false);

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E8DFCF',
    backgroundColor: '#F7F1E8', color: '#2B2420', fontSize: '14px', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit'
  };

  const handleChangerNom = async (e) => {
    e.preventDefault();
    if (!nom.trim()) return;
    try {
      await updateProfile(auth.currentUser, { displayName: nom.trim() });
      onMiseAJour && onMiseAJour();
      setNomEnregistre(true);
      setTimeout(() => setNomEnregistre(false), 2500);
    } catch (error) {
      console.warn("Impossible de mettre à jour le nom.", error);
    }
  };

  const choisirAvatar = async (emoji) => {
    const nouvelAvatar = avatarActuel === emoji ? '' : emoji; // re-cliquer dessus l'enlève
    setAvatarActuel(nouvelAvatar);
    try {
      await updateProfile(auth.currentUser, { photoURL: nouvelAvatar });
      onMiseAJour && onMiseAJour();
    } catch (error) {
      console.warn("Impossible de mettre à jour l'avatar.", error);
    }
  };

  const handleChangerMotDePasse = async (e) => {
    e.preventDefault();
    setErreurMdp('');

    if (nouveauMotDePasse.length < 6) { setErreurMdp('Le nouveau mot de passe doit contenir au moins 6 caractères.'); return; }
    if (nouveauMotDePasse !== confirmation) { setErreurMdp('Les mots de passe ne correspondent pas.'); return; }

    setChargement(true);
    try {
      const credential = EmailAuthProvider.credential(utilisateur.email, motDePasseActuel);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, nouveauMotDePasse);
      setMdpEnregistre(true);
      setMotDePasseActuel(''); setNouveauMotDePasse(''); setConfirmation('');
      setTimeout(() => setMdpEnregistre(false), 2500);
    } catch (error) {
      setErreurMdp(messageErreurMdp(error.code));
    } finally {
      setChargement(false);
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(43, 36, 32, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, padding: '20px' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: '#FFFFFF', borderRadius: '22px', padding: '26px', width: '100%', maxWidth: '400px', maxHeight: '85vh', overflowY: 'auto', fontFamily: 'inherit' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>Mon profil</h3>
          <button onClick={onClose} style={{ border: 'none', backgroundColor: '#F1E8D8', color: '#8A7B68', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconX size={16} />
          </button>
        </div>

        <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#8A7B68' }}>Connecté·e avec</p>
        <p style={{ margin: '0 0 20px 0', fontSize: '14px', fontWeight: '700', color: '#2B2420' }}>{utilisateur?.email}</p>

        {/* Nom affiché */}
        <form onSubmit={handleChangerNom} style={{ marginBottom: '26px' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '700', color: '#2B2420', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IconUser size={15} /> Nom affiché
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button type="submit" style={{ border: 'none', backgroundColor: '#2B2420', color: '#FFF', borderRadius: '12px', padding: '0 16px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>OK</button>
          </div>
          {nomEnregistre && <p style={{ margin: '8px 0 0 0', fontSize: '12.5px', color: '#5E8A87', fontWeight: '600' }}>✅ Nom mis à jour</p>}
        </form>

        {/* Avatar */}
        <div style={{ marginBottom: '26px' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '700', color: '#2B2420' }}>
            Avatar <span style={{ fontWeight: '400', color: '#8A7B68' }}>(pratique pour se repérer à plusieurs)</span>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
            {AVATARS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => choisirAvatar(emoji)}
                style={{
                  fontSize: '20px', padding: '8px 0', borderRadius: '12px', cursor: 'pointer',
                  border: avatarActuel === emoji ? '2px solid #B8863C' : '2px solid transparent',
                  backgroundColor: avatarActuel === emoji ? '#FBF3E3' : '#F7F1E8'
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
          {!avatarActuel && (
            <p style={{ margin: '8px 0 0 0', fontSize: '11.5px', color: '#8A7B68' }}>Sans choix, tes initiales seront utilisées comme avant.</p>
          )}
        </div>

        {/* Mot de passe */}
        <form onSubmit={handleChangerMotDePasse}>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '700', color: '#2B2420', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IconLock size={15} /> Changer le mot de passe
          </p>
          <input type="password" placeholder="Mot de passe actuel" value={motDePasseActuel} onChange={(e) => setMotDePasseActuel(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} required />
          <input type="password" placeholder="Nouveau mot de passe" value={nouveauMotDePasse} onChange={(e) => setNouveauMotDePasse(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} required />
          <input type="password" placeholder="Confirmer le nouveau mot de passe" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }} required />

          {erreurMdp && <p style={{ color: '#B3453A', fontSize: '12.5px', margin: '0 0 12px 0' }}>{erreurMdp}</p>}
          {mdpEnregistre && <p style={{ color: '#5E8A87', fontSize: '12.5px', margin: '0 0 12px 0', fontWeight: '600' }}>✅ Mot de passe mis à jour</p>}

          <button type="submit" disabled={chargement} style={{ width: '100%', padding: '13px', borderRadius: '12px', border: 'none', backgroundColor: '#B8863C', color: '#FFF', fontWeight: '800', fontSize: '14px', cursor: chargement ? 'default' : 'pointer', opacity: chargement ? 0.7 : 1, fontFamily: 'inherit' }}>
            {chargement ? 'Un instant...' : 'Mettre à jour le mot de passe'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
