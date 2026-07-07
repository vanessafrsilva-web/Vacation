import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import {
  IconArrowLeft, IconSun, IconSalad, IconMoon, IconChevronDown, IconTrash, IconUsers
} from '@tabler/icons-react';

const TYPES_REPAS = [
  { id: 'petitdej', label: 'Petit-déjeuner', icon: <IconSun size={16} />, color: '#F59E0B', bg: '#FBF3E3' },
  { id: 'dejeuner', label: 'Déjeuner', icon: <IconSalad size={16} />, color: '#10B981', bg: '#ECFDF5' },
  { id: 'diner', label: 'Dîner', icon: <IconMoon size={16} />, color: '#6E8AA6', bg: '#EEF2F0' }
];

// Génère la liste des dates du voyage (inclusif), au format YYYY-MM-DD
const genererJours = (debut, fin) => {
  if (!debut || !fin) return [];
  const jours = [];
  let curseur = new Date(debut);
  const derniere = new Date(fin);
  while (curseur <= derniere) {
    jours.push(curseur.toISOString().slice(0, 10));
    curseur.setDate(curseur.getDate() + 1);
  }
  return jours;
};

export function Repas({ voyage, setActiveTab }) {
  const [repas, setRepas] = useState([]);
  const [editionActive, setEditionActive] = useState(null); // { date, type } ou null
  const [menuSaisi, setMenuSaisi] = useState('');
  const [responsableSaisi, setResponsableSaisi] = useState('');

  const voyageurs = voyage?.voyageurs || [];
  const jours = genererJours(voyage?.dateDebut, voyage?.dateFin);

  useEffect(() => {
    if (!voyage?.id) return;
    const q = query(collection(db, 'repas'), where('voyageId', '==', voyage.id));
    return onSnapshot(q, (snap) => {
      setRepas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [voyage?.id]);

  if (!voyage) return null;

  const trouverRepas = (date, type) => repas.find((r) => r.date === date && r.type === type);
  const nomResponsable = (id) => voyageurs.find((v) => v.id === id)?.nom;
  const avatarResponsable = (id) => voyageurs.find((v) => v.id === id)?.avatar;

  const ouvrirEdition = (date, type) => {
    const existant = trouverRepas(date, type);
    setMenuSaisi(existant?.menu || '');
    setResponsableSaisi(existant?.responsable || '');
    setEditionActive({ date, type });
  };

  const fermerEdition = () => {
    setEditionActive(null);
    setMenuSaisi('');
    setResponsableSaisi('');
  };

  const enregistrerRepas = async () => {
    if (!editionActive) return;
    const { date, type } = editionActive;
    const existant = trouverRepas(date, type);

    if (!menuSaisi.trim() && !responsableSaisi) {
      if (existant) await deleteDoc(doc(db, 'repas', existant.id));
      fermerEdition();
      return;
    }

    const payload = {
      voyageId: voyage.id,
      date, type,
      menu: menuSaisi.trim(),
      responsable: responsableSaisi || null
    };

    if (existant) {
      await updateDoc(doc(db, 'repas', existant.id), payload);
    } else {
      await addDoc(collection(db, 'repas'), payload);
    }
    fermerEdition();
  };

  const supprimerRepas = async () => {
    if (!editionActive) return;
    const existant = trouverRepas(editionActive.date, editionActive.type);
    if (existant) await deleteDoc(doc(db, 'repas', existant.id));
    fermerEdition();
  };

  return (
    <div style={{ padding: '15px 15px 30px 15px', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab && setActiveTab('gestion')}
          style={{ border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <IconArrowLeft size={18} color="#2B2420" />
        </button>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>Menus & repas</h2>
      </div>

      {jours.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px dashed #E8DFCF' }}>
          <p style={{ color: '#8A7B68', fontSize: '13.5px', margin: 0 }}>
            Ajoute les dates de départ et de retour à ce voyage pour planifier les repas jour par jour.
          </p>
        </div>
      ) : (
        jours.map((jour) => (
          <div key={jour} style={{ marginBottom: '18px' }}>
            <h4 style={{ margin: '0 0 8px 4px', fontSize: '13px', fontWeight: '800', color: '#8A7B68', textTransform: 'capitalize' }}>
              {new Date(jour).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h4>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px solid #E8DFCF', overflow: 'hidden' }}>
              {TYPES_REPAS.map((t, i) => {
                const r = trouverRepas(jour, t.id);
                const enEdition = editionActive?.date === jour && editionActive?.type === t.id;
                return (
                  <div key={t.id} style={{ borderBottom: i < TYPES_REPAS.length - 1 ? '1px solid #F1E8D8' : 'none' }}>
                    <div
                      onClick={() => (enEdition ? fermerEdition() : ouvrirEdition(jour, t.id))}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px', cursor: 'pointer' }}
                    >
                      <div style={{ backgroundColor: t.bg, color: t.color, padding: '8px', borderRadius: '10px', flexShrink: 0 }}>{t.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: t.color, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{t.label}</div>
                        {r?.menu ? (
                          <div style={{ fontSize: '14px', color: '#2B2420', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.menu}</div>
                        ) : (
                          <div style={{ fontSize: '13px', color: '#B5A793', fontStyle: 'italic' }}>Pas encore prévu</div>
                        )}
                      </div>
                      {r?.responsable && nomResponsable(r.responsable) && (
                        <div
                          title={nomResponsable(r.responsable)}
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                            backgroundColor: avatarResponsable(r.responsable) ? '#F1E8D8' : '#2B2420',
                            color: avatarResponsable(r.responsable) ? undefined : '#FFF',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: avatarResponsable(r.responsable) ? '15px' : '10px', fontWeight: '800'
                          }}
                        >
                          {avatarResponsable(r.responsable) || nomResponsable(r.responsable).slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <IconChevronDown size={16} color="#D9CDB8" style={{ transform: enEdition ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                    </div>

                    {enEdition && (
                      <div style={{ padding: '0 14px 14px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input
                          autoFocus
                          type="text"
                          placeholder="ex: Pâtes bolognaise, salade..."
                          value={menuSaisi}
                          onChange={(e) => setMenuSaisi(e.target.value)}
                          style={{ padding: '11px 12px', borderRadius: '10px', border: '1px solid #E8DFCF', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                        />

                        {voyageurs.length > 0 && (
                          <div>
                            <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <IconUsers size={12} /> Qui s'en occupe ?
                            </p>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {voyageurs.map((v) => (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => setResponsableSaisi(responsableSaisi === v.id ? '' : v.id)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 11px', borderRadius: '999px',
                                    fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
                                    border: responsableSaisi === v.id ? '2px solid #B8863C' : '2px solid transparent',
                                    backgroundColor: responsableSaisi === v.id ? '#FBF3E3' : '#F7F1E8',
                                    color: responsableSaisi === v.id ? '#B8863C' : '#64748B'
                                  }}
                                >
                                  {v.avatar || ''} {v.nom}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          {r && (
                            <button
                              type="button"
                              onClick={supprimerRepas}
                              style={{ border: 'none', backgroundColor: '#F8EFF2', color: '#B3453A', borderRadius: '10px', padding: '10px 14px', fontWeight: '700', fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                              <IconTrash size={13} /> Retirer
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={enregistrerRepas}
                            style={{ flex: 1, border: 'none', backgroundColor: '#2B2420', color: '#FFF', borderRadius: '10px', padding: '10px 14px', fontWeight: '800', fontSize: '12.5px', cursor: 'pointer' }}
                          >
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
