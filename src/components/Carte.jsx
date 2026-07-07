import React, { useEffect, useRef, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { IconArrowLeft, IconMapOff } from '@tabler/icons-react';

const COULEURS_CATEGORIE = {
  hotel: '#9A6B87', resto: '#B8863C', visite: '#B97490',
  taxi: '#F59E0B', transport: '#5E8A87', vol: '#6E8AA6'
};
const EMOJI_CATEGORIE = {
  hotel: '🛏️', resto: '☕', visite: '📍', taxi: '🚕', transport: '🚗', vol: '✈️'
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

    if (latlngs.length > 1) {
      L.polyline(latlngs, { color: '#B8863C', weight: 3, opacity: 0.7, dashArray: '6 8' }).addTo(carte);
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
  }, [points]);

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
            Aucune activité géolocalisée pour l'instant.<br />
            Dans Planning, ajoute un hôtel, un resto ou une visite en <strong>choisissant une adresse dans les suggestions</strong> qui apparaissent (pas juste en tapant du texte) — c'est ce qui enregistre la position GPS.
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

      {points.length > 0 && (
        <p style={{ marginTop: '12px', fontSize: '12px', color: '#8A7B68', textAlign: 'center' }}>
          {points.length} lieu{points.length > 1 ? 'x' : ''} géolocalisé{points.length > 1 ? 's' : ''}, numérotés dans l'ordre chronologique du voyage. Les catégories comme Taxi ou Transport n'ont pas d'adresse recherchée, elles n'apparaissent donc pas ici.
        </p>
      )}
    </div>
  );
}
