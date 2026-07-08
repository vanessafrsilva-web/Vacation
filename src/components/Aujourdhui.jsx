import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  IconArrowLeft, IconClock, IconMapPin, IconSun, IconCloudRain, IconCalendarOff, IconCheck
} from '@tabler/icons-react';

const CODE_METEO = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️', 80: '🌦️', 81: '🌦️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️'
};

const nettoyerNomLieu = (texte) => (texte || '')
  .replace(/\b(vanlife|van life|roadtrip|road trip|voyage|trip|vacances|weekend|week-end|pro|loisirs|séjour|sejour)\b/gi, ' ')
  .replace(/[-–—:|]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const CATEGORIE_ICONE = {
  vol: '✈️', hotel: '🛏️', taxi: '🚕', transport: '🚗', resto: '☕', visite: '📍'
};

export function Aujourdhui({ voyage, setActiveTab }) {
  const [activites, setActivites] = useState([]);
  const [meteoJour, setMeteoJour] = useState(null);
  const aujourdHui = new Date().toISOString().slice(0, 10);
  const heureActuelle = new Date().toTimeString().slice(0, 5);

  useEffect(() => {
    if (!voyage?.id) return;
    return onSnapshot(collection(db, `voyages/${voyage.id}/activites`), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setActivites(data.filter((a) => a.date === aujourdHui).sort((a, b) => (a.heure || '').localeCompare(b.heure || '')));
    });
  }, [voyage?.id]);

  useEffect(() => {
    if (!voyage?.dateDebut || aujourdHui < voyage.dateDebut || aujourdHui > voyage.dateFin) return;
    (async () => {
      try {
        const lieuRecherche = nettoyerNomLieu((voyage.isMultiDest && voyage.destinations?.[0]?.nom) || voyage.nom);
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(lieuRecherche)}&count=1`);
        const geoData = await geoRes.json();
        const lieu = geoData?.results?.[0];
        if (!lieu) return;
        const meteoRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lieu.latitude}&longitude=${lieu.longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${aujourdHui}&end_date=${aujourdHui}`);
        const meteoData = await meteoRes.json();
        if (meteoData?.daily?.time?.length) {
          setMeteoJour({
            code: meteoData.daily.weathercode[0],
            max: meteoData.daily.temperature_2m_max[0],
            min: meteoData.daily.temperature_2m_min[0]
          });
        }
      } catch (error) {
        console.warn('Météo du jour indisponible.', error);
      }
    })();
  }, [voyage?.id]);

  if (!voyage) return null;

  const enCours = voyage.dateDebut && voyage.dateFin && aujourdHui >= voyage.dateDebut && aujourdHui <= voyage.dateFin;
  const prochaine = activites.find((a) => !a.heure || a.heure >= heureActuelle);

  return (
    <div style={{ padding: '15px 15px 30px 15px', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab && setActiveTab('gestion')}
          style={{ border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <IconArrowLeft size={18} color="#2B2420" />
        </button>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>Aujourd'hui</h2>
      </div>

      {!enCours ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px dashed #E8DFCF' }}>
          <IconCalendarOff size={28} color="#B5A793" style={{ marginBottom: '10px' }} />
          <p style={{ color: '#8A7B68', fontSize: '13.5px', margin: 0 }}>
            {voyage.dateDebut && aujourdHui < voyage.dateDebut ? "Ce voyage n'a pas encore commencé." : "Ce voyage est terminé — j'espère qu'il s'est bien passé !"}
          </p>
        </div>
      ) : (
        <>
          {/* Date + météo du jour */}
          <div style={{ backgroundColor: '#2B2420', borderRadius: '20px', padding: '20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '11px', color: '#D9CDB8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Aujourd'hui</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '19px', color: '#FFFFFF', fontWeight: '800', textTransform: 'capitalize' }}>
                {new Date(aujourdHui).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            {meteoJour && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '30px' }}>{CODE_METEO[meteoJour.code] || '🌡️'}</div>
                <div style={{ fontSize: '12px', color: '#D9CDB8' }}>{Math.round(meteoJour.max)}° / {Math.round(meteoJour.min)}°</div>
              </div>
            )}
          </div>

          {/* Programme du jour */}
          {activites.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px dashed #E8DFCF' }}>
              <p style={{ color: '#8A7B68', fontSize: '13.5px', margin: 0 }}>Rien de prévu aujourd'hui — journée libre !</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activites.map((a) => {
                const estProchaine = prochaine?.id === a.id;
                const estPassee = a.heure && a.heure < heureActuelle && !estProchaine;
                return (
                  <div
                    key={a.id}
                    style={{
                      backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '14px 16px',
                      border: estProchaine ? '2px solid #B8863C' : '1px solid #E8DFCF',
                      opacity: estPassee ? 0.5 : 1,
                      display: 'flex', alignItems: 'center', gap: '12px'
                    }}
                  >
                    <div style={{ fontSize: '22px', flexShrink: 0 }}>{CATEGORIE_ICONE[a.categorie] || '📍'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {estProchaine && (
                        <p style={{ margin: '0 0 2px 0', fontSize: '10.5px', fontWeight: '800', color: '#B8863C', textTransform: 'uppercase', letterSpacing: '0.3px' }}>À venir</p>
                      )}
                      <p style={{ margin: 0, fontSize: '14.5px', fontWeight: '700', color: '#2B2420' }}>{a.titre}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '3px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#8A7B68' }}>
                          <IconClock size={12} /> {a.heure || '--:--'}
                        </span>
                        {(a.lieu || a.depart) && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#8A7B68', minWidth: 0 }}>
                            <IconMapPin size={12} /> {a.categorie === 'vol' ? `${a.depart || '?'} → ${a.arrivee || '?'}` : a.lieu}
                          </span>
                        )}
                      </div>
                    </div>
                    {estPassee && <IconCheck size={18} color="#B5A793" style={{ flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
