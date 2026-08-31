import React, { useMemo, useState, useEffect } from 'react';
// Import défensif : si "storage" n'est pas (encore) exporté par ../firebase,
// un import nommé classique ferait planter le chargement de TOUTE l'app
// (page blanche). L'import en namespace évite ce risque — l'app se charge
// normalement, seul l'upload de photo réclamera "storage" une fois utilisé.
import { db } from '../firebase';
import * as firebaseModule from '../firebase';
const storage = firebaseModule.storage;
import {
  collection, onSnapshot, addDoc, updateDoc, doc, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  IconArrowLeft, IconPlus, IconX, IconCamera, IconExternalLink, IconCheck
} from '@tabler/icons-react';

/*
  SpotsPhoto.jsx — module "Spots Photo" pour Les Nomades
  -------------------------------------------------------
  Module global (comme Papilles Nomades / Perso), choisi depuis l'écran
  d'accueil et non lié à un voyage précis — au fil de vos différents
  voyages, vous cochez les spots visités.

  Collection Firestore partagée : "nomadeSpotsPhoto"
    { nom, commune, canton, categorie, adresse, lienInspo, statut,
      photoUrl, dateVisite, notes, origine, createdBy }

  Au tout premier chargement (collection vide), la liste officielle des 87
  Photo Spots du Grand Tour of Switzerland est importée automatiquement en
  base via un writeBatch — ensuite tout passe par Firestore normalement.

  Suppose que `storage` est exporté depuis ../firebase.js, comme utilisé
  par Galerie.jsx pour l'upload de photos. Si ce n'est pas le cas, il
  suffit d'y ajouter : export const storage = getStorage(app);
*/

const SPOTS_OFFICIELS_SEED = [
  { id: "1", nom: "Bernina Glaciers", commune: "Pontresina", canton: "GR", categorie: "glacier", adresse: "Pontresina", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-bernina-glaciers/", origine: "base", statut: "a_faire" },
  { id: "2", nom: "Genève", commune: "Genève", canton: "GE", categorie: "ville", adresse: "Genève", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-geneva/", origine: "base", statut: "a_faire" },
  { id: "3", nom: "Monte Ceneri", commune: "Rivera", canton: "TI", categorie: "montagne", adresse: "Piazza Ticino, Rivera", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-monte-ceneri/", origine: "base", statut: "a_faire" },
  { id: "4", nom: "Niederhorn", commune: "Niederhorn", canton: "BE", categorie: "montagne", adresse: "Niederhorn", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-niederhorn/", origine: "base", statut: "a_faire" },
  { id: "5", nom: "Höhematte Interlaken", commune: "Interlaken", canton: "BE", categorie: "ville", adresse: "Höhematte, Interlaken", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-hoehematte-interlaken/", origine: "base", statut: "a_faire" },
  { id: "6", nom: "Mendrisio", commune: "Mendrisio", canton: "TI", categorie: "ville", adresse: "La Torre, Mendrisio", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-mendrisiotto/", origine: "base", statut: "a_faire" },
  { id: "7", nom: "Sion", commune: "Sion / Sitten", canton: "VS", categorie: "ville", adresse: "Bisse du Montorge, Sion", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-sion/", origine: "base", statut: "a_faire" },
  { id: "8", nom: "Saint-Ursanne", commune: "Saint-Ursanne", canton: "JU", categorie: "village", adresse: "Pont Saint-Jean Népomucène, Saint-Ursanne", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-saint-ursanne/", origine: "base", statut: "a_faire" },
  { id: "9", nom: "Lucerne (Château Gütsch)", commune: "Lucerne", canton: "LU", categorie: "ville", adresse: "Château Gütsch, Lucerne", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-lucerne/", origine: "base", statut: "a_faire" },
  { id: "10", nom: "CabriO Stanserhorn", commune: "Stans", canton: "NW", categorie: "montagne", adresse: "Stanserhorn, Stans", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-cabrio-stanserhorn/", origine: "base", statut: "a_faire" },
  { id: "11", nom: "Les sept Churfirsten", commune: "Wildhaus", canton: "SG", categorie: "montagne", adresse: "Wildhaus", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-the-seven-churfirsten/", origine: "base", statut: "a_faire" },
  { id: "12", nom: "Château de Hünegg", commune: "Hilterfingen-Hünibach", canton: "BE", categorie: "chateau", adresse: "Hilterfingen-Hünibach", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-huenegg-castle/", origine: "base", statut: "a_faire" },
  { id: "13", nom: "Gorges de la Viamala", commune: "Thusis", canton: "GR", categorie: "nature", adresse: "Thusis", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-viamala-gorge/", origine: "base", statut: "a_faire" },
  { id: "14", nom: "Fribourg", commune: "Fribourg", canton: "FR", categorie: "ville", adresse: "Cathédrale Saint-Nicolas, Fribourg", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-fribourg/", origine: "base", statut: "a_faire" },
  { id: "15", nom: "Lac de Constance – région Obersee", commune: "Altnau", canton: "TG", categorie: "lac", adresse: "Altnau", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-lake-constance-obersee-region/", origine: "base", statut: "a_faire" },
  { id: "16", nom: "Romanshorn", commune: "Romanshorn", canton: "TG", categorie: "lac", adresse: "Romanshorn", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-romanshorn/", origine: "base", statut: "a_faire" },
  { id: "17", nom: "San Bernardino", commune: "San Bernardino", canton: "GR", categorie: "montagne", adresse: "Col du San Bernardino", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-san-bernardino/", origine: "base", statut: "a_faire" },
  { id: "18", nom: "Monte Generoso", commune: "Mendrisiotto", canton: "TI", categorie: "montagne", adresse: "Monte Generoso, Mendrisiotto", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-monte-generoso/", origine: "base", statut: "a_faire" },
  { id: "19", nom: "Rolle", commune: "Rolle", canton: "VD", categorie: "lac", adresse: "Île de La Harpe, Rolle", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-rolle/", origine: "base", statut: "a_faire" },
  { id: "20", nom: "Tour de Hospental", commune: "Hospental", canton: "UR", categorie: "village", adresse: "Hospental", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-hospental/", origine: "base", statut: "a_faire" },
  { id: "21", nom: "Bellinzona", commune: "Bellinzona", canton: "TI", categorie: "ville", adresse: "Castello di Montebello, Bellinzona", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-bellinzona/", origine: "base", statut: "a_faire" },
  { id: "22", nom: "Bac du lac des Quatre-Cantons", commune: "Beckenried", canton: "NW", categorie: "lac", adresse: "Beckenried", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-lake-lucerne-car-ferry/", origine: "base", statut: "a_faire" },
  { id: "23", nom: "Cervin, vue Sunnegga", commune: "Zermatt", canton: "VS", categorie: "montagne", adresse: "Sunnegga-Rothorn, Zermatt", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-matterhorn/", origine: "base", statut: "a_faire" },
  { id: "24", nom: "Obermutten", commune: "Obermutten", canton: "GR", categorie: "village", adresse: "Obermutten", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-obermutten/", origine: "base", statut: "a_faire" },
  { id: "25", nom: "Rapperswil-Jona", commune: "Rapperswil-Jona", canton: "SG", categorie: "ville", adresse: "Rapperswil-Jona", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-rapperswil-jona/", origine: "base", statut: "a_faire" },
  { id: "26", nom: "Lac des Quatre-Cantons", commune: "Brunnen", canton: "SZ", categorie: "lac", adresse: "Brunnen", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-lake-lucerne/", origine: "base", statut: "a_faire" },
  { id: "27", nom: "Groupe du Weisshorn", commune: "Grächen", canton: "VS", categorie: "montagne", adresse: "Hannigalp, Grächen", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-weisshorn-group/", origine: "base", statut: "a_faire" },
  { id: "28", nom: "Rheinfelden", commune: "Rheinfelden", canton: "AG", categorie: "ville", adresse: "Rheinfelden", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-rheinfelden/", origine: "base", statut: "a_faire" },
  { id: "29", nom: "Abbaye d'Einsiedeln", commune: "Einsiedeln", canton: "SZ", categorie: "autre", adresse: "Einsiedeln", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-einsiedeln-abbey/", origine: "base", statut: "a_faire" },
  { id: "30", nom: "Furka", commune: "Münster (Goms)", canton: "VS", categorie: "montagne", adresse: "Col de la Furka", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-furka/", origine: "base", statut: "a_faire" },
  { id: "31", nom: "Lindt Home of Chocolate", commune: "Lac de Zurich (Kilchberg)", canton: "ZH", categorie: "autre", adresse: "Lindt Home of Chocolate", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-lindt-home-of-chocolate/", origine: "base", statut: "a_faire" },
  { id: "32", nom: "Gstaad Saanenland", commune: "Gstaad", canton: "BE", categorie: "montagne", adresse: "Gstaad", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-gstaad-saanenland/", origine: "base", statut: "a_faire" },
  { id: "33", nom: "Grottes de St-Béat", commune: "Interlaken", canton: "BE", categorie: "nature", adresse: "St. Beatus-Höhlen, lac de Thoune", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-st-beatus-caves/", origine: "base", statut: "a_faire" },
  { id: "34", nom: "Bâle", commune: "Bâle", canton: "BS", categorie: "ville", adresse: "Bâle", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-basel/", origine: "base", statut: "a_faire" },
  { id: "35", nom: "Creux du Van", commune: "Brot-Dessus", canton: "NE", categorie: "nature", adresse: "Noiraigue / Brot-Dessus", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-creux-du-van/", origine: "base", statut: "a_faire" },
  { id: "36", nom: "Ballenberg", commune: "Hofstetten bei Brienz", canton: "BE", categorie: "autre", adresse: "Musée Ballenberg, Hofstetten", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-ballenberg/", origine: "base", statut: "a_faire" },
  { id: "37", nom: "Lac Léman", commune: "Coppet", canton: "VD", categorie: "lac", adresse: "Coppet", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-lake-geneva/", origine: "base", statut: "a_faire" },
  { id: "38", nom: "Lac de Constance – région Untersee", commune: "Salenstein", canton: "TG", categorie: "lac", adresse: "Château d'Arenenberg, Salenstein", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-lake-constance-untersee-region/", origine: "base", statut: "a_faire" },
  { id: "39", nom: "Emmental", commune: "Affoltern i.E.", canton: "BE", categorie: "village", adresse: "Affoltern im Emmental", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-emmental/", origine: "base", statut: "a_faire" },
  { id: "40", nom: "Fully, Combe d'Enfer", commune: "Fully", canton: "VS", categorie: "nature", adresse: "Combe d'Enfer, Fully", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/fully-photo-spot/", origine: "base", statut: "a_faire" },
  { id: "41", nom: "Säntis", commune: "Säntis", canton: "AI", categorie: "montagne", adresse: "Schwägalp-Säntis", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-saentis/", origine: "base", statut: "a_faire" },
  { id: "42", nom: "La Punt", commune: "La Punt", canton: "GR", categorie: "village", adresse: "Chesa Merleda, La Punt", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-la-punt/", origine: "base", statut: "a_faire" },
  { id: "43", nom: "Fromagerie de démonstration d'Appenzell", commune: "Stein AR", canton: "AR", categorie: "autre", adresse: "Appenzeller Schaukäserei, Stein AR", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-appenzell-show-dairy/", origine: "base", statut: "a_faire" },
  { id: "44", nom: "Château de Hallwyl", commune: "Seengen", canton: "AG", categorie: "chateau", adresse: "Seengen", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-hallwyl-castle/", origine: "base", statut: "a_faire" },
  { id: "45", nom: "Spiez", commune: "Spiez", canton: "BE", categorie: "lac", adresse: "Château de Spiez, lac de Thoune", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-spiez/", origine: "base", statut: "a_faire" },
  { id: "46", nom: "Rigi", commune: "Vitznau", canton: "LU", categorie: "montagne", adresse: "Gare bateau, Vitznau", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-rigi/", origine: "base", statut: "a_faire" },
  { id: "47", nom: "Aarburg", commune: "Aarburg", canton: "AG", categorie: "village", adresse: "Aarburg", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-aarburg/", origine: "base", statut: "a_faire" },
  { id: "48", nom: "Muottas Muragl", commune: "Samedan", canton: "GR", categorie: "montagne", adresse: "Muottas Muragl, Samedan", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-muottas-muragl/", origine: "base", statut: "a_faire" },
  { id: "49", nom: "Grottes de Vallorbe", commune: "Vallorbe", canton: "VD", categorie: "nature", adresse: "Grottes de Vallorbe", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-caves-of-vallorbe/", origine: "base", statut: "a_faire" },
  { id: "50", nom: "St. Moritz", commune: "St. Moritz", canton: "GR", categorie: "ville", adresse: "St. Moritz", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-engadine-st-moritz/", origine: "base", statut: "a_faire" },
  { id: "51", nom: "Davos Klosters", commune: "Davos", canton: "GR", categorie: "montagne", adresse: "Col de la Flüela, Davos", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-davos-klosters/", origine: "base", statut: "a_faire" },
  { id: "52", nom: "Grosser Mythen", commune: "Rickenbach b. Schwyz", canton: "SZ", categorie: "montagne", adresse: "Rickenbach bei Schwyz", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-grosser-mythen/", origine: "base", statut: "a_faire" },
  { id: "53", nom: "Stäfa", commune: "Stäfa", canton: "ZH", categorie: "lac", adresse: "Port d'Ötikon, Stäfa", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-staefa/", origine: "base", statut: "a_faire" },
  { id: "54", nom: "Niesen", commune: "Niesen", canton: "BE", categorie: "montagne", adresse: "Niesen Kulm", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-niesen/", origine: "base", statut: "a_faire" },
  { id: "55", nom: "Chutes du Rhin", commune: "Dachsen", canton: "ZH", categorie: "nature", adresse: "Rheinfall, Dachsen", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-rhine-falls/", origine: "base", statut: "a_faire" },
  { id: "56", nom: "Badhütte Rorschach", commune: "Rorschach", canton: "SG", categorie: "lac", adresse: "Rorschach", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-badhuette-rorschach/", origine: "base", statut: "a_faire" },
  { id: "57", nom: "Monte San Giorgio", commune: "Bissone", canton: "TI", categorie: "montagne", adresse: "Bissone", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-monte-san-giorgio/", origine: "base", statut: "a_faire" },
  { id: "58", nom: "Château de Wyher", commune: "Ettiswil", canton: "LU", categorie: "chateau", adresse: "Ettiswil", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/wyher-moated-castle-1/", origine: "base", statut: "a_faire" },
  { id: "59", nom: "Lavaux", commune: "Chexbres", canton: "VD", categorie: "village", adresse: "Terrasses de Lavaux, Chexbres", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-lavaux/", origine: "base", statut: "a_faire" },
  { id: "60", nom: "Bettmeralp - Aletsch Arena", commune: "Bettmeralp", canton: "VS", categorie: "glacier", adresse: "Chapelle Maria zum Schnee, Bettmeralp", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-bettmeralp/", origine: "base", statut: "a_faire" },
  { id: "61", nom: "Thoune", commune: "Thoune", canton: "BE", categorie: "ville", adresse: "Château de Thoune", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-thun/", origine: "base", statut: "a_faire" },
  { id: "62", nom: "Gornergrat - Cervin", commune: "Zermatt", canton: "VS", categorie: "montagne", adresse: "Gornergrat, Zermatt", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-gornergrat-matterhorn/", origine: "base", statut: "a_faire" },
  { id: "63", nom: "Swissminiatur", commune: "Melide", canton: "TI", categorie: "autre", adresse: "Melide, lac de Lugano", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-swissminiatur/", origine: "base", statut: "a_faire" },
  { id: "64", nom: "Parco San Michele", commune: "Lugano", canton: "TI", categorie: "ville", adresse: "Parco San Michele, Lugano", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-parco-san-michele/", origine: "base", statut: "a_faire" },
  { id: "65", nom: "Grand glacier d'Aletsch", commune: "Eggishorn", canton: "VS", categorie: "glacier", adresse: "Point de vue Eggishorn", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-great-aletsch-glacier/", origine: "base", statut: "a_faire" },
  { id: "66", nom: "Alpstein", commune: "Brülisau", canton: "AI", categorie: "montagne", adresse: "Hoher Kasten, Brülisau", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-alpstein/", origine: "base", statut: "a_faire" },
  { id: "67", nom: "Cardada", commune: "Orselina", canton: "TI", categorie: "montagne", adresse: "Cardada, Orselina", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-cardada/", origine: "base", statut: "a_faire" },
  { id: "68", nom: "St-Gall", commune: "St. Gallen", canton: "SG", categorie: "ville", adresse: "Drei Weieren, St. Gallen", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-st-gallen/", origine: "base", statut: "a_faire" },
  { id: "69", nom: "Maloja", commune: "Maloja", canton: "GR", categorie: "montagne", adresse: "Col de Maloja", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-maloja/", origine: "base", statut: "a_faire" },
  { id: "70", nom: "Gruyères", commune: "La Gruyère", canton: "FR", categorie: "village", adresse: "Château de Gruyères, La Gruyère", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-gruyeres/", origine: "base", statut: "a_faire" },
  { id: "71", nom: "Tremola", commune: "San Gottardo", canton: "TI", categorie: "montagne", adresse: "Route de la Tremola, col du Gothard", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-tremola/", origine: "base", statut: "a_faire" },
  { id: "72", nom: "Castel San Pietro", commune: "San Pietro", canton: "TI", categorie: "village", adresse: "Castel San Pietro", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-castel-san-pietro/", origine: "base", statut: "a_faire" },
  { id: "73", nom: "Maison de Heidi", commune: "Maienfeld", canton: "GR", categorie: "village", adresse: "Heididorf, Maienfeld", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-heidi-house/", origine: "base", statut: "a_faire" },
  { id: "74", nom: "Sommet du Pizol", commune: "Pizol", canton: "SG", categorie: "montagne", adresse: "Pizol", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-the-pizol-summit/", origine: "base", statut: "a_faire" },
  { id: "75", nom: "Stein am Rhein", commune: "Stein am Rhein", canton: "SH", categorie: "village", adresse: "Vieille ville, Stein am Rhein", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-stein-am-rhein/", origine: "base", statut: "a_faire" },
  { id: "76", nom: "Palais Stockalper", commune: "Brig", canton: "VS", categorie: "chateau", adresse: "Stockalperschloss, Brig", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-stockalper-palace/", origine: "base", statut: "a_faire" },
  { id: "77", nom: "Pyramides d'Euseigne", commune: "Hérémence", canton: "VS", categorie: "nature", adresse: "Euseigne, Hérémence", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-pyramides-euseigne/", origine: "base", statut: "a_faire" },
  { id: "78", nom: "Château de Burgdorf", commune: "Burgdorf", canton: "BE", categorie: "chateau", adresse: "Burgdorf", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-burgdorf/", origine: "base", statut: "a_faire" },
  { id: "79", nom: "Port de Morges", commune: "Morges", canton: "VD", categorie: "lac", adresse: "Morges", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-the-port-of-morges/", origine: "base", statut: "a_faire" },
  { id: "80", nom: "Pays-d'Enhaut", commune: "Château-d'Oex", canton: "VD", categorie: "montagne", adresse: "Réserve de La Pierreuse, Château-d'Oex", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-pays-denhaut/", origine: "base", statut: "a_faire" },
  { id: "81", nom: "Abbaye de Saint-Maurice", commune: "Saint-Maurice", canton: "VS", categorie: "autre", adresse: "Saint-Maurice", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-abbaye-de-saint-maurice/", origine: "base", statut: "a_faire" },
  { id: "82", nom: "Ascona", commune: "Ascona", canton: "TI", categorie: "village", adresse: "Promenade, Ascona", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-ascona/", origine: "base", statut: "a_faire" },
  { id: "83", nom: "Piz Bernina", commune: "Samedan", canton: "GR", categorie: "montagne", adresse: "Samedan", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-piz-bernina/", origine: "base", statut: "a_faire" },
  { id: "84", nom: "Landquart Fashion Outlet", commune: "Landquart", canton: "GR", categorie: "autre", adresse: "Landquart", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-landquart/", origine: "base", statut: "a_faire" },
  { id: "85", nom: "Erlach", commune: "Erlach", canton: "BE", categorie: "village", adresse: "Erlach, lac de Bienne", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-erlach/", origine: "base", statut: "a_faire" },
  { id: "86", nom: "Grange valaisanne du Goms", commune: "Reckingen", canton: "VS", categorie: "village", adresse: "Reckingen, Goms", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-valais-barn-im-goms/", origine: "base", statut: "a_faire" },
  { id: "87", nom: "Val Surses", commune: "Savognin / Bivio", canton: "GR", categorie: "montagne", adresse: "Val Surses (Savognin, Bivio)", lienInspo: "https://www.myswitzerland.com/en-ch/experiences/photo-spot-val-surses/", origine: "base", statut: "a_faire" },
];

const CATEGORIES = {
  village: { label: "Village", color: "#8A6D3B" },
  montagne: { label: "Montagne", color: "#3E5C4A" },
  lac: { label: "Lac", color: "#3D6E80" },
  glacier: { label: "Glacier", color: "#5A7A8C" },
  chateau: { label: "Château", color: "#6B5842" },
  ville: { label: "Ville", color: "#5C5548" },
  nature: { label: "Nature", color: "#4B6B4F" },
  autre: { label: "Autre", color: "#6E655C" },
};function fileToDataUrlPreview(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Badge({ children, color }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', backgroundColor: `${color}18`, color }}>
      {children}
    </span>
  );
}

function AddSpotModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ nom: '', commune: '', canton: '', categorie: 'village', adresse: '', lienInspo: '' });
  const [enregistrement, setEnregistrement] = useState(false);
  const peutEnregistrer = form.nom.trim() && form.commune.trim();

  const champ = { width: '100%', marginTop: '6px', padding: '11px 12px', borderRadius: '12px', border: '1px solid #E8DFCF', backgroundColor: '#F7F1E8', color: '#2B2420', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
  const label = { fontSize: '12.5px', color: '#8A7B68', fontWeight: '600' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(43,36,32,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 2000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#FFFFFF', borderRadius: '24px 24px 0 0', padding: '22px', width: '100%', maxWidth: '460px', maxHeight: '86vh', overflowY: 'auto', fontFamily: 'inherit' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#2B2420' }}>Ajouter un spot</h3>
          <button onClick={onClose} aria-label="Fermer" style={{ border: 'none', backgroundColor: '#F1E8D8', color: '#8A7B68', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconX size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={label}>Nom du spot</label>
            <input style={champ} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex: Pont suspendu de Tibet" />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={label}>Commune</label>
              <input style={champ} value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} />
            </div>
            <div style={{ width: '90px' }}>
              <label style={label}>Canton</label>
              <input style={champ} value={form.canton} onChange={(e) => setForm({ ...form, canton: e.target.value })} placeholder="VS" />
            </div>
          </div>
          <div>
            <label style={label}>Catégorie</label>
            <select style={champ} value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
              {Object.entries(CATEGORIES).map(([key, c]) => <option key={key} value={key}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Adresse / point de vue</label>
            <input style={champ} value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          </div>
          <div>
            <label style={label}>Lien d'inspiration (optionnel)</label>
            <input style={champ} value={form.lienInspo} onChange={(e) => setForm({ ...form, lienInspo: e.target.value })} placeholder="https://..." />
          </div>
        </div>

        <button
          disabled={!peutEnregistrer || enregistrement}
          onClick={async () => {
            setEnregistrement(true);
            await onAdd({ ...form, origine: 'ajoute', statut: 'a_faire' });
            setEnregistrement(false);
          }}
          style={{ width: '100%', marginTop: '18px', padding: '15px', borderRadius: '14px', border: 'none', backgroundColor: '#2B2420', color: '#FFF', fontWeight: '800', fontSize: '15px', cursor: peutEnregistrer ? 'pointer' : 'default', opacity: peutEnregistrer ? 1 : 0.5, fontFamily: 'inherit' }}
        >
          {enregistrement ? 'Ajout...' : 'Ajouter'}
        </button>
      </div>
    </div>
  );
}

function MarkVisitedModal({ spot, onClose, onSave, monNom }) {
  const [photoUrl, setPhotoUrl] = useState(spot.photoUrl || null);
  const [previewLocal, setPreviewLocal] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dateVisite, setDateVisite] = useState(spot.dateVisite || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(spot.notes || '');
  const [enregistrement, setEnregistrement] = useState(false);

  const champ = { width: '100%', marginTop: '6px', padding: '11px 12px', borderRadius: '12px', border: '1px solid #E8DFCF', backgroundColor: '#F7F1E8', color: '#2B2420', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
  const label = { fontSize: '12.5px', color: '#8A7B68', fontWeight: '600' };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const previewData = await fileToDataUrlPreview(file);
      setPreviewLocal(previewData);
      const chemin = `nomadeSpotsPhoto/${spot.id}_${Date.now()}_${file.name}`;
      const refStockage = storageRef(storage, chemin);
      await uploadBytes(refStockage, file);
      const url = await getDownloadURL(refStockage);
      setPhotoUrl(url);
    } catch (error) {
      console.error("Erreur lors de l'upload de la photo :", error);
      alert("La photo n'a pas pu être envoyée. Réessayez.");
    } finally {
      setUploading(false);
    }
  };

  const photoAffichee = previewLocal || photoUrl;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(43,36,32,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 2000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#FFFFFF', borderRadius: '24px 24px 0 0', padding: '22px', width: '100%', maxWidth: '460px', maxHeight: '86vh', overflowY: 'auto', fontFamily: 'inherit' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#2B2420' }}>{spot.nom}</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#8A7B68' }}>{spot.commune}{spot.canton ? ` · ${spot.canton}` : ''}</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" style={{ border: 'none', backgroundColor: '#F1E8D8', color: '#8A7B68', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconX size={16} />
          </button>
        </div>

        {spot.lienInspo && (
          <a href={spot.lienInspo} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', color: '#B8863C', fontWeight: '700', margin: '8px 0 0 0', textDecoration: 'none' }}>
            Voir la fiche officielle <IconExternalLink size={13} />
          </a>
        )}

        <div style={{ margin: '16px 0' }}>
          {photoAffichee ? (
            <div style={{ position: 'relative' }}>
              <img src={photoAffichee} alt={spot.nom} style={{ width: '100%', height: '190px', objectFit: 'cover', borderRadius: '16px' }} />
              <label style={{ position: 'absolute', bottom: '10px', right: '10px', backgroundColor: 'rgba(255,255,255,0.92)', color: '#2B2420', fontSize: '12px', fontWeight: '700', padding: '7px 13px', borderRadius: '999px', cursor: 'pointer' }}>
                {uploading ? 'Envoi...' : 'Changer'}
                <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} disabled={uploading} />
              </label>
            </div>
          ) : (
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '160px', border: '2px dashed #D9CDB8', borderRadius: '16px', cursor: 'pointer', color: '#8A7B68', fontSize: '13px', fontWeight: '600' }}>
              <IconCamera size={26} color="#B5A793" />
              {uploading ? 'Envoi de la photo...' : 'Ajouter votre photo'}
              <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} disabled={uploading} />
            </label>
          )}
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={label}>Date de visite</label>
          <input type="date" style={champ} value={dateVisite} onChange={(e) => setDateVisite(e.target.value)} />
        </div>
        <div style={{ marginBottom: '4px' }}>
          <label style={label}>Notes</label>
          <textarea style={{ ...champ, resize: 'none' }} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="météo, monde sur place, meilleur moment..." />
        </div>

        <button
          disabled={enregistrement || uploading}
          onClick={async () => {
            setEnregistrement(true);
            await onSave({ statut: 'fait', photoUrl: photoUrl || null, dateVisite, notes, marquePar: monNom });
            setEnregistrement(false);
          }}
          style={{ width: '100%', marginTop: '16px', padding: '15px', borderRadius: '14px', border: 'none', backgroundColor: '#2B2420', color: '#FFF', fontWeight: '800', fontSize: '15px', cursor: 'pointer', opacity: (enregistrement || uploading) ? 0.6 : 1, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <IconCheck size={17} /> {enregistrement ? 'Enregistrement...' : 'Valider'}
        </button>
      </div>
    </div>
  );
}

export const SpotsPhoto = ({ utilisateur, onClose }) => {
  const [spots, setSpots] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState(null);
  const [vue, setVue] = useState('grille'); // 'grille' | 'tableau'
  const [filtreCanton, setFiltreCanton] = useState('');
  const [filtreCategorie, setFiltreCategorie] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [spotEnVisite, setSpotEnVisite] = useState(null);

  const monNom = utilisateur?.displayName || utilisateur?.email?.split('@')[0] || 'Vous';

  // Chargement + import initial de la liste officielle si la base est vide
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'nomadeSpotsPhoto'), async (snapshot) => {
      if (snapshot.empty) {
        try {
          const batch = writeBatch(db);
          SPOTS_OFFICIELS_SEED.forEach((s) => {
            const { id, ...donnees } = s;
            const ref = doc(collection(db, 'nomadeSpotsPhoto'));
            batch.set(ref, donnees);
          });
          await batch.commit();
        } catch (error) {
          console.error("Erreur lors de l'import initial des spots :", error);
          setErreurChargement(error?.message || String(error));
          setChargement(false);
        }
        return; // le prochain onSnapshot rechargera les données importées
      }
      const donnees = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      donnees.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      setSpots(donnees);
      setChargement(false);
    }, (error) => {
      console.error('Erreur de chargement des spots :', error);
      setErreurChargement(error?.message || String(error));
      setChargement(false);
    });
    return () => unsub();
  }, []);

  const cantons = useMemo(() => [...new Set(spots.map((s) => s.canton).filter(Boolean))].sort(), [spots]);

  const filtres = useMemo(() => spots.filter((s) =>
    (!filtreCanton || s.canton === filtreCanton) &&
    (!filtreCategorie || s.categorie === filtreCategorie) &&
    (!filtreStatut || s.statut === filtreStatut)
  ), [spots, filtreCanton, filtreCategorie, filtreStatut]);

  const nbFaits = spots.filter((s) => s.statut === 'fait').length;

  const ajouterSpot = async (donnees) => {
    try {
      await addDoc(collection(db, 'nomadeSpotsPhoto'), { ...donnees, createdBy: monNom, createdAt: serverTimestamp() });
      setShowAdd(false);
    } catch (error) {
      console.error("Erreur lors de l'ajout du spot :", error);
      alert("Le spot n'a pas pu être ajouté. Réessayez.");
    }
  };

  const enregistrerVisite = async (maj) => {
    try {
      await updateDoc(doc(db, 'nomadeSpotsPhoto', spotEnVisite.id), maj);
      setSpotEnVisite(null);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de la visite :", error);
      alert("La visite n'a pas pu être enregistrée. Réessayez.");
    }
  };

  const bouton = { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', color: '#2B2420', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', padding: '8px 13px', borderRadius: '999px', fontFamily: 'inherit' };
  const filtreSelect = { padding: '8px 12px', borderRadius: '999px', fontSize: '12.5px', border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', color: '#2B2420', fontFamily: 'inherit', fontWeight: '600' };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F1E8', fontFamily: "system-ui, -apple-system, sans-serif", paddingBottom: '40px' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap');`}</style>

      <div style={{ padding: 'calc(15px + env(safe-area-inset-top)) 15px 15px 15px', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid #E8DFCF' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onClose} aria-label="Retour" style={{ flexShrink: 0, width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '14px', color: '#2B2420', cursor: 'pointer' }}>
            <IconArrowLeft size={20} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>Spots Photo</h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#8A7B68', fontWeight: '600' }}>{nbFaits} / {spots.length || '...'} faits</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px 15px 0 15px' }}>
        {erreurChargement ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px solid #F0C9C9' }}>
            <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '800', color: '#B3453A' }}>Erreur de chargement</p>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#8A7B68', wordBreak: 'break-word' }}>{erreurChargement}</p>
          </div>
        ) : chargement ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#B5A793', fontSize: '13px', fontWeight: '600' }}>Chargement des spots...</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              <select style={filtreSelect} value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
                <option value="">Tous statuts</option>
                <option value="a_faire">À faire</option>
                <option value="fait">Fait</option>
              </select>
              <select style={filtreSelect} value={filtreCanton} onChange={(e) => setFiltreCanton(e.target.value)}>
                <option value="">Tous cantons</option>
                {cantons.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select style={filtreSelect} value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value)}>
                <option value="">Toutes catégories</option>
                {Object.entries(CATEGORIES).map(([key, c]) => <option key={key} value={key}>{c.label}</option>)}
              </select>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                <button style={bouton} onClick={() => setVue(vue === 'grille' ? 'tableau' : 'grille')}>
                  Vue {vue === 'grille' ? 'tableau' : 'grille'}
                </button>
                <button style={{ ...bouton, backgroundColor: '#B8863C', color: '#FFF', border: 'none' }} onClick={() => setShowAdd(true)}>
                  <IconPlus size={14} /> Ajouter
                </button>
              </div>
            </div>

            {vue === 'grille' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {filtres.map((spot) => {
                  const cat = CATEGORIES[spot.categorie] || {};
                  const fait = spot.statut === 'fait';
                  return (
                    <div key={spot.id} onClick={() => setSpotEnVisite(spot)} style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px solid #E8DFCF', overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ height: '110px', backgroundColor: '#F1E8D8', position: 'relative' }}>
                        {spot.photoUrl ? (
                          <img src={spot.photoUrl} alt={spot.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconCamera size={22} color="#D9CDB8" />
                          </div>
                        )}
                        {fait && (
                          <span style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: '#2B2420', color: '#FFF', fontSize: '10px', fontWeight: '800', padding: '3px 9px', borderRadius: '999px' }}>Fait</span>
                        )}
                      </div>
                      <div style={{ padding: '10px 12px 12px 12px' }}>
                        <Badge color={cat.color || '#8A7B68'}>{cat.label || spot.categorie}</Badge>
                        <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#2B2420', marginTop: '6px', lineHeight: '1.25' }}>{spot.nom}</div>
                        <div style={{ fontSize: '11.5px', color: '#8A7B68', marginTop: '2px' }}>{spot.commune}{spot.canton ? ` · ${spot.canton}` : ''}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px solid #E8DFCF', overflow: 'hidden' }}>
                {filtres.map((spot, i) => {
                  const cat = CATEGORIES[spot.categorie] || {};
                  const fait = spot.statut === 'fait';
                  return (
                    <div key={spot.id} onClick={() => setSpotEnVisite(spot)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', cursor: 'pointer', borderBottom: i < filtres.length - 1 ? '1px solid #F1E8D8' : 'none' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#2B2420' }}>{spot.nom}</div>
                        <div style={{ fontSize: '11.5px', color: '#8A7B68', marginTop: '2px' }}>{spot.commune}{spot.canton ? ` · ${spot.canton}` : ''} · {cat.label}</div>
                      </div>
                      <span style={{ fontSize: '11.5px', fontWeight: '700', color: fait ? '#3B6D11' : '#B5A793' }}>{fait ? 'Fait' : 'À faire'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {showAdd && <AddSpotModal onClose={() => setShowAdd(false)} onAdd={ajouterSpot} />}
      {spotEnVisite && (
        <MarkVisitedModal spot={spotEnVisite} onClose={() => setSpotEnVisite(null)} onSave={enregistrerVisite} monNom={monNom} />
      )}
    </div>
  );
};
