import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc,
  arrayUnion, arrayRemove, setDoc, getDoc, serverTimestamp
} from 'firebase/firestore';
import {
  IconArrowLeft, IconPlus, IconTrash, IconToolsKitchen2, IconUsers, IconX,
  IconSearch, IconStar
} from '@tabler/icons-react';

// Petit composant réutilisable : 5 étoiles = une note sur 10 (par pas de 2)
function LigneEtoiles({ label, valeur, onChange }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '13px', fontWeight: '700', color: '#2B2420' }}>{label}</span>
        {valeur > 0 && <span style={{ fontSize: '12px', fontWeight: '800', color: '#B8863C' }}>{valeur}/10</span>}
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {[1, 2, 3, 4, 5].map((etoile) => (
          <span
            key={etoile}
            onClick={() => onChange(valeur === etoile * 2 ? 0 : etoile * 2)}
            style={{ cursor: 'pointer', fontSize: '22px', lineHeight: 1, color: etoile * 2 <= valeur ? '#B8863C' : '#E8DFCF' }}
          >
            ★
          </span>
        ))}
      </div>
    </div>
  );
}

export function MesRestos({ utilisateur, monNom, onClose }) {
  const [restos, setRestos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [recherche, setRecherche] = useState('');

  const [nom, setNom] = useState('');
  const [lieu, setLieu] = useState('');
  const [noteNourriture, setNoteNourriture] = useState(0);
  const [noteAmbiance, setNoteAmbiance] = useState(0);
  const [noteService, setNoteService] = useState(0);
  const [commentaire, setCommentaire] = useState('');

  const [partages, setPartages] = useState([]);
  const [showPartage, setShowPartage] = useState(false);
  const [emailPartage, setEmailPartage] = useState('');

  const monEmail = utilisateur?.email;

  // Chargement du carnet resto : mes entrées + celles partagées avec moi
  useEffect(() => {
    if (!utilisateur?.uid) return;
    const propres = new Map();
    const partagees = new Map();

    const publier = () => {
      const fusion = new Map([...propres, ...partagees]);
      setRestos(Array.from(fusion.values()).sort((a, b) => (b.moyenne || 0) - (a.moyenne || 0)));
    };

    const qProprio = query(collection(db, 'restos'), where('proprietaireId', '==', utilisateur.uid));
    const unsub1 = onSnapshot(qProprio, (snap) => {
      propres.clear();
      snap.forEach((d) => propres.set(d.id, { id: d.id, ...d.data() }));
      publier();
    });

    let unsub2 = () => {};
    if (monEmail) {
      const qPartage = query(collection(db, 'restos'), where('emailsAutorises', 'array-contains', monEmail));
      unsub2 = onSnapshot(qPartage, (snap) => {
        partagees.clear();
        snap.forEach((d) => partagees.set(d.id, { id: d.id, ...d.data() }));
        publier();
      });
    }

    return () => { unsub1(); unsub2(); };
  }, [utilisateur?.uid, monEmail]);

  // Chargement des personnes avec qui on partage automatiquement ce carnet
  useEffect(() => {
    if (!utilisateur?.uid) return;
    getDoc(doc(db, 'parametres', utilisateur.uid)).then((snap) => {
      if (snap.exists()) setPartages(snap.data().partageRestosAvec || []);
    });
  }, [utilisateur?.uid]);

  const ajouterPartage = async () => {
    const email = emailPartage.trim().toLowerCase();
    if (!email) return;
    await setDoc(doc(db, 'parametres', utilisateur.uid), { partageRestosAvec: arrayUnion(email) }, { merge: true });
    setPartages((prev) => [...new Set([...prev, email])]);
    setEmailPartage('');
  };

  const retirerPartage = async (email) => {
    await setDoc(doc(db, 'parametres', utilisateur.uid), { partageRestosAvec: arrayRemove(email) }, { merge: true });
    setPartages((prev) => prev.filter((e) => e !== email));
  };

  const resetForm = () => {
    setNom(''); setLieu(''); setNoteNourriture(0); setNoteAmbiance(0); setNoteService(0); setCommentaire('');
    setShowForm(false);
  };

  const ajouterResto = async (e) => {
    e.preventDefault();
    if (!nom.trim()) return;
    const notes = [noteNourriture, noteAmbiance, noteService].filter((n) => n > 0);
    const moyenne = notes.length > 0 ? notes.reduce((a, b) => a + b, 0) / notes.length : 0;

    try {
      await addDoc(collection(db, 'restos'), {
        nom: nom.trim(),
        lieu: lieu.trim() || null,
        noteNourriture, noteAmbiance, noteService,
        moyenne,
        commentaire: commentaire.trim() || null,
        proprietaireId: utilisateur.uid,
        ajouteParNom: monNom,
        emailsAutorises: [monEmail, ...partages].filter(Boolean),
        createdAt: serverTimestamp()
      });
      resetForm();
    } catch (error) {
      console.error("Erreur d'ajout :", error);
    }
  };

  const supprimerResto = async (id) => {
    if (window.confirm('Supprimer ce resto de ton carnet ?')) {
      await deleteDoc(doc(db, 'restos', id));
    }
  };

  const restosFiltres = restos.filter((r) => {
    const texte = `${r.nom} ${r.lieu || ''}`.toLowerCase();
    return texte.includes(recherche.toLowerCase());
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F1E8', fontFamily: 'inherit', paddingBottom: '30px' }}>
      <div style={{ padding: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <button onClick={onClose} style={{ border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IconArrowLeft size={18} color="#2B2420" />
          </button>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif", flex: 1 }}>Mes Restos</h2>
          <button
            onClick={() => setShowPartage(!showPartage)}
            title="Partager mon carnet"
            style={{ border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <IconUsers size={18} color="#2B2420" />
          </button>
        </div>

        {showPartage && (
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E8DFCF', padding: '16px', marginBottom: '18px' }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '800', color: '#2B2420' }}>Partagé automatiquement avec</p>
            {partages.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {partages.map((email) => (
                  <div key={email} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', backgroundColor: '#F7F1E8', borderRadius: '10px' }}>
                    <span style={{ flex: 1, fontSize: '13px', color: '#2B2420' }}>{email}</span>
                    <button onClick={() => retirerPartage(email)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '2px' }}><IconX size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="email"
                placeholder="email@exemple.com"
                value={emailPartage}
                onChange={(e) => setEmailPartage(e.target.value)}
                style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: '10px', border: '1px solid #E8DFCF', fontSize: '13px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <button onClick={ajouterPartage} style={{ flexShrink: 0, width: '38px', border: 'none', backgroundColor: '#2B2420', color: '#FFF', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconPlus size={16} />
              </button>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#8A7B68' }}>
              S'applique aux nouveaux restos ajoutés à partir de maintenant.
            </p>
          </div>
        )}

        {!showForm && (
          <>
            <div style={{ position: 'relative', marginBottom: '14px' }}>
              <IconSearch size={16} color="#B5A793" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Chercher un resto ou une ville..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                style={{ width: '100%', padding: '12px 12px 12px 38px', borderRadius: '14px', border: '1px solid #E8DFCF', fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <button
              onClick={() => setShowForm(true)}
              style={{ width: '100%', padding: '14px', backgroundColor: '#B8863C', color: '#FFF', border: 'none', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', fontSize: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '18px' }}
            >
              <IconPlus size={18} /> Ajouter un resto
            </button>
          </>
        )}

        {showForm && (
          <form onSubmit={ajouterResto} style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px solid #E8DFCF', padding: '18px', marginBottom: '18px' }}>
            <input
              type="text" placeholder="Nom du resto" value={nom} onChange={(e) => setNom(e.target.value)}
              style={{ width: '100%', padding: '13px', borderRadius: '12px', border: '1px solid #E8DFCF', fontSize: '15px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '10px' }}
              required autoFocus
            />
            <input
              type="text" placeholder="Ville / pays (optionnel)" value={lieu} onChange={(e) => setLieu(e.target.value)}
              style={{ width: '100%', padding: '13px', borderRadius: '12px', border: '1px solid #E8DFCF', fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '16px' }}
            />

            <LigneEtoiles label="🍽️ Nourriture" valeur={noteNourriture} onChange={setNoteNourriture} />
            <LigneEtoiles label="✨ Ambiance" valeur={noteAmbiance} onChange={setNoteAmbiance} />
            <LigneEtoiles label="🙋 Service" valeur={noteService} onChange={setNoteService} />

            <textarea
              placeholder="Petit mot (le plat à refaire, une anecdote...)"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginTop: '4px', marginBottom: '16px', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={resetForm} style={{ flex: 1, padding: '13px', borderRadius: '12px', border: 'none', backgroundColor: '#F7F1E8', color: '#2B2420', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              <button type="submit" style={{ flex: 2, padding: '13px', borderRadius: '12px', border: 'none', backgroundColor: '#2B2420', color: '#FFF', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}>Enregistrer</button>
            </div>
          </form>
        )}

        {!showForm && restosFiltres.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px dashed #E8DFCF' }}>
            <IconToolsKitchen2 size={28} color="#B5A793" style={{ marginBottom: '10px' }} />
            <p style={{ color: '#8A7B68', fontSize: '13.5px', margin: 0 }}>
              {restos.length === 0 ? 'Ton carnet resto est vide — ajoute votre premier restaurant testé !' : 'Aucun résultat pour cette recherche.'}
            </p>
          </div>
        )}

        {!showForm && restosFiltres.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {restosFiltres.map((r) => (
              <div key={r.id} style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E8DFCF', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '15.5px', fontWeight: '800', color: '#2B2420' }}>{r.nom}</p>
                    {r.lieu && <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#8A7B68' }}>{r.lieu}</p>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: '#FBF3E3', padding: '4px 10px', borderRadius: '999px' }}>
                      <IconStar size={13} color="#B8863C" fill="#B8863C" />
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#B8863C' }}>{r.moyenne?.toFixed(1) || '—'}</span>
                    </div>
                    <button onClick={() => supprimerResto(r.id)} style={{ border: 'none', background: 'none', color: '#D9CDB8', cursor: 'pointer', padding: '2px' }}>
                      <IconTrash size={15} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '14px', marginTop: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#8A7B68' }}>🍽️ {r.noteNourriture || 0}/10</span>
                  <span style={{ fontSize: '11px', color: '#8A7B68' }}>✨ {r.noteAmbiance || 0}/10</span>
                  <span style={{ fontSize: '11px', color: '#8A7B68' }}>🙋 {r.noteService || 0}/10</span>
                </div>

                {r.commentaire && (
                  <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#2B2420', backgroundColor: '#F7F1E8', padding: '8px 10px', borderRadius: '10px', lineHeight: '1.5' }}>
                    {r.commentaire}
                  </p>
                )}
                <p style={{ margin: '8px 0 0 0', fontSize: '10.5px', color: '#D9CDB8' }}>Ajouté par {r.ajouteParNom}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
