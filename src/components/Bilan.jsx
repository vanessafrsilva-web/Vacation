import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  IconReceipt2, IconCalendarEvent, IconCoffee, IconMapPin, IconTrophy,
  IconMoodSad, IconArrowLeft
} from '@tabler/icons-react';

export function Bilan({ voyage, setActiveTab }) {
  const [activites, setActivites] = useState([]);
  const [depenses, setDepenses] = useState([]);

  useEffect(() => {
    if (!voyage?.id) return;
    const unsubActivites = onSnapshot(collection(db, `voyages/${voyage.id}/activites`), (snap) => {
      setActivites(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const qBudget = query(collection(db, 'budget'), where('voyageId', '==', voyage.id));
    const unsubBudget = onSnapshot(qBudget, (snap) => {
      setDepenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubActivites(); unsubBudget(); };
  }, [voyage?.id]);

  if (!voyage) return null;

  const totalDepense = depenses
    .filter((d) => !d.estRemboursement && !d.estApportCagnotte)
    .reduce((acc, d) => acc + (d.montant || 0), 0);

  const joursDeVoyage = (() => {
    if (!voyage.dateDebut || !voyage.dateFin) return null;
    const debut = new Date(voyage.dateDebut);
    const fin = new Date(voyage.dateFin);
    const diff = Math.round((fin - debut) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : null;
  })();

  const restos = activites.filter((a) => a.categorie === 'resto' && a.note != null);
  const visites = activites.filter((a) => a.categorie === 'visite' && a.note != null);

  const moyenne = (liste) => liste.length > 0 ? (liste.reduce((acc, a) => acc + a.note, 0) / liste.length) : null;
  const moyenneRestos = moyenne(restos);
  const moyenneVisites = moyenne(visites);

  const notesNotees = [...restos, ...visites];
  const meilleur = notesNotees.length > 0 ? [...notesNotees].sort((a, b) => b.note - a.note)[0] : null;
  const pire = notesNotees.length > 1 ? [...notesNotees].sort((a, b) => a.note - b.note)[0] : null;

  const carteStyle = {
    backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '20px',
    border: '1px solid #E8DFCF', marginBottom: '16px'
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
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>Bilan du voyage</h2>
      </div>

      {/* Chiffres clés */}
      <div style={carteStyle}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <IconReceipt2 size={22} color="#B8863C" style={{ marginBottom: '6px' }} />
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#2B2420' }}>{totalDepense.toFixed(0)}</div>
            <div style={{ fontSize: '11px', color: '#8A7B68' }}>CHF dépensés</div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#E8DFCF' }}></div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <IconCalendarEvent size={22} color="#6E8AA6" style={{ marginBottom: '6px' }} />
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#2B2420' }}>{joursDeVoyage ?? '—'}</div>
            <div style={{ fontSize: '11px', color: '#8A7B68' }}>jour{joursDeVoyage > 1 ? 's' : ''} de voyage</div>
          </div>
          {joursDeVoyage && (
            <>
              <div style={{ width: '1px', backgroundColor: '#E8DFCF' }}></div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#2B2420', marginTop: '28px' }}>{(totalDepense / joursDeVoyage).toFixed(0)}</div>
                <div style={{ fontSize: '11px', color: '#8A7B68' }}>CHF / jour</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notes moyennes */}
      <div style={carteStyle}>
        <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#8A7B68', fontWeight: 'bold' }}>NOTES MOYENNES</p>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: '#F1E8D8', padding: '10px', borderRadius: '12px' }}><IconCoffee size={20} color="#B8863C" /></div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#2B2420' }}>{moyenneRestos != null ? `${moyenneRestos.toFixed(1)}/10` : '—'}</div>
              <div style={{ fontSize: '11px', color: '#8A7B68' }}>{restos.length} resto{restos.length > 1 ? 's' : ''} noté{restos.length > 1 ? 's' : ''}</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: '#F8EFF2', padding: '10px', borderRadius: '12px' }}><IconMapPin size={20} color="#B97490" /></div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#2B2420' }}>{moyenneVisites != null ? `${moyenneVisites.toFixed(1)}/10` : '—'}</div>
              <div style={{ fontSize: '11px', color: '#8A7B68' }}>{visites.length} activité{visites.length > 1 ? 's' : ''} notée{visites.length > 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>
        {notesNotees.length === 0 && (
          <p style={{ margin: '14px 0 0 0', fontSize: '12.5px', color: '#B5A793', textAlign: 'center' }}>
            Note tes restos et activités depuis l'onglet Planning pour voir apparaître ton classement ici.
          </p>
        )}
      </div>

      {/* Le meilleur et le moins bon */}
      {(meilleur || pire) && (
        <div style={carteStyle}>
          <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#8A7B68', fontWeight: 'bold' }}>TEMPS FORTS</p>
          {meilleur && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: pire ? '10px' : 0 }}>
              <div style={{ backgroundColor: '#FBF3E3', padding: '9px', borderRadius: '11px' }}><IconTrophy size={18} color="#B8863C" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#2B2420', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meilleur.titre}</div>
                <div style={{ fontSize: '11px', color: '#8A7B68' }}>Le mieux noté · {meilleur.note}/10</div>
              </div>
            </div>
          )}
          {pire && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ backgroundColor: '#F8EFF2', padding: '9px', borderRadius: '11px' }}><IconMoodSad size={18} color="#B97490" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#2B2420', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pire.titre}</div>
                <div style={{ fontSize: '11px', color: '#8A7B68' }}>Le moins apprécié · {pire.note}/10</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
