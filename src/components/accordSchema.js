// =====================================================================
// SCHÉMA DE L'ACCORD DE COHABITATION — version courte.
// Environ 40 questions, sans l'argent (tout est dans « Budget commun »).
// Pour modifier une question ou une option, c'est ici.
// =====================================================================

// --- Constantes gardées pour AccordCohabitation.jsx (calcul du loyer, plus utilisé) ---
export const LOYER_NET = 2050;
export const PARKING_P1 = 150;
export const PARKING_P2 = 100;

export const chf = (n) =>
  Number(n).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export function calcParts(a, b) {
  const A = num(a);
  const B = num(b);
  const total = A + B;
  if (total <= 0) return null;
  return { total, p1: (A / total) * 100, p2: (B / total) * 100 };
}

export const CALCULS = {};

// --- Petits constructeurs ---
const info = (texte) => ({ type: 'info', texte });
const texte = (id, label, placeholder) => ({ id, type: 'texte', label, placeholder });
const long = (id, label, placeholder) => ({ id, type: 'long', label, placeholder });
const nombre = (id, label, unite) => ({ id, type: 'nombre', label, unite });
const choix = (id, label, options) => ({ id, type: 'choix', label, options });
const cases = (id, label, options) => ({ id, type: 'cases', label, options });

const TACHES = [
  'cuisiner',
  'courses',
  'vaisselle',
  'lessive et repassage',
  'aspirateur et sols',
  'salle de bain et WC',
  'poubelles',
  'chats (litière, croquettes)',
  'papiers et factures'
];

export const SECTIONS = [
  // ===================================================================
  {
    id: 's5',
    titre: 'Notre logement',
    emoji: '🏠',
    intro:
      'P1 = la titulaire du bail, avec ses 2 chats. P2 = celle qui emménage. L’argent (loyer, charges, courses) se gère dans « Budget commun », pas ici.',
    blocs: [
      {
        titre: 'Espace et affaires',
        champs: [
          long('garder', 'Mes affaires qui viennent du studio : ce que je garde, ce que je vends ou donne'),
          texte('coinP1', 'Un coin rien qu’à moi, c’est…'),
          nombre('seuleHeures', 'Temps seule à la maison dont j’ai besoin par semaine', 'heures')
        ]
      },
      {
        titre: 'Invités et famille',
        champs: [
          choix('impro', 'Amis à l’improviste', ['oui', 'il faut prévenir à l’avance', 'jamais en semaine']),
          choix('dorment', 'Invités qui dorment chez nous', ['non (trop petit)', 'oui, d’accord toutes les deux', 'canapé seulement']),
          choix('regleFamille', 'Visites de la famille', ['chacune gère sa famille', 'on décide ensemble à chaque fois'])
        ]
      },
      {
        titre: 'Bruit et télétravail',
        champs: [
          cases('bruitRegles', 'Nos règles de bruit', [
            'musique et TV au casque après une heure fixe',
            'pas de lessive ni d’aspirateur tard le soir',
            'pas d’appel vidéo à voix haute dans le salon',
            'le matin, la première levée fait attention au bruit'
          ]),
          nombre('teletravail', 'Jours de télétravail par semaine', 'jours'),
          texte('nePasDeranger', 'Heures « ne pas déranger » (visios, appels)')
        ]
      },
      {
        titre: 'Les chats',
        champs: [
          info('La litière reste la responsabilité de P1, puisque ce sont ses chats. La question est ce qui se passe quand P1 est absente ou très fatiguée. À remplir par P2, en toute franchise.'),
          choix('litiere', 'Réponse de P2', [
            'Oui, je la fais sans problème',
            'Oui, quand P1 me le demande clairement',
            'Non, pas la litière. On trouve autre chose',
            'À essayer un temps, puis on en reparle'
          ]),
          choix('chatsChambre', 'Chats dans la chambre la nuit', ['oui', 'non', 'porte fermée'])
        ]
      }
    ]
  },

  // ===================================================================
  {
    id: 's2',
    titre: 'Tâches et ménage',
    emoji: '🧹',
    intro: 'On met à plat qui fait quoi, simplement, pour que ça reste juste pour les deux.',
    blocs: [
      {
        champs: [
          cases('aime', 'Les tâches que j’aime bien ou que ça ne me dérange pas de faire', TACHES),
          cases('deteste', 'Les tâches que j’aime vraiment pas', TACHES),
          choix('repartition', 'Notre façon de se répartir', [
            'chacune ses tâches fixes',
            'à tour de rôle',
            'on décide chaque semaine'
          ]),
          choix('standard', 'Mon niveau de propreté', ['1 : rangé suffit', '2 : propre', '3 : impeccable']),
          choix('outil', 'Pour ne rien oublier', ['liste partagée sur le téléphone', 'tableau sur le frigo', 'agenda partagé']),
          texte('jourPoint', 'Un point de 15 minutes par semaine : quel jour ?'),
          choix('regleOr', 'Si une de nous est plus exigeante que l’autre', [
            'la plus exigeante fait elle-même la différence',
            'on se rejoint au milieu',
            'on délègue (aide ménagère)'
          ])
        ]
      }
    ]
  },

  // ===================================================================
  {
    id: 's3',
    titre: 'Quand on est fatiguées',
    emoji: '🔋',
    intro: 'Quand on est à plat toutes les deux, on garde le minimum, on reporte le reste et on le dit sans reproche.',
    blocs: [
      {
        champs: [
          cases('minimum', 'Le minimum, même épuisées', [
            'chats : croquettes, eau et litière',
            'un repas simple',
            'lave-vaisselle lancé',
            'poubelle sortie'
          ]),
          cases('reporter', 'Ce qu’on peut reporter sans culpabiliser', [
            'aspirateur',
            'salle de bain à fond',
            'repassage',
            'rangement et tri',
            'courrier non urgent'
          ]),
          cases('secours', 'Plan de secours', [
            'plats au congélateur',
            'livraison ou plat à emporter',
            'aide ménagère ponctuelle',
            'un proche donne un coup de main'
          ]),
          texte('phraseCode', 'Notre phrase code pour dire « je suis à plat »', 'ex : « mode économie d’énergie »'),
          texte('reponseCode', 'La réponse de l’autre', 'ex : « je prends le minimum »')
        ]
      }
    ]
  },

  // ===================================================================
  {
    id: 's6',
    titre: 'Vie de couple',
    emoji: '💞',
    intro: 'Vivre ensemble ne doit pas manger le couple : on garde du temps à deux et du temps pour soi.',
    blocs: [
      {
        champs: [
          nombre('soireesDeux', 'Soirées à deux souhaitées par semaine', 'soirées'),
          nombre('soireesSeule', 'Soirées seule ou entre amis par semaine', 'soirées'),
          cases('rituels', 'Nos rituels', [
            'un repas ensemble par jour sans téléphone',
            'une soirée à deux fixe',
            'un week-end sans programme par mois',
            'une sortie à deux par mois'
          ]),
          long('sentirAimee', 'Ce qui me fait me sentir aimée'),
          choix('grossesDec', 'Les grosses décisions (achat, déménagement, travail, voyage)', [
            'on décide à deux, accord des deux nécessaire',
            'la personne la plus concernée tranche après avoir écouté'
          ]),
          choix('vacSep', 'Vacances séparées', ['oui', 'non', 'à voir']),
          choix('noel', 'Fêtes de fin d’année 2026', ['chez nous', 'famille P1', 'famille P2', 'chacune dans sa famille', 'on décide plus tard']),
          long('compteFetes', 'Ce qui compte vraiment pour moi pendant les fêtes')
        ]
      }
    ]
  },

  // ===================================================================
  {
    id: 's7',
    titre: 'Disputes',
    emoji: '🕊️',
    intro: 'On se dispute forcément. Ce qui compte, c’est d’avoir des règles pour traverser la dispute. On les pose maintenant, à tête reposée.',
    blocs: [
      {
        champs: [
          cases('declencheurs7', 'Ce qui me met le plus en colère', [
            'le ton de la voix',
            'être coupée',
            'le silence qui dure',
            'les reproches du passé',
            'le désordre',
            'devoir tout rappeler',
            'le téléphone pendant qu’on parle'
          ]),
          cases('reaction', 'Ma façon de réagir quand ça monte', ['je hausse le ton', 'je me tais', 'je pars', 'je pleure', 'je fais des reproches']),
          long('besoinDispute', 'Ce dont j’ai besoin pendant une dispute'),
          cases('regles72', 'Nos règles', [
            'pas d’insultes, pas de mots définitifs',
            'un sujet à la fois, sans ressortir le passé',
            'pas de dispute par message',
            'on reporte si l’une a faim, est épuisée ou doit partir travailler'
          ]),
          texte('motPause', 'Notre mot ou geste pour demander une pause'),
          choix('pauseDuree', 'Durée de la pause', ['20 minutes', '1 heure', 'jusqu’au lendemain']),
          cases('geste', 'Notre geste de réparation', ['un câlin', 'un thé ensemble', 'une promenade', 'un mot écrit']),
          info('Une dispute ne doit jamais faire peur : ni coups, ni menaces, ni contrôle, ni humiliation répétée. Si cela arrive, la personne qui a peur peut partir tout de suite. En cas de danger : 117 (police), 144 (ambulance), 142 (aide aux victimes, jour et nuit, gratuit).')
        ]
      }
    ]
  },

  // ===================================================================
  {
    id: 's8',
    titre: 'Si ça ne marche pas',
    emoji: '🧳',
    intro: 'Y penser maintenant, quand tout va bien, permet de se quitter sans se détruire.',
    blocs: [
      {
        champs: [
          choix('preavis', 'Préavis entre nous', ['1 mois', '2 mois', '3 mois']),
          choix('resteLogement', 'Qui reste dans le logement', [
            'P1 reste (titulaire du bail, avec les chats) et P2 déménage',
            'on rend le logement ensemble',
            'à voir selon la régie et le bail'
          ]),
          choix('chatsRevoir', 'P2 peut revoir les chats', ['oui', 'non', 'à voir']),
          cases('aidePratique', 'Aide pour se reloger', [
            'on cherche ensemble les annonces',
            'une journée de déménagement avec aide',
            'stockage temporaire des affaires',
            'un coup de pouce financier (à voir dans Budget commun)'
          ]),
          choix('contact', 'Après la séparation', ['pause totale', 'uniquement pour l’administratif', 'on reste en contact amical', 'à voir']),
          info('En concubinage, la loi ne prévoit pas de règles de partage comme pour le mariage : ce document est un accord entre nous. Pour les points importants, une consultation juridique donne un cadre plus solide.')
        ]
      }
    ]
  },

  // ===================================================================
  {
    id: 's9',
    titre: 'Révision',
    emoji: '✍️',
    intro: 'On relit cet accord régulièrement pour le garder juste quand nos vies changent.',
    blocs: [
      {
        champs: [
          choix('frequence', 'On le relit', ['tous les 3 mois', 'tous les 6 mois', 'une fois par an']),
          cases('revisionTout', 'On le révise tout de suite si', [
            'un revenu change',
            'l’une change de travail ou d’horaires',
            'le logement change',
            'l’une se sent débordée ou injuste'
          ]),
          long('marche', 'Ce qui marche bien'),
          long('coince', 'Ce qui coince')
        ]
      }
    ]
  }
];

export const NOMS_DEFAUT = { P1: '', P2: '' };

export function modeleParDefaut() {
  return JSON.parse(JSON.stringify({ noms: NOMS_DEFAUT, sections: SECTIONS }));
}
