import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collectionGroup, collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  IconArrowLeft, IconMapPin, IconReceipt2, IconStar, IconPlaneDeparture, IconCalendarEvent
} from '@tabler/icons-react';

export function CarnetGlobal({ voyages, onClose }) {
  const annee = new Date().getFullYear();
  const [totalDepense, setTotalDepense] = useState(0);
  const [activitesAnnee, setActivitesAnnee] = useState([]);

  const voyagesAnnee = (voyages || []).filter(
    (v) => v.dateDebut && new Date(v.dateDebut).getFullYear() === annee
  );
  const idsVoyagesAnnee = voyagesAnnee.map((v) => v.id);

  useEffect(() => {
    if (idsVoyagesAnnee.length === 0) { setTotalDepense(0); return; }
    const q = query(collection(db, 'budget'), where('voyageId', 'in', idsVoyagesAnnee.slice(0, 30)));
    return onSnapshot(q, (snap) => {
      let total = 0;
      snap.forEach((d) => {
        const data = d.data();
        if (!data.estRemboursement && !data.estApportCagnotte) total += data.montant || 0;
      });
      setTotalDepense(total);
    });
  }, [idsVoyagesAnnee.join(',')]);

  useEffect(() => {
    const unsub = onSnapshot(collectionGroup(db, 'activites'), (snap) => {
      const data = snap.docs.map((d) => d.data());
      setActivitesAnnee(data.filter((a) => a.date && a.date.startsWith(String(annee))));
    });
    return () => unsub();
  }, [annee]);

  const destinations = [...new Set(voyagesAnnee.map((v) => v.nom))];
  const notes = activitesAnnee.filter((a) => a.note != null);
  const moyenneNotes = notes.length > 0 ? notes.reduce((acc, a) => acc + a.note, 0) / notes.length : null;

  const totalJours = voyagesAnnee.reduce((acc, v) => {
    if (!v.dateDebut || !v.dateFin) return acc;
    const diff = Math.round((new Date(v.dateFin) - new Date(v.dateDebut)) / 86400000) + 1;
    return acc + Math.max(diff, 0);
  }, 0);

  const carteStyle = {
    backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '20px',
    border: '1px solid #E8DFCF', marginBottom: '16px'
  };

  return (
    <div style={{ padding: '15px 15px 30px 15px', fontFamily: 'inherit', minHeight: '100vh', backgroundColor: '#F7F1E8' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={onClose}
          style={{ border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <IconArrowLeft size={18} color="#2B2420" />
        </button>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>Carnet {annee}</h2>
      </div>

      {voyagesAnnee.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px dashed #E8DFCF' }}>
          <p style={{ color: '#8A7B68', fontSize: '13.5px', margin: 0 }}>Aucun voyage enregistré pour {annee} pour l'instant.</p>
        </div>
      ) : (
        <>
          <div style={carteStyle}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <IconPlaneDeparture size={20} color="#B8863C" style={{ marginBottom: '6px' }} />
                <div style={{ fontSize: '19px', fontWeight: '800', color: '#2B2420' }}>{voyagesAnnee.length}</div>
                <div style={{ fontSize: '10.5px', color: '#8A7B68' }}>voyage{voyagesAnnee.length > 1 ? 's' : ''}</div>
              </div>
              <div style={{ width: '1px', backgroundColor: '#E8DFCF' }}></div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <IconCalendarEvent size={20} color="#6E8AA6" style={{ marginBottom: '6px' }} />
                <div style={{ fontSize: '19px', fontWeight: '800', color: '#2B2420' }}>{totalJours}</div>
                <div style={{ fontSize: '10.5px', color: '#8A7B68' }}>jour{totalJours > 1 ? 's' : ''}</div>
              </div>
              <div style={{ width: '1px', backgroundColor: '#E8DFCF' }}></div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <IconReceipt2 size={20} color="#F59E0B" style={{ marginBottom: '6px' }} />
                <div style={{ fontSize: '19px', fontWeight: '800', color: '#2B2420' }}>{totalDepense.toFixed(0)}</div>
                <div style={{ fontSize: '10.5px', color: '#8A7B68' }}>CHF dépensés</div>
              </div>
              {moyenneNotes != null && (
                <>
                  <div style={{ width: '1px', backgroundColor: '#E8DFCF' }}></div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <IconStar size={20} color="#B97490" style={{ marginBottom: '6px' }} />
                    <div style={{ fontSize: '19px', fontWeight: '800', color: '#2B2420' }}>{moyenneNotes.toFixed(1)}</div>
                    <div style={{ fontSize: '10.5px', color: '#8A7B68' }}>note moyenne</div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={carteStyle}>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#8A7B68', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconMapPin size={14} /> DESTINATIONS DE L'ANNÉE
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {destinations.map((d) => (
                <span key={d} style={{ fontSize: '13px', fontWeight: '700', color: '#2B2420', backgroundColor: '#F7F1E8', padding: '7px 13px', borderRadius: '999px' }}>
                  {d}
                </span>
              ))}
            </div>
          </div>

          <div style={carteStyle}>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#8A7B68', fontWeight: 'bold' }}>TOUS LES VOYAGES DE {annee}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[...voyagesAnnee].sort((a, b) => new Date(a.dateDebut) - new Date(b.dateDebut)).map((v) => (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1E8D8' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#2B2420' }}>{v.nom}</span>
                  <span style={{ fontSize: '12px', color: '#8A7B68' }}>
                    {new Date(v.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
