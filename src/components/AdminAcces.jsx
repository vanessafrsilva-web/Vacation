import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { IconPlus, IconTrash } from '@tabler/icons-react';

// ⚠️ Email admin (en minuscules)
export const ADMIN_EMAIL = 'vanessafrsilva@gmail.com';

// Les 4 cartes de l'écran d'accueil
export const MODULES_ACCUEIL = [
  { id: 'voyages', titre: 'Planning Voyages', couleur: '#2B2420', fond: '#F1E8D8' },
  { id: 'restos', titre: 'Papilles Nomades', couleur: '#B8863C', fond: '#FBF3E3' },
  { id: 'perso', titre: 'Perso', couleur: '#4A7C59', fond: '#EAF2EC' },
  { id: 'spots-photo', titre: 'Grand Tour CH', couleur: '#B8863C', fond: '#F1E8D8' }
];

function Puce({ actif, couleur, fond, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '7px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
        border: actif ? `1.5px solid ${couleur}` : '1.5px solid #E8DFCF',
        backgroundColor: actif ? fond : '#FFFFFF',
        color: actif ? couleur : '#B5A793'
      }}
    >
      {actif ? '✓ ' : ''}{children}
    </button>
  );
}

const titreSection = { margin: '0 0 7px 0', fontSize: '11px', color: '#8A7B68', fontWeight: '800' };

export function AdminAcces({ modules }) {
  // "modules" = les modules à l'intérieur de Perso (envoyés par Perso.jsx)
  const [users, setUsers] = useState([]);
  const [nouvelEmail, setNouvelEmail] = useState('');
  const [nouveauxModules, setNouveauxModules] = useState(['voyages', 'perso', 'van', 'accord']);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'acces'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => a.id.localeCompare(b.id));
      setUsers(data);
    });
    return () => unsub();
  }, []);

  const toggleNouveau = (id) => {
    setNouveauxModules((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const ajouterUser = async (e) => {
    e.preventDefault();
    setErreur('');
    const email = nouvelEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setErreur("Entre une adresse email valide.");
      return;
    }
    try {
      await setDoc(doc(db, 'acces', email), {
        email,
        modules: nouveauxModules,
        updatedAt: serverTimestamp()
      });
      setNouvelEmail('');
      setNouveauxModules(['voyages', 'perso', 'van', 'accord']);
    } catch (error) {
      console.error("Erreur d'ajout :", error);
      setErreur("Impossible d'ajouter (vérifie les règles Firestore).");
    }
  };

  const toggleModuleUser = async (user, moduleId) => {
    const actuels = user.modules || [];
    const nouveaux = actuels.includes(moduleId) ? actuels.filter((m) => m !== moduleId) : [...actuels, moduleId];
    try {
      await updateDoc(doc(db, 'acces', user.id), { modules: nouveaux, updatedAt: serverTimestamp() });
    } catch (error) {
      console.error('Erreur de mise à jour :', error);
    }
  };

  const supprimerUser = async (user) => {
    if (!window.confirm(`Retirer tous les accès de ${user.id} ?`)) return;
    try {
      await deleteDoc(doc(db, 'acces', user.id));
    } catch (error) {
      console.error('Erreur de suppression :', error);
    }
  };

  const inputStyle = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', color: '#2B2420', fontSize: '15px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

  return (
    <div>
      <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: '#8A7B68', lineHeight: '1.5' }}>
        Ajoute une personne avec son adresse email et choisis ce qu'elle peut voir. Elle doit se connecter avec cette même adresse. Toi (admin), tu vois toujours tout.
      </p>

      <form onSubmit={ajouterUser} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '18px', padding: '16px', marginBottom: '20px' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '14.5px', fontWeight: '800', color: '#2B2420' }}>Nouvelle personne</p>
        <input
          type="email"
          placeholder="email@exemple.com"
          value={nouvelEmail}
          onChange={(e) => setNouvelEmail(e.target.value)}
          style={{ ...inputStyle, marginBottom: '12px' }}
        />

        <p style={titreSection}>ÉCRAN D'ACCUEIL</p>
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {MODULES_ACCUEIL.map((m) => (
            <Puce key={m.id} actif={nouveauxModules.includes(m.id)} couleur={m.couleur} fond={m.fond} onClick={() => toggleNouveau(m.id)}>
              {m.titre}
            </Puce>
          ))}
        </div>

        <p style={titreSection}>DANS PERSO</p>
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {modules.map((m) => (
            <Puce key={m.id} actif={nouveauxModules.includes(m.id)} couleur={m.couleur} fond={m.fond} onClick={() => toggleNouveau(m.id)}>
              {m.titre}
            </Puce>
          ))}
        </div>

        {erreur && <p style={{ margin: '0 0 10px 0', fontSize: '12.5px', color: '#B3453A', fontWeight: '700' }}>{erreur}</p>}
        <button type="submit" style={{ width: '100%', padding: '13px', borderRadius: '12px', border: 'none', backgroundColor: '#2B2420', color: '#FFF', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
          <IconPlus size={16} /> Ajouter
        </button>
      </form>

      <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '800', color: '#8A7B68' }}>PERSONNES AVEC UN ACCÈS</p>

      {users.length === 0 ? (
        <div style={{ padding: '30px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px dashed #E8DFCF', color: '#B5A793', fontSize: '13.5px' }}>
          Personne pour l'instant.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {users.map((u) => (
            <div key={u.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '16px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#2B2420', wordBreak: 'break-all' }}>{u.id}</span>
                <button onClick={() => supprimerUser(u)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '4px', flexShrink: 0 }}>
                  <IconTrash size={16} />
                </button>
              </div>

              <p style={titreSection}>ÉCRAN D'ACCUEIL</p>
              <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {MODULES_ACCUEIL.map((m) => (
                  <Puce key={m.id} actif={(u.modules || []).includes(m.id)} couleur={m.couleur} fond={m.fond} onClick={() => toggleModuleUser(u, m.id)}>
                    {m.titre}
                  </Puce>
                ))}
              </div>

              <p style={titreSection}>DANS PERSO</p>
              <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                {modules.map((m) => (
                  <Puce key={m.id} actif={(u.modules || []).includes(m.id)} couleur={m.couleur} fond={m.fond} onClick={() => toggleModuleUser(u, m.id)}>
                    {m.titre}
                  </Puce>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
