import React, { useState } from 'react';
import { IconArrowsExchange, IconCurrencyPound, IconCoin } from '@tabler/icons-react';

export function Convertisseur() {
  const [montant, setMontant] = useState('');
  const [taux, setTaux] = useState(1.14); // Taux de change modifiable (1 GBP = ~1.14 CHF)
  const [sens, setSens] = useState('GBP_TO_CHF'); // Sens par défaut : Livres vers Francs

  const resultat = () => {
    if (!montant) return '0.00';
    if (sens === 'GBP_TO_CHF') return (parseFloat(montant) * taux).toFixed(2);
    return (parseFloat(montant) / taux).toFixed(2);
  };

  const toggleSens = () => {
    setSens(sens === 'GBP_TO_CHF' ? 'CHF_TO_GBP' : 'GBP_TO_CHF');
  };

  return (
    <div style={{ backgroundColor: '#1C1C1E', padding: '20px', borderRadius: '20px', marginBottom: '25px', border: '1px solid #2C2C2E', boxShadow: '0 8px 20px rgba(0,0,0,0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0, color: '#FFF', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconArrowsExchange size={20} color="#0A84FF" /> Convertisseur rapide
        </h3>
        {/* Petit champ pour ajuster le taux de change si besoin */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontSize: '12px', color: '#AEAEB2' }}>Taux:</span>
          <input 
            type="number" 
            step="0.01" 
            value={taux} 
            onChange={e => setTaux(e.target.value)} 
            style={{ width: '60px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #3A3A3C', backgroundColor: '#2C2C2E', color: '#FFF', fontSize: '12px', outline: 'none' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        
        {/* Champ de saisie */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#AEAEB2' }}>
            {sens === 'GBP_TO_CHF' ? <IconCurrencyPound size={20} /> : <span style={{fontWeight:'bold', fontSize:'14px'}}>CHF</span>}
          </div>
          <input 
            type="number" 
            placeholder="Montant..." 
            value={montant} 
            onChange={e => setMontant(e.target.value)} 
            style={{ width: '100%', padding: '15px 15px 15px 40px', borderRadius: '12px', border: 'none', backgroundColor: '#2C2C2E', color: '#FFF', fontSize: '18px', outline: 'none', fontWeight: 'bold' }}
          />
        </div>

        {/* Bouton d'inversion */}
        <button 
          onClick={toggleSens}
          style={{ backgroundColor: '#3A3A3C', border: 'none', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#FFF', cursor: 'pointer', flexShrink: 0, transition: 'transform 0.2s' }}
          onMouseOver={e => e.currentTarget.style.transform = 'rotate(180deg)'}
          onMouseOut={e => e.currentTarget.style.transform = 'rotate(0deg)'}
        >
          <IconArrowsExchange size={24} />
        </button>

        {/* Résultat */}
        <div style={{ flex: 1, padding: '15px', borderRadius: '12px', backgroundColor: 'rgba(10, 132, 255, 0.1)', border: '1px dashed rgba(10, 132, 255, 0.3)', textAlign: 'right' }}>
          <span style={{ display: 'block', fontSize: '12px', color: '#0A84FF', marginBottom: '2px', fontWeight: 'bold' }}>
            {sens === 'GBP_TO_CHF' ? 'En Francs (CHF)' : 'En Livres (£)'}
          </span>
          <span style={{ color: '#FFF', fontSize: '20px', fontWeight: '800' }}>
            {resultat()}
          </span>
        </div>

      </div>
    </div>
  );
}