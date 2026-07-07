import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import {
  IconCalendar, IconChecklist, IconReceipt2, IconUsers, IconArrowRight,
  IconPlaneDeparture, IconCamera, IconX, IconTrophy
} from '@tabler/icons-react';

// Même logique de dégradé de secours que sur la liste "Mes Voyages",
// pour rester cohérent visuellement si le voyage n'a pas de photo.
const PALETTES_SECOURS = [
  ['#F59E0B', '#B3453A'], ['#6E8AA6', '#9A6B87'], ['#B8863C', '#5E8A87'],
  ['#B97490', '#F59E0B'], ['#6366F1', '#06B6D4'], ['#14B8A6', '#6366F1']
];
const degradeSecours = (nom) => {
  let h = 0;
  for (let i = 0; i < (nom || '').length; i++) { h = nom.charCodeAt(i) + ((h << 5) - h); h |= 0; }
  const [c1, c2] = PALETTES_SECOURS[Math.abs(h) % PALETTES_SECOURS.length];
  return `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
};

const initiales = (nom) => {
  if (!nom) return '?';
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[1][0]).toUpperCase();
};

export function Gestion({ voyage, setActiveTab }) {
  const [nbActivites, setNbActivites] = useState(0);
  const [checklistStats, setChecklistStats] = useState({ fait: 0, total: 0 });
  const [totalDepenses, setTotalDepenses] = useState(0);
  const [editionPhoto, setEditionPhoto] = useState(false);
  const [urlPhoto, setUrlPhoto] = useState('');

  useEffect(() => {
    if (!voyage?.id) return;

    const unsubActivites = onSnapshot(collection(db, `voyages/${voyage.id}/activites`), (snap) => {
      setNbActivites(snap.size);
    });

    const qChecklist = query(collection(db, 'checklist'), where('voyageId', '==', voyage.id));
    const unsubChecklist = onSnapshot(qChecklist, (snap) => {
      let fait = 0;
      snap.forEach((d) => { if (d.data().fait) fait++; });
      setChecklistStats({ fait, total: snap.size });
    });

    const qBudget = query(collection(db, 'budget'), where('voyageId', '==', voyage.id));
    const unsubBudget = onSnapshot(qBudget, (snap) => {
      let total = 0;
      snap.forEach((d) => { if (!d.data().estRemboursement) total += d.data().montant || 0; });
      setTotalDepenses(total);
    });

    return () => { unsubActivites(); unsubChecklist(); unsubBudget(); };
  }, [voyage?.id]);

  if (!voyage) return null;

  const enregistrerPhoto = async () => {
    if (!urlPhoto.trim()) return;
    try {
      await updateDoc(doc(db, 'voyages', voyage.id), { imageBg: urlPhoto.trim() });
      setEditionPhoto(false);
      setUrlPhoto('');
    } catch (error) {
      console.warn("Impossible de mettre à jour la photo.", error);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' }) : '';

  const aujourdHui = new Date().toISOString().slice(0, 10);
  let statutVoyage = 'à venir';
  if (voyage.dateDebut && voyage.dateFin) {
    if (aujourdHui > voyage.dateFin) statutVoyage = 'terminé';
    else if (aujourdHui >= voyage.dateDebut) statutVoyage = 'en cours';
  }

  const modules = [
    {
      id: 'planning', label: 'Planning', icon: <IconCalendar size={22} />, color: '#6E8AA6', bg: '#EEF2F0',
      sousTitre: nbActivites > 0 ? `${nbActivites} élément${nbActivites > 1 ? 's' : ''}` : 'Rien de prévu'
    },
    {
      id: 'checklist', label: 'Checklist', icon: <IconChecklist size={22} />, color: '#B8863C', bg: '#F1E8D8',
      sousTitre: checklistStats.total > 0 ? `${checklistStats.fait}/${checklistStats.total} fait${checklistStats.fait > 1 ? 's' : ''}` : 'Vide'
    },
    {
      id: 'facturation', label: 'Budget', icon: <IconReceipt2 size={22} />, color: '#F59E0B', bg: '#FBF3E3',
      sousTitre: `${totalDepenses.toFixed(0)} CHF`
    },
    {
      id: 'bilan', label: 'Bilan', icon: <IconTrophy size={22} />, color: '#B97490', bg: '#F8EFF2',
      sousTitre: 'Résumé & notes'
    }
  ];

  return (
    <div style={{ padding: '15px 15px 30px 15px', fontFamily: 'inherit' }}>

      {/* Bannière du voyage */}
      <div style={{
        position: 'relative', height: '180px', borderRadius: '24px', overflow: 'hidden',
        marginBottom: '20px', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
        ...(voyage.imageBg
          ? { backgroundImage: `url('${voyage.imageBg}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: degradeSecours(voyage.nom) })
      }}>
        {!voyage.imageBg && (
          <IconPlaneDeparture size={90} color="rgba(255,255,255,0.18)" style={{ position: 'absolute', top: '15px', right: '10px', transform: 'rotate(25deg)' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(43, 36, 32, 0.85) 0%, rgba(43, 36, 32, 0.15) 55%, transparent 100%)' }}></div>

        <button
          onClick={() => setEditionPhoto(true)}
          style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: 'rgba(43,36,32,0.45)', backdropFilter: 'blur(4px)', border: 'none', color: '#FFFFFF', width: '34px', height: '34px', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          title="Changer la photo"
        >
          <IconCamera size={16} />
        </button>

        <div style={{ position: 'absolute', bottom: '16px', left: '18px', right: '18px' }}>
          <span style={{ backgroundColor: '#FFFFFF', color: '#2B2420', padding: '5px 11px', borderRadius: '10px', fontSize: '11px', fontWeight: '800', display: 'inline-block', marginBottom: '8px' }}>
            {statutVoyage === 'en cours' ? '🟢 En cours' : statutVoyage === 'terminé' ? '✔️ Terminé' : '🗓️ À venir'}
          </span>
          <h2 style={{ margin: 0, color: '#FFFFFF', fontSize: '24px', fontWeight: '700', fontFamily: "'Playfair Display', Georgia, serif" }}>{voyage.nom}</h2>
          {voyage.dateDebut && (
            <p style={{ margin: '4px 0 0 0', color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: '600' }}>
              {formatDate(voyage.dateDebut)} → {formatDate(voyage.dateFin)}
            </p>
          )}
        </div>
      </div>

      {editionPhoto && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <input
            type="url"
            placeholder="Coller le lien d'une photo (ex: depuis Unsplash, Google Images...)"
            value={urlPhoto}
            onChange={(e) => setUrlPhoto(e.target.value)}
            style={{ flex: 1, padding: '11px 12px', borderRadius: '12px', border: '1px solid #E8DFCF', fontSize: '13px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          <button onClick={enregistrerPhoto} style={{ border: 'none', backgroundColor: '#B8863C', color: '#FFF', borderRadius: '12px', padding: '0 16px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>OK</button>
          <button onClick={() => { setEditionPhoto(false); setUrlPhoto(''); }} style={{ border: 'none', backgroundColor: '#F1E8D8', color: '#8A7B68', borderRadius: '12px', width: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={16} /></button>
        </div>
      )}

      {/* Voyageurs */}
      {voyage.voyageurs && voyage.voyageurs.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '12px 16px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E8DFCF' }}>
          <IconUsers size={18} color="#8A7B68" />
          <div style={{ display: 'flex' }}>
            {voyage.voyageurs.slice(0, 5).map((p, i) => (
              <div key={p.id} title={p.nom} style={{
                width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#2B2420', color: '#FFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800',
                border: '2px solid #FFFFFF', marginLeft: i === 0 ? 0 : '-8px'
              }}>
                {initiales(p.nom)}
              </div>
            ))}
          </div>
          <span style={{ fontSize: '13px', color: '#8A7B68', fontWeight: '600' }}>
            {voyage.voyageurs.length} voyageur{voyage.voyageurs.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Accès rapide aux modules */}
      <p style={{ fontSize: '13px', color: '#8A7B68', fontWeight: '700', margin: '0 0 10px 4px' }}>ACCÈS RAPIDE</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {modules.map((m) => (
          <div
            key={m.id}
            onClick={() => setActiveTab && setActiveTab(m.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px',
              backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px solid #E8DFCF',
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(43, 36, 32, 0.03)'
            }}
          >
            <div style={{ backgroundColor: m.bg, color: m.color, padding: '10px', borderRadius: '13px', display: 'flex' }}>
              {m.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#2B2420' }}>{m.label}</div>
              <div style={{ fontSize: '12px', color: '#8A7B68' }}>{m.sousTitre}</div>
            </div>
            <IconArrowRight size={18} color="#D9CDB8" />
          </div>
        ))}
      </div>
    </div>
  );
}
