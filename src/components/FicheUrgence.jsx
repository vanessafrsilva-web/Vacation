import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import {
  IconArrowLeft, IconPhone, IconPlus, IconTrash, IconAlertTriangle, IconShieldCheck
} from '@tabler/icons-react';

// Numéros d'urgence par pays — police / ambulance / pompiers / numéro général.
// Info publique standard, à vérifier avant de partir (ça peut changer).
const NUMEROS_PAYS = {
  // clé = mots-clés à repérer dans le nom du voyage (en minuscules)
  'ecosse|scotland|royaume-uni|royaume uni|uk|angleterre|england|pays de galles|wales|irlande du nord|londres|london|edimbourg|edinburgh|glasgow': {
    pays: 'Royaume-Uni', police: '999', ambulance: '999', pompiers: '999', general: '112'
  },
  'france|paris|lyon|marseille|nice|bordeaux|alsace|strasbourg|colmar': {
    pays: 'France', police: '17', ambulance: '15', pompiers: '18', general: '112'
  },
  'suisse|switzerland|geneve|genève|lausanne|zurich|zürich|berne|bale|bâle': {
    pays: 'Suisse', police: '117', ambulance: '144', pompiers: '118', general: '112'
  },
  'italie|italy|rome|milan|venise|florence|naples': {
    pays: 'Italie', police: '113', ambulance: '118', pompiers: '115', general: '112'
  },
  'espagne|spain|madrid|barcelone|barcelona|valence|seville': {
    pays: 'Espagne', police: '091', ambulance: '061', pompiers: '080', general: '112'
  },
  'portugal|lisbonne|lisboa|porto': {
    pays: 'Portugal', police: '112', ambulance: '112', pompiers: '112', general: '112'
  },
  'allemagne|germany|berlin|munich|munchen|münchen|hambourg|cologne': {
    pays: 'Allemagne', police: '110', ambulance: '112', pompiers: '112', general: '112'
  },
  'autriche|austria|vienne|vienna|salzbourg|salzburg|innsbruck': {
    pays: 'Autriche', police: '133', ambulance: '144', pompiers: '122', general: '112'
  },
  'belgique|belgium|bruxelles|brussels|anvers|antwerp': {
    pays: 'Belgique', police: '101', ambulance: '112', pompiers: '112', general: '112'
  },
  'pays-bas|netherlands|hollande|amsterdam|rotterdam': {
    pays: 'Pays-Bas', police: '112', ambulance: '112', pompiers: '112', general: '112'
  },
  'grece|grèce|greece|athenes|athenes|santorin|crete|corfou': {
    pays: 'Grèce', police: '100', ambulance: '166', pompiers: '199', general: '112'
  },
  'croatie|croatia|zagreb|dubrovnik|split': {
    pays: 'Croatie', police: '192', ambulance: '194', pompiers: '193', general: '112'
  },
  'etats-unis|états-unis|usa|united states|new york|californie|california|floride|florida': {
    pays: 'États-Unis', police: '911', ambulance: '911', pompiers: '911', general: '911'
  },
  'canada|quebec|québec|toronto|vancouver|montreal|montréal': {
    pays: 'Canada', police: '911', ambulance: '911', pompiers: '911', general: '911'
  },
  'maroc|morocco|marrakech|casablanca|fes|fès|agadir': {
    pays: 'Maroc', police: '19', ambulance: '15', pompiers: '15', general: '19'
  },
  'turquie|turkey|istanbul|antalya|cappadoce': {
    pays: 'Turquie', police: '155', ambulance: '112', pompiers: '110', general: '112'
  },
  'japon|japan|tokyo|kyoto|osaka': {
    pays: 'Japon', police: '110', ambulance: '119', pompiers: '119', general: '110'
  },
  'thailande|thaïlande|thailand|bangkok|phuket|chiang mai': {
    pays: 'Thaïlande', police: '191', ambulance: '1669', pompiers: '199', general: '191'
  },
  'australie|australia|sydney|melbourne|brisbane': {
    pays: 'Australie', police: '000', ambulance: '000', pompiers: '000', general: '000'
  },
  'nouvelle-zelande|nouvelle-zélande|new zealand|auckland|wellington': {
    pays: 'Nouvelle-Zélande', police: '111', ambulance: '111', pompiers: '111', general: '111'
  }
};

const detecterPays = (nomVoyage) => {
  if (!nomVoyage) return null;
  const texte = nomVoyage.toLowerCase();
  for (const cles in NUMEROS_PAYS) {
    const motsCles = cles.split('|');
    if (motsCles.some((mot) => texte.includes(mot))) {
      return NUMEROS_PAYS[cles];
    }
  }
  return null;
};

export function FicheUrgence({ voyage, setActiveTab }) {
  const [contactsPerso, setContactsPerso] = useState(voyage?.contactsUrgence || []);
  const [nomContact, setNomContact] = useState('');
  const [numeroContact, setNumeroContact] = useState('');

  useEffect(() => {
    setContactsPerso(voyage?.contactsUrgence || []);
  }, [voyage?.id, voyage?.contactsUrgence]);

  if (!voyage) return null;

  const paysDetecte = detecterPays(
    (voyage.isMultiDest && voyage.destinations?.[0]?.nom) || voyage.nom
  );

  const sauvegarderContacts = async (nouvelleListe) => {
    setContactsPerso(nouvelleListe);
    try {
      await updateDoc(doc(db, 'voyages', voyage.id), { contactsUrgence: nouvelleListe });
    } catch (error) {
      console.error("Erreur d'enregistrement des contacts.", error);
    }
  };

  const ajouterContact = (e) => {
    e.preventDefault();
    if (!nomContact.trim() || !numeroContact.trim()) return;
    sauvegarderContacts([...contactsPerso, { id: Date.now().toString(36), nom: nomContact.trim(), numero: numeroContact.trim() }]);
    setNomContact('');
    setNumeroContact('');
  };

  const retirerContact = (id) => {
    sauvegarderContacts(contactsPerso.filter((c) => c.id !== id));
  };

  const carteNumero = (label, numero, couleur, bg) => (
    <a
      href={`tel:${numero}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
        backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E8DFCF',
        textDecoration: 'none', marginBottom: '10px'
      }}
    >
      <div style={{ backgroundColor: bg, color: couleur, width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <IconPhone size={19} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', color: '#8A7B68', fontWeight: '700' }}>{label}</div>
        <div style={{ fontSize: '19px', color: '#2B2420', fontWeight: '800' }}>{numero}</div>
      </div>
    </a>
  );

  return (
    <div style={{ padding: '15px 15px 30px 15px', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab && setActiveTab('gestion')}
          style={{ border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <IconArrowLeft size={18} color="#2B2420" />
        </button>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>Fiche d'urgence</h2>
      </div>

      {paysDetecte ? (
        <>
          <p style={{ margin: '0 0 12px 4px', fontSize: '13px', fontWeight: '800', color: '#8A7B68' }}>
            🚨 {paysDetecte.pays.toUpperCase()}
          </p>
          {carteNumero('Numéro d\'urgence général', paysDetecte.general, '#B3453A', '#F8EFF2')}
          {paysDetecte.police !== paysDetecte.general && carteNumero('Police', paysDetecte.police, '#6E8AA6', '#EEF2F0')}
          {paysDetecte.ambulance !== paysDetecte.general && carteNumero('Ambulance', paysDetecte.ambulance, '#B3453A', '#F8EFF2')}
          {paysDetecte.pompiers !== paysDetecte.general && paysDetecte.pompiers !== paysDetecte.ambulance && carteNumero('Pompiers', paysDetecte.pompiers, '#F59E0B', '#FBF3E3')}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px 14px', backgroundColor: '#FBF3E3', borderRadius: '12px', marginBottom: '20px', marginTop: '4px' }}>
            <IconAlertTriangle size={15} color="#B8863C" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, fontSize: '11.5px', color: '#8A7B68', lineHeight: '1.5' }}>
              Numéros détectés automatiquement à partir du nom du voyage — vérifie-les avant de partir, ils peuvent changer.
            </p>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px 16px', backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px dashed #E8DFCF', marginBottom: '20px' }}>
          <IconShieldCheck size={20} color="#B5A793" style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: '13px', color: '#8A7B68', lineHeight: '1.5' }}>
            Pays non reconnu automatiquement à partir du nom du voyage. Ajoute les numéros d'urgence toi-même ci-dessous.
          </p>
        </div>
      )}

      <p style={{ margin: '0 0 12px 4px', fontSize: '13px', fontWeight: '800', color: '#8A7B68' }}>MES CONTACTS</p>

      {contactsPerso.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
          {contactsPerso.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '12px', padding: '10px 12px' }}>
              <a href={`tel:${c.numero}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#2B2420' }}>{c.nom}</div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#6E8AA6' }}>{c.numero}</div>
              </a>
              <button onClick={() => retirerContact(c.id)} style={{ border: 'none', background: 'none', color: '#D9CDB8', cursor: 'pointer', padding: '4px', flexShrink: 0 }}>
                <IconTrash size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={ajouterContact} style={{ display: 'flex', gap: '6px' }}>
        <input
          type="text"
          placeholder="Nom (ex: Assurance voyage)"
          value={nomContact}
          onChange={(e) => setNomContact(e.target.value)}
          style={{ flex: 1, minWidth: 0, padding: '12px 12px', borderRadius: '12px', border: '1px solid #E8DFCF', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <input
          type="tel"
          placeholder="Numéro"
          value={numeroContact}
          onChange={(e) => setNumeroContact(e.target.value)}
          style={{ flex: '0 0 110px', minWidth: 0, padding: '12px 10px', borderRadius: '12px', border: '1px solid #E8DFCF', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <button type="submit" style={{ flexShrink: 0, width: '42px', border: 'none', backgroundColor: '#2B2420', color: '#FFF', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconPlus size={18} />
        </button>
      </form>
      <p style={{ margin: '8px 0 0 4px', fontSize: '11px', color: '#B5A793' }}>
        ex: assurance voyage, ambassade, allergies/groupe sanguin, contact famille
      </p>
    </div>
  );
}
