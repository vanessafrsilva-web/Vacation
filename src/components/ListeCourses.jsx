import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, addDoc, onSnapshot, query, where, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import {
  IconArrowLeft, IconPlus, IconTrash, IconCircle, IconCircleCheckFilled, IconBasket
} from '@tabler/icons-react';

export function ListeCourses({ voyage, setActiveTab, currentUserId, currentUserNom }) {
  const [articles, setArticles] = useState([]);
  const [nom, setNom] = useState('');
  const [quantite, setQuantite] = useState('');

  useEffect(() => {
    if (!voyage?.id) return;
    const q = query(collection(db, 'courses'), where('voyageId', '==', voyage.id));
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        if (a.achete === b.achete) return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
        return a.achete ? 1 : -1;
      });
      setArticles(data);
    });
  }, [voyage?.id]);

  if (!voyage) return null;

  const ajouterArticle = async (e) => {
    e.preventDefault();
    if (!nom.trim()) return;
    try {
      await addDoc(collection(db, 'courses'), {
        nom: nom.trim(),
        quantite: quantite.trim() || null,
        achete: false,
        voyageId: voyage.id,
        ajouteParId: currentUserId || null,
        ajouteParNom: currentUserNom || 'Quelqu\'un',
        createdAt: serverTimestamp()
      });
      setNom('');
      setQuantite('');
    } catch (error) {
      console.error("Erreur d'ajout :", error);
    }
  };

  const toggleAchete = async (article) => {
    try {
      await updateDoc(doc(db, 'courses', article.id), { achete: !article.achete });
    } catch (error) {
      console.error('Erreur de mise à jour :', error);
    }
  };

  const supprimerArticle = async (id) => {
    try {
      await deleteDoc(doc(db, 'courses', id));
    } catch (error) {
      console.error('Erreur de suppression :', error);
    }
  };

  const total = articles.length;
  const achetes = articles.filter((a) => a.achete).length;
  const progression = total === 0 ? 0 : Math.round((achetes / total) * 100);

  return (
    <div style={{ padding: '15px 15px 30px 15px', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab && setActiveTab('gestion')}
          style={{ border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <IconArrowLeft size={18} color="#2B2420" />
        </button>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>Liste de courses</h2>
      </div>

      {/* Progression */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '18px', padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: '#2B2420', fontSize: '15px' }}>
            <IconBasket size={18} color="#10B981" /> Panier
          </div>
          <span style={{ fontWeight: '800', color: progression === 100 ? '#10B981' : '#6E8AA6' }}>{progression}%</span>
        </div>
        <div style={{ width: '100%', height: '8px', backgroundColor: '#EEF2F7', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ width: `${progression}%`, height: '100%', backgroundColor: progression === 100 ? '#10B981' : '#6E8AA6', borderRadius: '999px', transition: 'width 0.3s ease' }}></div>
        </div>
        <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#8A7B68' }}>
          {achetes} sur {total} article{total > 1 ? 's' : ''} acheté{achetes > 1 ? 's' : ''}
        </p>
      </div>

      {/* Formulaire d'ajout */}
      <form onSubmit={ajouterArticle} style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        <input
          type="text"
          placeholder="Ajouter un article..."
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          style={{ flex: 2, padding: '13px 14px', borderRadius: '14px', border: '1px solid #E8DFCF', fontSize: '15px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <input
          type="text"
          placeholder="Qté"
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          style={{ flex: '0 0 70px', padding: '13px 10px', borderRadius: '14px', border: '1px solid #E8DFCF', fontSize: '15px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <button type="submit" style={{ flexShrink: 0, width: '46px', border: 'none', backgroundColor: '#10B981', color: '#FFF', borderRadius: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconPlus size={20} />
        </button>
      </form>

      {/* Liste */}
      {total === 0 ? (
        <div style={{ padding: '30px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px dashed #E8DFCF' }}>
          <p style={{ color: '#8A7B68', fontSize: '13.5px', margin: 0 }}>
            La liste est vide. Ajoutez un article — tout le monde la voit se remplir (et se cocher) en temps réel.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {articles.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '14px', padding: '12px 14px' }}>
              <div onClick={() => toggleAchete(a)} style={{ cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                {a.achete ? <IconCircleCheckFilled size={22} color="#10B981" /> : <IconCircle size={22} color="#B5A793" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }} onClick={() => toggleAchete(a)}>
                <span style={{ fontSize: '14.5px', fontWeight: '600', color: a.achete ? '#B5A793' : '#2B2420', textDecoration: a.achete ? 'line-through' : 'none', cursor: 'pointer' }}>
                  {a.nom}{a.quantite ? ` · ${a.quantite}` : ''}
                </span>
                <div style={{ fontSize: '11px', color: '#D9CDB8' }}>Ajouté par {a.ajouteParNom}</div>
              </div>
              <button onClick={() => supprimerArticle(a.id)} style={{ border: 'none', background: 'none', color: '#D9CDB8', cursor: 'pointer', padding: '4px', flexShrink: 0 }}>
                <IconTrash size={17} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
