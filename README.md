[![Bannière Grego](https://image.noelshack.com/fichiers/2026/30/5/1784922257-dark-no-bg-banner.png)](https://gre-go.vercel.app/)
[![React](https://img.shields.io/badge/React-19.2.4-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0.0-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.3.6-38B2AC.svg)](https://tailwindcss.com/)
[![React Router](https://img.shields.io/badge/React_Router-7.13.1-CA4245.svg)](https://reactrouter.com/)

> Une application web progressive et moderne optimisée (PWA) pour Mobile. Gérez et recherchez des trajets de transport utilisant l'API ouverte TAG (Transports de l'Agglomération Grenobloise) et les données en temps réel GBFS (General Bikeshare Feed Specification).


## Aperçu des fonctionnalités 

### Trajets
- **Gestion Multi-Trajets** : Enregistrez et gérez jusqu'à 10 trajets différents avec sauvegarde automatique et persistante
- **Recherche de Trajets** : Recherchez des trajets de transport avec filtres avancés par départ, arrivée et numéro de ligne
- **Stockage Persistant** : Tous les trajets sont automatiquement sauvegardés dans le localStorage du navigateur
- **Navigation Temporelle** : Naviguez entre différents créneaux horaires pour le même trajet
- **Édition des Trajets** : Renommez vos trajets sauvegardés pour une meilleure organisation
- **Détails des Trajets** : Visualisez les détails complets, du tracé aux horaires exacts
- **Refresh Manuel** : Rafraîchissez vos trajets d'un seul clic

### Recherche Rapide
- **Recherche Rapide** : Fonctionnalité de recherche rapide pour des requêtes ponctuelles sans sauvegarde


### Données
- **Données en Temps Réel** : Intégration avec l'API TAG pour des informations actualisées des transports
- **Données GBFS** : Intégration des données Voi & Citiz avec localisation des stations, disponibilité, batterie restante...
- **Alertes et Perturbations** : Affichage des perturbations actuelles du réseau de transports
- **Export/Import JSON** : Exportez et importez vos configurations de trajets pour synchronisation multi-appareils

### Paramètres
- **Paramètres Avancés** : Vitesse de marche personnalisable, accessibilité PMR, nombre de résultats ajustable
- **Système de Cache** : Cache intelligent de 1 minute pour réduire les appels API

### Autres
- **Icônes Dynamiques** : Icônes générées par lignes (fichier lines-icons.jsx) sans images sous copyright
- **Carte Interactive** : Visualisation des trajets sur une carte interactive
- **Mode Sombre** : Support du mode sombre avec persistance des préférences
- **Analyse de Performance** : Intégration Vercel Analytics et Speed Insights

## Stack Technologique

- **Frontend** : React 19 (avec React Compiler)
- **Outil de Build** : Vite 8
- **Styling** : Tailwind CSS 3 avec PostCSS
- **Routage** : React Router v7
- **Client HTTP** : Fetch API native
- **Cartographie** : MapLibre GL avec React Map GL
- **Icônes** : React Icons
- **Animations** : Motion
- **Modales** : React Modal Sheet
- **Monitoring** : Vercel Analytics & Speed Insights
- **Linting** : ESLint
- **Source Données** :
  - API TAG Mobilités (data.mobilites-m.fr)
  - Données GBFS (Vélos en libre-service)
  - Données de perturbations réseau

## Démarrage

### Prérequis

- Node.js (v14 ou supérieur)
- npm ou yarn

### Installation

1. Clonez le repository :

```bash
git clone https://github.com/Palmine38/Web-TAG-express.git
cd GreGo
```

2. Installez les dépendances :

```bash
npm install
```

3. Lancez le serveur de développement :

```bash
npm run dev
```

4. Buildez pour la production :

```bash
npm run build
```

5. Aperçu du build :

```bash
npm run preview
```

### Linting

```bash
npm run lint
```

## Structure du Projet

```
GreGo/
├── public/
│   ├── manifest.json
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── GBFS/
│   └── logos/
├── scripts/
│   └── postbuild.mjs
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── AddressSearchContent.jsx
│   │   ├── DisruptionItem.jsx
│   │   ├── gbfsSheet.jsx
│   │   ├── InfotraficSheet.jsx
│   │   ├── JourneyCard.jsx
│   │   ├── JourneyDetailsSheet.jsx
│   │   ├── JourneyMapModal.jsx
│   │   ├── JourneyResultsHeader.jsx
│   │   ├── JourneyTimeline.jsx
│   │   ├── LineInfoSheet.jsx
│   │   ├── MapSheet.jsx
│   │   ├── nearestStops.jsx
│   │   ├── NotificationToast.jsx
│   │   ├── SearchSheet.jsx
│   │   ├── StopDetailsSheet.jsx
│   │   ├── StopPickerMap.jsx
│   │   ├── TrajetTabBar.jsx
│   │   ├── WalkRouteSheet.jsx
│   │   ├── devOverlay.jsx
│   │   ├── lines-icons.jsx
│   │   └── line*.json (tracés manuels de certaines lignes)
│   ├── hooks/
│   │   ├── useCurrentTime.js
│   │   ├── useDisruptions.js
│   │   ├── useGbfs.js
│   │   ├── useGbfsPricing.js
│   │   ├── useLineColors.js
│   │   ├── usePerfSettings.js
│   │   ├── useSettings.js
│   │   ├── useStops.js
│   │   └── useTheme.js
│   ├── utils/
│   │   ├── addressSuggestions.js
│   │   ├── currentLocation.js
│   │   ├── journey.js
│   │   └── searchError.js
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   ├── main.jsx
│   ├── fast-research.jsx
│   ├── infotrafic.jsx
│   ├── lines-icons.jsx
│   ├── mes-trajets.jsx
│   ├── navbar.jsx
│   ├── nomobile.jsx
│   ├── settings.jsx
│   └── suivi-beta.jsx
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── vercel.json
└── README.md
```

## Composants Principaux

### Mes Trajets (`mes-trajets.jsx`)

- Gérez jusqu'à 10 trajets de manière intuitive grâce à un appui long : supprimez, deplacez, renommez vos trajets.
- Modifiez et paufinez les détails des trajets (départ, arrivée, ligne)
- Cherchez en utilisant la carte interactive pour sélectionner des arrêts/adresses.
- Accédez à l'infotrafic en 1 clic.
- Sauvegarde automatique et persistante
- Précision record sur le calcul d'itinéraires.

### Recherche Rapide (`fast-research.jsx`)

- Recherche rapide & ponctuelle 
- Carte interactive avec plusieurs thèmes
- Affichage instantanée des résultats
- Filtres Voi & Citiz optimisés
- Détails d'un arrêt précis : lignes, prochains passages, tracés de lignes...

### Infotrafic (`infotrafic.jsx`)

- Affichage des perturbations et alertes du réseau aussi bien que Grenoble que le Pays Voironnais, voir le Grésivaudan.
- Détails des perturbations par ligne

### Barre de Navigation (`navbar.jsx`)

- Navigation entre les pages principales
- Menu hamburger pour mobile
- Design responsive et optimisé tactile
- Bouton infotrafic : accedez aux informations en 1 clic
- Barre de navigation en bas style application native : rend l'expérience utilisateur plus fluide et plus agréable

### Paramètres (`settings.jsx`)

- **Accessibilité PMR** : Options pour trajets accessibles
- **Vitesse de marche** : Ajustez votre vitesse de marche
- **Nombre de trajets** : Contrôlez le nombre de résultats retournés
- **Persistance** : Tous les paramètres sont sauvegardés localement

### Icônes Dynamiques (`lines-icons.jsx`)

- Génère les icônes des lignes de transport
- Récupère et applique les couleurs officielles
- Évite l'utilisation d'images sous copyright

### Composants de Feuilles/Sheets

- **JourneyDetailsSheet** : Détails complets du trajet : carte, tracés...
- **JourneyMapModal** : Visualisation cartographique
- **StopDetailsSheet** : Informations détaillées sur les arrêts
- **MapSheet** : Carte interactive
- **SearchSheet** : Interface de recherche d'adresses
- **LineInfoSheet** : Informations sur les lignes
- **InfotraficSheet** : Perturbations et alertes
- **gbfsSheet** : Données concernant l'accès des vélos/trotinettes et l'autopartage des voitures (Voi & Citiz)

## Hooks Personnalisés

L'application utilise plusieurs hooks React personnalisés pour la gestion d'état et les données :

- **useStops()** : Récupère et met en cache les arrêts de transport
- **useLineColors()** : Gère les couleurs des lignes de transport
- **useSettings()** : Gère les paramètres utilisateur persistants
- **useDisruptions()** : Récupère les perturbations du réseau en temps réel
- **useGbfs()** : Gère les données GBFS (Vélos en libre-service)
- **useGbfsPricing()** : Récupère les tarifs GBFS
- **useCurrentTime()** : Fournit l'heure actuelle avec mise à jour
- **useTheme()** : Gère le thème (mode clair/sombre/bleu)
- **usePerfSettings()** : Configuration des paramètres de performance

## Utilitaires */utils/*

- **addressSuggestions.js** : Autocomplétion et suggestions d'adresses
- **currentLocation.js** : Géolocalisation et détection de position
- **journey.js** : Logique de gestion et traitement des trajets
- **searchError.js** : Gestion et affichage des erreurs de recherche

## Intégration API

### TAG Mobilités

L'application utilise l'API ouverte TAG Mobilités (SMMAG) pour les trajets de transport :

- **URL de Base** : `https://data.mobilites-m.fr/api/routers/default`
- Récupère les trajets disponibles, arrêts et itinéraires
- Données de transport en temps réel
- Perturbations et alertes réseau

### GBFS (General Bikeshare Feed Specification)

Intégration des données de vélos en libre-service :

- Localisation des stations Vélo'v
- Disponibilité en temps réel des vélos et places de parking
- Informations tarifaires

## Performance et Optimisations

- **Cache Intelligent** : Mise en cache de 1 minute pour réduire les appels API
- **Lazy Loading** : Chargement différé des composants volumineux
- **React Compiler** : Compilation automatique des composants pour plus de performances

## Déploiement

L'application est déployée sur **Vercel** (https://gre-go.vercel.app).

## Compatibilité Navigateurs

- Chrome/Chromium (dernière version)
- Firefox (dernière version)
- Safari (dernière version)
- Edge (dernière version)

Responsive design optimisé pour tous les appareils

## Licence

Ce projet est open source et disponible sous la licence GNU GPL v3.

Voir [LICENSE](LICENSE) pour plus de détails.

## Crédits

Ce projet ne serait pas possible sans :

- Les APIs opendata fournies par le **SMMAG**

## Auteur

Créé par [Palmine38](https://github.com/Palmine38) avec la contribution de [Antquu](https://github.com/antquu).

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :

1. Fork le projet
2. Créer une branche pour votre fonctionnalité (`git checkout -b feature/NouvelleFeature`)
3. Commit vos changements (`git commit -m 'Ajout de NouvelleFeature'`)
4. Push vers la branche (`git push origin feature/NouvelleFeature`)
5. Ouvrir une Pull Request

Les issues et demandes de fonctionnalités sont également bienvenues :)

## Ressources

- [Documentation Vite](https://vitejs.dev/)
- [Documentation React](https://react.dev/)
- [Documentation Tailwind CSS](https://tailwindcss.com/)
- [API TAG Mobilités](https://data.mobilites-m.fr/)
- [MapLibre GL](https://maplibre.org/)
