import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { IconArrowLeft, IconHistory } from '@tabler/icons-react';

const formatQuand = (timestamp) => {
  if (!timestamp?.seconds) return '';
  const date = new Date(timestamp.seconds * 1000);
  const maintenant = new Date();
  const diffMs = maintenant - date;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'à l\'instant';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export function Historique({ voyage, setActiveTab }) {
  const [entrees, setEntrees] = useState([]);

  useEffect(() => {
    if (!voyage?.id) return;
    const q = query(collection(db, 'historique'), where('voyageId', '==', voyage.id));
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setEntrees(data.slice(0, 100)); // on garde les 100 dernières actions
    });
  }, [voyage?.id]);

  if (!voyage) return null;

  return (
    <div style={{ padding: '15px 15px 30px 15px', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab && setActiveTab('gestion')}
          style={{ border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <IconArrowLeft size={18} color="#2B2420" />
        </button>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>Historique</h2>
      </div>

      {entrees.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px dashed #E8DFCF' }}>
          <IconHistory size={28} color="#B5A793" style={{ marginBottom: '10px' }} />
          <p style={{ color: '#8A7B68', fontSize: '13.5px', margin: 0 }}>Rien à afficher pour l'instant — les actions récentes de tous les voyageurs apparaîtront ici.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {entrees.map((e, i) => (
            <div key={e.id} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
              {i < entrees.length - 1 && (
                <div style={{ position: 'absolute', left: '5px', top: '18px', bottom: '-4px', width: '2px', backgroundColor: '#E8DFCF' }}></div>
              )}
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#B8863C', flexShrink: 0, marginTop: '4px', zIndex: 1 }}></div>
              <div style={{ paddingBottom: '18px', flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '13.5px', color: '#2B2420', lineHeight: '1.4' }}>
                  <strong>{e.auteurNom}</strong> {e.description}
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#B5A793' }}>{formatQuand(e.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
