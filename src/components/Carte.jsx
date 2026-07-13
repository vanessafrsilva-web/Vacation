import React, { useEffect, useRef, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { IconArrowLeft, IconMapOff, IconCar } from '@tabler/icons-react';

const COULEURS_CATEGORIE = {
  hotel: '#D6336C', resto: '#B8863C', visite: '#B97490',
  taxi: '#F59E0B', transport: '#5E8A87', vol: '#6E8AA6',
  service: '#5E8A87', laverie: '#6E8AA6', technique: '#4A7C59'
};
const EMOJI_CATEGORIE = {
  hotel: '🛏️', resto: '☕', visite: '📍', taxi: '🚕', transport: '🚗', vol: '✈️',
  service: '🚿', laverie: '🧺', technique: '⛽'
};

export function Carte({ voyage, setActiveTab, integree = false }) {
  const conteneurRef = useRef(null);
  const carteRef = useRef(null);
  const [activites, setActivites] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!voyage?.id) return;
    const unsub = onSnapshot(collection(db, `voyages/${voyage.id}/activites`), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(a.date + 'T' + (a.heure || '00:00')) - new Date(b.date + 'T' + (b.heure || '00:00')));
      setActivites(data);
      setChargement(false);
    });
    return () => unsub();
  }, [voyage?.id]);

  // Seules les activités où une adresse a été choisie dans les suggestions
  // (hôtel / resto / visite) ont des coordonnées GPS enregistrées.
  const points = activites.filter((a) => typeof a.lat === 'number' && typeof a.lon === 'number');

  // Distance et temps de route entre chaque étape consécutive, via OSRM
  // (service public gratuit, sans clé, basé sur OpenStreetMap).
  const [trajets, setTrajets] = useState([]);
  const [geometrieRoute, setGeometrieRoute] = useState(null); // tracé réel des routes, pour affichage sur la carte
  const [chargementTrajets, setChargementTrajets] = useState(false);
  const [erreurTrajets, setErreurTrajets] = useState(false);

  useEffect(() => {
    if (points.length < 2) { setTrajets([]); setGeometrieRoute(null); setErreurTrajets(false); return; }

    const chercherTrajets = async () => {
      setChargementTrajets(true);
      setErreurTrajets(false);
      try {
        const coords = points.map((p) => `${p.lon},${p.lat}`).join(';');
        // overview=full + geometries=geojson : on récupère le tracé réel
        // suivant les routes, pas juste les distances/durées par étape.
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
        if (!res.ok) throw new Error(`Statut ${res.status}`);
        const data = await res.json();
        const route = data?.routes?.[0];
        const legs = route?.legs || [];
        if (legs.length === 0) throw new Error('Aucun trajet renvoyé');
        setTrajets(legs.map((leg, i) => ({
          de: points[i],
          a: points[i + 1],
          distanceKm: leg.distance / 1000,
          dureeMin: leg.duration / 60
        })));
        // Coordonnées GeoJSON en [lon, lat] — Leaflet attend [lat, lon]
        const coordsRoute = route?.geometry?.coordinates || [];
        setGeometrieRoute(coordsRoute.map(([lon, lat]) => [lat, lon]));
      } catch (error) {
        console.warn("Temps de trajet indisponibles.", error);
        setTrajets([]);
        setGeometrieRoute(null);
        setErreurTrajets(true);
      } finally {
        setChargementTrajets(false);
      }
    };

    chercherTrajets();
  }, [points.map((p) => `${p.lat},${p.lon}`).join('|')]);

  // Total cumulé de tous les trajets — utile pour voir d'un coup d'œil le
  // volume de route sur l'ensemble du voyage.
  const totalKm = trajets.reduce((somme, t) => somme + t.distanceKm, 0);
  const totalMin = trajets.reduce((somme, t) => somme + t.dureeMin, 0);

  // Construction / mise à jour de la carte Leaflet
  useEffect(() => {
    if (!conteneurRef.current || points.length === 0) return;

    if (!carteRef.current) {
      carteRef.current = L.map(conteneurRef.current, { zoomControl: true });
    }
    const carte = carteRef.current;

    carte.eachLayer((layer) => carte.removeLayer(layer));

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(carte);

    const latlngs = points.map((p) => [p.lat, p.lon]);

    if (geometrieRoute && geometrieRoute.length > 1) {
      // Tracé réel suivant les routes (voiture), via OSRM.
      L.polyline(geometrieRoute, { color: '#B8863C', weight: 4, opacity: 0.8 }).addTo(carte);
    } else if (latlngs.length > 1) {
      // Repli temporaire (avant que OSRM ait répondu, ou en cas d'échec) :
      // ligne droite en pointillés, clairement différenciée du vrai tracé.
      L.polyline(latlngs, { color: '#B8863C', weight: 3, opacity: 0.5, dashArray: '6 8' }).addTo(carte);
    }

    points.forEach((p, i) => {
      const couleur = COULEURS_CATEGORIE[p.categorie] || '#8A7B68';
      const emoji = EMOJI_CATEGORIE[p.categorie] || '📍';
      const icone = L.divIcon({
        html: `<div style="background:${couleur};color:#FFF;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;font-family:sans-serif;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${i + 1}</div>`,
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      L.marker([p.lat, p.lon], { icon: icone })
        .addTo(carte)
        .bindPopup(
          `<strong>${emoji} ${p.titre}</strong><br/>${new Date(p.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${p.heure || ''}`
        );
    });

    if (latlngs.length === 1) {
      carte.setView(latlngs[0], 14);
    } else {
      carte.fitBounds(latlngs, { padding: [40, 40] });
    }
  }, [points, geometrieRoute]);

  // Nettoyage de l'instance Leaflet au démontage
  useEffect(() => {
    return () => {
      if (carteRef.current) {
        carteRef.current.remove();
        carteRef.current = null;
      }
    };
  }, []);

  if (!voyage) return null;

  return (
    <div style={{ padding: integree ? '0' : '15px', fontFamily: 'inherit' }}>
      {!integree && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <button
            onClick={() => setActiveTab && setActiveTab('gestion')}
            style={{ border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <IconArrowLeft size={18} color="#2B2420" />
          </button>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>Carte du voyage</h2>
        </div>
      )}
      {integree && (
        <h3 style={{ margin: '10px 0 14px 0', fontSize: '18px', fontWeight: '700', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>
          🗺️ Vue d'ensemble du trajet
        </h3>
      )}

      {!chargement && points.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px dashed #E8DFCF' }}>
          <IconMapOff size={32} color="#B5A793" style={{ marginBottom: '10px' }} />
          <p style={{ color: '#8A7B68', fontSize: '13.5px', margin: 0, lineHeight: '1.6' }}>
            Aucune activité géolocalisée pour l'instant.
          </p>
        </div>
      )}

      <div
        ref={conteneurRef}
        style={{
          height: '60vh', borderRadius: '20px', overflow: 'hidden', border: '1px solid #E8DFCF',
          display: (!chargement && points.length === 0) ? 'none' : 'block'
        }}
      ></div>

      {chargementTrajets && (
        <p style={{ marginTop: '14px', fontSize: '12px', color: '#B5A793', textAlign: 'center' }}>Calcul des temps de trajet...</p>
      )}

      {erreurTrajets && (
        <p style={{ marginTop: '14px', fontSize: '12px', color: '#B3453A', textAlign: 'center' }}>
          Temps de trajet indisponibles pour l'instant. Réessaie plus tard.
        </p>
      )}

      {trajets.length > 0 && (
        <div style={{ marginTop: '18px' }}>
          <p style={{ margin: '0 0 10px 4px', fontSize: '13px', fontWeight: '800', color: '#8A7B68' }}>🚗 TRAJETS ENTRE LES ÉTAPES</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {trajets.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E8DFCF' }}>
                <IconCar size={16} color="#B8863C" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '12.5px', color: '#2B2420', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {i + 1}. {t.de.titre} → {i + 2}. {t.a.titre}
                </span>
                <span style={{ fontSize: '12px', color: '#8A7B68', fontWeight: '700', flexShrink: 0 }}>
                  {t.distanceKm.toFixed(0)} km · {t.dureeMin < 60 ? `${Math.round(t.dureeMin)} min` : `${Math.floor(t.dureeMin / 60)}h${String(Math.round(t.dureeMin % 60)).padStart(2, '0')}`}
                </span>
              </div>
            ))}
          </div>

          {/* Total cumulé de route sur l'ensemble du voyage */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 14px', backgroundColor: '#2B2420', borderRadius: '14px', marginTop: '10px' }}>
            <IconCar size={18} color="#D9CDB8" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '13px', color: '#F7F1E8', fontWeight: '800' }}>Total sur ce voyage</span>
            <span style={{ fontSize: '14px', color: '#FFFFFF', fontWeight: '800', flexShrink: 0 }}>
              {totalKm.toFixed(0)} km · {totalMin < 60 ? `${Math.round(totalMin)} min` : `${Math.floor(totalMin / 60)}h${String(Math.round(totalMin % 60)).padStart(2, '0')}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
