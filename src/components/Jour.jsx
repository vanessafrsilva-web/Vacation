import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { 
  IconClock, IconMapPin, IconSun, IconCloudRain, IconCloud, 
  IconSnowflake, IconCloudStorm, IconSearch, IconShare, IconNavigation 
} from '@tabler/icons-react';

export function Jour({ voyageId }) {
  const [activites, setActivites] = useState([]);
  const [jourActif, setJourActif] = useState(1);
  const listeJours = [1, 2, 3, 4, 5];

  const [ville, setVille] = useState('Lausanne'); 
  const [meteo, setMeteo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // LECTURE DES DONNÉES
  useEffect(() => {
    if (!voyageId) return;
    const q = query(collection(db, 'activites'), where('voyageId', '==', voyageId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => a.heure.localeCompare(b.heure));
      setActivites(data);
    });
    return () => unsubscribe();
  }, [voyageId]);

  const activitesDuJour = activites.filter(act => act.jour === jourActif);

  // MÉTÉO
  const fetchMeteo = async (e) => {
    if (e) e.preventDefault();
    if (!ville) return;
    setLoading(true);
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${ville}&count=1&language=fr&format=json`);
      const geoData = await geoRes.json();
      if (!geoData.results || geoData.results.length === 0) throw new Error('Introuvable');
      
      const { latitude, longitude, name } = geoData.results[0];
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
      const weatherData = await weatherRes.json();
      
      setMeteo({ temp: Math.round(weatherData.current_weather.temperature), code: weatherData.current_weather.weathercode, nom: name });
    } catch {
      setMeteo({ erreur: 'Non trouvé' });
    }
    setLoading(false);
  };

  useEffect(() => { fetchMeteo(); }, []);

  const getMeteoIcon = (code) => {
    if (code === 0) return <IconSun size={42} color="#FFD60A" />;
    if (code > 0 && code <= 3) return <IconCloud size={42} color="#F2F2F7" />;
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return <IconCloudRain size={42} color="#A2C8F2" />;
    if (code >= 71 && code <= 86) return <IconSnowflake size={42} color="#FFF" />;
    if (code >= 95) return <IconCloudStorm size={42} color="#FFD60A" />;
    return <IconCloud size={42} color="#FFF" />;
  };

  // NOUVEAUTÉ : PARTAGER LE PROGRAMME
  const handleShare = () => {
    if (activitesDuJour.length === 0) return;
    const textePartage = `🚗 *Programme du Jour ${jourActif}*\n\n` + 
      activitesDuJour.map(a => `🕒 ${a.heure} - ${a.nom}`).join('\n');
    
    navigator.clipboard.writeText(textePartage);
    setToastMsg('Copié dans le presse-papier !');
    setTimeout(() => setToastMsg(''), 3000); // Disparaît après 3s
  };

  // NOUVEAUTÉ : OUVRIR DANS GOOGLE MAPS
  const openInMaps = (nomActivite) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nomActivite + ' ' + (meteo?.nom || ''))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{ padding: '5px', textAlign: 'left', position: 'relative' }}>
      
      {/* Toast Notification (Feedback visuel élégant) */}
      {toastMsg && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#30D158', color: '#FFF', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', animation: 'fadeIn 0.3s ease-out' }}>
          {toastMsg}
        </div>
      )}

      {/* SÉLECTEUR DE JOUR : Design iOS Segmented Control amélioré */}
      <nav aria-label="Navigation des jours" style={{ display: 'flex', overflowX: 'auto', backgroundColor: 'rgba(44, 44, 46, 0.8)', backdropFilter: 'blur(10px)', padding: '6px', borderRadius: '12px', marginBottom: '25px', gap: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        {listeJours.map((j) => (
          <button
            key={j}
            onClick={() => setJourActif(j)}
            aria-pressed={jourActif === j}
            style={{ flex: 1, minWidth: '65px', padding: '10px 0', border: 'none', borderRadius: '8px', backgroundColor: jourActif === j ? '#0A84FF' : 'transparent', color: jourActif === j ? '#FFF' : '#AEAEB2', fontWeight: jourActif === j ? 'bold' : '500', cursor: 'pointer', fontSize: '15px', transition: 'all 0.3s ease' }}
          >
            Jour {j}
          </button>
        ))}
      </nav>

      {/* WIDGET MÉTÉO : Design "Glassmorphism" Premium */}
      <header style={{ background: 'linear-gradient(135deg, #005BB5 0%, #0A84FF 100%)', borderRadius: '20px', padding: '25px', marginBottom: '30px', color: '#FFF', boxShadow: '0 12px 24px rgba(10, 132, 255, 0.25)', position: 'relative', overflow: 'hidden' }}>
        
        {/* Formulaire de recherche discret */}
        <form onSubmit={fetchMeteo} style={{ display: 'flex', marginBottom: '20px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '4px' }}>
          <input type="text" value={ville} onChange={(e) => setVille(e.target.value)} aria-label="Rechercher une ville" placeholder="Où êtes-vous ?" style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: '#FFF', padding: '8px 12px', outline: 'none', fontSize: '16px' }} />
          <button type="submit" aria-label="Valider la recherche" style={{ backgroundColor: 'transparent', border: 'none', color: '#FFF', cursor: 'pointer', padding: '0 12px' }}>
            <IconSearch size={20} />
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: '0 0 5px 0', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>Aujourd'hui</h1>
            <p style={{ margin: 0, opacity: 0.9, fontSize: '15px', display: 'flex', alignItems: 'center' }}>
              <IconMapPin size={18} style={{ marginRight: '6px' }} /> {meteo?.nom || 'Recherche...'}
            </p>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            {loading ? <p>...</p> : meteo?.erreur ? <p style={{ fontWeight: 'bold' }}>{meteo.erreur}</p> : meteo ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {getMeteoIcon(meteo.code)}
                <p style={{ margin: '2px 0 0 0', fontWeight: 'bold', fontSize: '22px' }}>{meteo.temp}°C</p>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* EN-TÊTE DU PROGRAMME AVEC BOUTON PARTAGE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#FFF', fontSize: '22px', margin: 0 }}>Programme</h2>
        <button 
          onClick={handleShare} 
          aria-label="Partager le programme"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#0A84FF', fontSize: '14px', fontWeight: '600', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(10,132,255,0.1)' }}
        >
          <IconShare size={16} /> Partager
        </button>
      </div>
      
      {/* TIMELINE : Design aéré, contraste amélioré et boutons d'action rapides */}
      <section aria-label="Liste des activités">
        {activitesDuJour.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#2C2C2E', borderRadius: '16px', border: '1px solid #3A3A3C' }}>
            <p style={{ color: '#AEAEB2', margin: 0, fontSize: '16px' }}>Aucune activité. Profitez du paysage !</p>
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid #3A3A3C', marginLeft: '12px' }}>
            {activitesDuJour.map((act, index) => (
              <article key={act.id} style={{ position: 'relative', marginBottom: index === activitesDuJour.length - 1 ? '0' : '25px' }}>
                
                {/* Point de timeline stylisé */}
                <div style={{ position: 'absolute', left: '-31px', top: '0', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#1C1C1E', border: '3px solid #0A84FF', boxShadow: '0 0 0 4px #1C1C1E' }}></div>
                
                <div style={{ marginLeft: '15px', backgroundColor: '#2C2C2E', padding: '16px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', color: '#0A84FF', fontSize: '14px', fontWeight: '700', marginBottom: '8px', letterSpacing: '0.5px' }}>
                        <IconClock size={16} style={{ marginRight: '6px' }} /> {act.heure}
                      </span>
                      <h3 style={{ margin: 0, color: '#FFF', fontSize: '18px', fontWeight: '600', lineHeight: '1.4' }}>{act.nom}</h3>
                    </div>
                    
                    {/* BOUTON D'ACTION RAPIDE : GPS */}
                    <button 
                      onClick={() => openInMaps(act.nom)}
                      aria-label={`Aller à ${act.nom} avec Google Maps`}
                      title="Ouvrir dans Google Maps"
                      style={{ backgroundColor: '#3A3A3C', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#30D158', cursor: 'pointer', transition: 'transform 0.2s ease', flexShrink: 0 }}
                      onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <IconNavigation size={20} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}