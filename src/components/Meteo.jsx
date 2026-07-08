import React, { useEffect, useState } from 'react';
import { IconCloudRain } from '@tabler/icons-react';

// Codes météo standards (WMO), utilisés par Open-Meteo
const CODE_METEO = {
  0: { emoji: '☀️', label: 'Ciel dégagé' },
  1: { emoji: '🌤️', label: 'Plutôt dégagé' },
  2: { emoji: '⛅', label: 'Nuageux' },
  3: { emoji: '☁️', label: 'Couvert' },
  45: { emoji: '🌫️', label: 'Brouillard' },
  48: { emoji: '🌫️', label: 'Brouillard givrant' },
  51: { emoji: '🌦️', label: 'Bruine légère' },
  53: { emoji: '🌦️', label: 'Bruine' },
  55: { emoji: '🌦️', label: 'Bruine forte' },
  61: { emoji: '🌧️', label: 'Pluie légère' },
  63: { emoji: '🌧️', label: 'Pluie' },
  65: { emoji: '🌧️', label: 'Pluie forte' },
  71: { emoji: '🌨️', label: 'Neige légère' },
  73: { emoji: '🌨️', label: 'Neige' },
  75: { emoji: '🌨️', label: 'Neige forte' },
  80: { emoji: '🌦️', label: 'Averses' },
  81: { emoji: '🌦️', label: 'Averses fortes' },
  82: { emoji: '⛈️', label: 'Averses violentes' },
  95: { emoji: '⛈️', label: 'Orage' },
  96: { emoji: '⛈️', label: 'Orage + grêle' },
  99: { emoji: '⛈️', label: 'Orage violent' }
};

const nettoyerNomLieu = (texte) => (texte || '')
  .replace(/\b(vanlife|van life|roadtrip|road trip|voyage|trip|vacances|weekend|week-end|pro|loisirs|séjour|sejour)\b/gi, ' ')
  .replace(/[-–—:|]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export function Meteo({ voyage }) {
  const [previsions, setPrevisions] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [joursAvantDispo, setJoursAvantDispo] = useState(null); // null = dispo, sinon nb de jours à attendre

  useEffect(() => {
    if (!voyage?.dateDebut || !voyage?.dateFin) { setChargement(false); return; }

    const chercherMeteo = async () => {
      setChargement(true);
      setErreur('');
      setJoursAvantDispo(null);

      const aujourdHui = new Date();
      const aujourdHuiStr = aujourdHui.toISOString().slice(0, 10);
      const debut = new Date(voyage.dateDebut);
      const joursAvantDepart = Math.ceil((debut - aujourdHui) / 86400000);

      // Open-Meteo (gratuit) ne prévoit que ~16 jours à l'avance
      if (joursAvantDepart > 16) {
        setJoursAvantDispo(joursAvantDepart - 16);
        setChargement(false);
        return;
      }

      try {
        const lieuRecherche = nettoyerNomLieu(
          (voyage.isMultiDest && voyage.destinations?.[0]?.nom) || voyage.nom
        );
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(lieuRecherche)}&count=1`
        );
        const geoData = await geoRes.json();
        const lieu = geoData?.results?.[0];
        if (!lieu) throw new Error('Lieu introuvable pour la météo');

        const dateDebutRequete = voyage.dateDebut > aujourdHuiStr ? voyage.dateDebut : aujourdHuiStr;
        const dateFinMax = new Date(aujourdHui.getTime() + 15 * 86400000).toISOString().slice(0, 10);
        const dateFinRequete = voyage.dateFin < dateFinMax ? voyage.dateFin : dateFinMax;

        const meteoRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lieu.latitude}&longitude=${lieu.longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${dateDebutRequete}&end_date=${dateFinRequete}`
        );
        if (!meteoRes.ok) throw new Error(`Statut ${meteoRes.status}`);
        const meteoData = await meteoRes.json();
        setPrevisions(meteoData.daily);
      } catch (error) {
        console.warn("Prévisions météo indisponibles.", error);
        setErreur("Prévisions indisponibles pour l'instant.");
      } finally {
        setChargement(false);
      }
    };

    chercherMeteo();
  }, [voyage?.id, voyage?.dateDebut, voyage?.dateFin]);

  if (!voyage?.dateDebut || !voyage?.dateFin) return null;
  if (chargement) return null;

  if (joursAvantDispo !== null) {
    return (
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px dashed #E8DFCF', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <IconCloudRain size={22} color="#B5A793" style={{ flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: '13px', color: '#8A7B68', lineHeight: '1.5' }}>
          Prévisions météo disponibles à partir de <strong>16 jours avant le départ</strong> — reviens dans {joursAvantDispo} jour{joursAvantDispo > 1 ? 's' : ''}.
        </p>
      </div>
    );
  }

  if (erreur || !previsions) {
    return (
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px dashed #E8DFCF', padding: '16px', marginBottom: '20px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#8A7B68' }}>{erreur || 'Météo indisponible.'}</p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <p style={{ margin: '0 0 10px 4px', fontSize: '13px', fontWeight: '800', color: '#8A7B68' }}>🌦️ MÉTÉO SUR PLACE</p>
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
        {previsions.time.map((date, i) => {
          const code = previsions.weathercode[i];
          const meteo = CODE_METEO[code] || { emoji: '🌡️', label: '' };
          return (
            <div key={date} style={{ flexShrink: 0, minWidth: '76px', backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E8DFCF', padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#8A7B68', textTransform: 'capitalize', marginBottom: '4px' }}>
                {new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
              </div>
              <div style={{ fontSize: '26px', marginBottom: '4px' }}>{meteo.emoji}</div>
              <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#2B2420' }}>
                {Math.round(previsions.temperature_2m_max[i])}°
              </div>
              <div style={{ fontSize: '11px', color: '#B5A793' }}>
                {Math.round(previsions.temperature_2m_min[i])}°
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
