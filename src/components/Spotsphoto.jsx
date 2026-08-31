import React, { useMemo, useState } from "react";

/*
  SpotsPhoto.jsx — module "Grands Spots Photo Suisses" pour Les Nomades
  ------------------------------------------------------------------
  Intégration Firestore (à brancher, sur le modèle de Papilles Nomades / Galerie) :

    collection: "nomadeSpots" (partagée entre voyageurs, comme Papilles Nomades)
    doc shape:
      {
        nom: string,
        commune: string,
        canton: string,
        categorie: "village" | "montagne" | "lac" | "pont" | "glacier" | "chateau" | "ville",
        adresse: string,          // point de vue / adresse précise
        lienInspo?: string,       // photo de référence trouvée sur le net
        statut: "a_faire" | "fait",
        photoUrl?: string,        // notre photo, upload Firebase Storage (comme Galerie.jsx)
        dateVisite?: string,
        notes?: string,
        origine: "base" | "ajoute",
        createdBy?: string,
      }

  Ici : données en mémoire (useState) pour prototypage. Remplacer par
  onSnapshot(collection(db, "nomadeSpots")) + updateDoc / addDoc.
  L'upload photo est simulé en local (FileReader → dataURL) : à remplacer par
  uploadBytes(storageRef, file) puis getDownloadURL, exactement comme dans Galerie.jsx.
*/

// Liste officielle des Photo Spots du "Grand Tour of Switzerland" (myswitzerland.com),
// récupérée le 31.08.2026. lienInspo pointe vers la fiche officielle de chaque spot.
const SEED_SPOTS = [
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
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Badge({ children, color }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      {children}
    </span>
  );
}

function AddSpotModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    nom: "", commune: "", canton: "", categorie: "village", adresse: "", lienInspo: "",
  });

  const canSave = form.nom.trim() && form.commune.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-[#F4F5F1] w-full sm:max-w-md sm:rounded-lg rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-[#243228] mb-4">Ajouter un spot</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-[#5C6B60]">Nom du spot</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded border border-[#D3D8CE] bg-white text-[#243228] focus:outline-none focus:ring-2 focus:ring-[#3D6E80]"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="ex: Pont suspendu de Tibet"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-[#5C6B60]">Commune</label>
              <input
                className="w-full mt-1 px-3 py-2 rounded border border-[#D3D8CE] bg-white text-[#243228] focus:outline-none focus:ring-2 focus:ring-[#3D6E80]"
                value={form.commune}
                onChange={(e) => setForm({ ...form, commune: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-[#5C6B60]">Canton</label>
              <input
                className="w-full mt-1 px-3 py-2 rounded border border-[#D3D8CE] bg-white text-[#243228] focus:outline-none focus:ring-2 focus:ring-[#3D6E80]"
                value={form.canton}
                onChange={(e) => setForm({ ...form, canton: e.target.value })}
                placeholder="ex: VS"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-[#5C6B60]">Catégorie</label>
            <select
              className="w-full mt-1 px-3 py-2 rounded border border-[#D3D8CE] bg-white text-[#243228] focus:outline-none focus:ring-2 focus:ring-[#3D6E80]"
              value={form.categorie}
              onChange={(e) => setForm({ ...form, categorie: e.target.value })}
            >
              {Object.entries(CATEGORIES).map(([key, c]) => (
                <option key={key} value={key}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-[#5C6B60]">Adresse / point de vue</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded border border-[#D3D8CE] bg-white text-[#243228] focus:outline-none focus:ring-2 focus:ring-[#3D6E80]"
              value={form.adresse}
              onChange={(e) => setForm({ ...form, adresse: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-[#5C6B60]">Lien photo d'inspiration (optionnel)</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded border border-[#D3D8CE] bg-white text-[#243228] focus:outline-none focus:ring-2 focus:ring-[#3D6E80]"
              value={form.lienInspo}
              onChange={(e) => setForm({ ...form, lienInspo: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded text-[#5C6B60] hover:bg-[#E9EBE4]">
            Annuler
          </button>
          <button
            disabled={!canSave}
            onClick={() => canSave && onAdd({ ...form, origine: "ajoute", statut: "a_faire" })}
            className="px-4 py-2 rounded bg-[#3E5C4A] text-white disabled:opacity-40"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

function MarkVisitedModal({ spot, onClose, onSave }) {
  const [photoUrl, setPhotoUrl] = useState(spot.photoUrl || null);
  const [dateVisite, setDateVisite] = useState(spot.dateVisite || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(spot.notes || "");
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    // TODO: remplacer par upload Firebase Storage (voir Galerie.jsx) puis stocker l'URL retournée
    const dataUrl = await fileToDataUrl(file);
    setPhotoUrl(dataUrl);
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-[#F4F5F1] w-full sm:max-w-md sm:rounded-lg rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-[#243228] mb-1">{spot.nom}</h3>
        <p className="text-sm text-[#5C6B60] mb-4">{spot.commune} · {spot.canton}</p>

        <div className="mb-4">
          <label className="text-sm text-[#5C6B60] block mb-2">Notre photo</label>
          {photoUrl ? (
            <div className="relative">
              <img src={photoUrl} alt={spot.nom} className="w-full h-48 object-cover rounded-lg" />
              <label className="absolute bottom-2 right-2 bg-white/90 text-[#243228] text-xs px-3 py-1.5 rounded-full cursor-pointer shadow">
                Changer
                <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
              </label>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-[#C6CCBE] rounded-lg cursor-pointer text-[#5C6B60] hover:bg-[#E9EBE4]">
              {uploading ? "Import en cours..." : "+ Ajouter votre photo"}
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </label>
          )}
        </div>

        <div className="mb-3">
          <label className="text-sm text-[#5C6B60]">Date de visite</label>
          <input
            type="date"
            className="w-full mt-1 px-3 py-2 rounded border border-[#D3D8CE] bg-white text-[#243228] focus:outline-none focus:ring-2 focus:ring-[#3D6E80]"
            value={dateVisite}
            onChange={(e) => setDateVisite(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="text-sm text-[#5C6B60]">Notes</label>
          <textarea
            className="w-full mt-1 px-3 py-2 rounded border border-[#D3D8CE] bg-white text-[#243228] focus:outline-none focus:ring-2 focus:ring-[#3D6E80]"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="météo, monde sur place, meilleur moment de la journée..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded text-[#5C6B60] hover:bg-[#E9EBE4]">
            Annuler
          </button>
          <button
            onClick={() => onSave({ statut: "fait", photoUrl, dateVisite, notes })}
            className="px-4 py-2 rounded bg-[#3E5C4A] text-white"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SpotsPhoto() {
  const [spots, setSpots] = useState(SEED_SPOTS);
  const [view, setView] = useState("grille"); // "grille" | "tableau"
  const [filterCanton, setFilterCanton] = useState("");
  const [filterCategorie, setFilterCategorie] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [visitingSpot, setVisitingSpot] = useState(null);

  const cantons = useMemo(
    () => [...new Set(spots.map((s) => s.canton).filter(Boolean))].sort(),
    [spots]
  );

  const filtered = useMemo(() => {
    return spots.filter((s) =>
      (!filterCanton || s.canton === filterCanton) &&
      (!filterCategorie || s.categorie === filterCategorie) &&
      (!filterStatut || s.statut === filterStatut)
    );
  }, [spots, filterCanton, filterCategorie, filterStatut]);

  const doneCount = spots.filter((s) => s.statut === "fait").length;

  const handleAddSpot = (data) => {
    setSpots((prev) => [...prev, { ...data, id: String(Date.now()) }]);
    setShowAdd(false);
    // TODO: addDoc(collection(db, "nomadeSpots"), data)
  };

  const handleSaveVisit = (updates) => {
    setSpots((prev) =>
      prev.map((s) => (s.id === visitingSpot.id ? { ...s, ...updates } : s))
    );
    setVisitingSpot(null);
    // TODO: updateDoc(doc(db, "nomadeSpots", visitingSpot.id), updates)
  };

  return (
    <div className="min-h-screen bg-[#EDEFE8] font-sans">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="text-2xl font-semibold text-[#243228]">Spots Photo Suisses</h1>
          <span className="text-sm text-[#5C6B60]">{doneCount} / {spots.length} faits</span>
        </div>
        <p className="text-[#5C6B60] mb-5">Les grands classiques à capturer, un par un.</p>

        {/* Barre de filtres */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="px-3 py-1.5 rounded-full text-sm border border-[#D3D8CE] bg-white text-[#243228]"
          >
            <option value="">Tous statuts</option>
            <option value="a_faire">À faire</option>
            <option value="fait">Fait</option>
          </select>
          <select
            value={filterCanton}
            onChange={(e) => setFilterCanton(e.target.value)}
            className="px-3 py-1.5 rounded-full text-sm border border-[#D3D8CE] bg-white text-[#243228]"
          >
            <option value="">Tous cantons</option>
            {cantons.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterCategorie}
            onChange={(e) => setFilterCategorie(e.target.value)}
            className="px-3 py-1.5 rounded-full text-sm border border-[#D3D8CE] bg-white text-[#243228]"
          >
            <option value="">Toutes catégories</option>
            {Object.entries(CATEGORIES).map(([key, c]) => (
              <option key={key} value={key}>{c.label}</option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setView(view === "grille" ? "tableau" : "grille")}
              className="px-3 py-1.5 rounded-full text-sm border border-[#D3D8CE] bg-white text-[#243228]"
            >
              Vue {view === "grille" ? "tableau" : "grille"}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 rounded-full text-sm bg-[#3E5C4A] text-white"
            >
              + Ajouter un spot
            </button>
          </div>
        </div>

        {view === "grille" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((spot) => {
              const cat = CATEGORIES[spot.categorie] || {};
              const done = spot.statut === "fait";
              return (
                <div key={spot.id} className="bg-white rounded-lg overflow-hidden border border-[#E1E4DA] flex flex-col">
                  <div className="h-36 bg-[#DDE1D4] relative">
                    {spot.photoUrl ? (
                      <img src={spot.photoUrl} alt={spot.nom} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-[#8A9284] text-sm">
                        <span>Pas encore de photo</span>
                        {spot.lienInspo && (
                          <a
                            href={spot.lienInspo}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-[#3D6E80] underline"
                          >
                            Voir la fiche officielle
                          </a>
                        )}
                      </div>
                    )}
                    {done && (
                      <span className="absolute top-2 right-2 bg-[#3E5C4A] text-white text-xs px-2 py-0.5 rounded-full">
                        Fait
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge color={cat.color}>{cat.label}</Badge>
                      <span className="text-xs text-[#8A9284]">{spot.canton}</span>
                    </div>
                    <h3 className="font-medium text-[#243228] leading-snug">{spot.nom}</h3>
                    <p className="text-xs text-[#5C6B60] mt-0.5">{spot.adresse || spot.commune}</p>
                    {done && spot.dateVisite && (
                      <p className="text-xs text-[#8A9284] mt-1">Visité le {spot.dateVisite}</p>
                    )}
                    <button
                      onClick={() => setVisitingSpot(spot)}
                      className={`mt-auto pt-3 text-sm font-medium ${done ? "text-[#5C6B60]" : "text-[#3D6E80]"}`}
                    >
                      {done ? "Modifier" : "Marquer comme fait →"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-[#E1E4DA] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#5C6B60] border-b border-[#E1E4DA]">
                  <th className="px-3 py-2 font-medium">Spot</th>
                  <th className="px-3 py-2 font-medium">Canton</th>
                  <th className="px-3 py-2 font-medium">Catégorie</th>
                  <th className="px-3 py-2 font-medium">Adresse</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((spot) => {
                  const cat = CATEGORIES[spot.categorie] || {};
                  const done = spot.statut === "fait";
                  return (
                    <tr key={spot.id} className="border-b border-[#F0F1EC] last:border-0">
                      <td className="px-3 py-2 text-[#243228] font-medium">{spot.nom}</td>
                      <td className="px-3 py-2 text-[#5C6B60]">{spot.canton}</td>
                      <td className="px-3 py-2"><Badge color={cat.color}>{cat.label}</Badge></td>
                      <td className="px-3 py-2 text-[#5C6B60]">{spot.adresse || spot.commune}</td>
                      <td className="px-3 py-2">
                        {done ? (
                          <span className="text-[#3E5C4A]">Fait{spot.dateVisite ? ` · ${spot.dateVisite}` : ""}</span>
                        ) : (
                          <span className="text-[#8A9284]">À faire</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => setVisitingSpot(spot)} className="text-[#3D6E80] font-medium">
                          {done ? "Modifier" : "Marquer fait"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && <AddSpotModal onClose={() => setShowAdd(false)} onAdd={handleAddSpot} />}
      {visitingSpot && (
        <MarkVisitedModal
          spot={visitingSpot}
          onClose={() => setVisitingSpot(null)}
          onSave={handleSaveVisit}
        />
      )}
    </div>
  );
}
