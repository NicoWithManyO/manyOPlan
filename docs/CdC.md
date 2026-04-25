# 📄 Cahier des charges – Plateforme de gestion de bénévoles

## 🎯 Objectif

Créer une application web permettant d’organiser des événements et de gérer efficacement les bénévoles :

- inscription des bénévoles
- gestion des tâches et créneaux
- affectation simple et rapide
- vision globale du planning

⚠️ **Point critique :**
L’application doit être **extrêmement intuitive, ergonomique et agréable**, aussi bien pour :
- les administrateurs (organisateurs)
- les bénévoles (utilisateurs non techniques)

---

## ⚙️ Stack technique

- Backend : Django + Django REST Framework
- Base de données : SQLite3 (phase initiale)
- Frontend : React + **TypeScript**
- State management : Zustand
- Architecture : API REST découplée

---

## 🧑‍💻 Exigences de qualité du code

Le code produit doit être :

### 🧼 Propre et maintenable
- structure claire (séparation backend / frontend / modules)
- nommage explicite
- code lisible sans documentation excessive

---

### 🧱 Bien structuré
- séparation des responsabilités
- architecture modulaire
- découplage des composants

---

### 📏 Respect des standards
- respect des conventions :
  - Django (backend)
  - React + TypeScript (frontend)
- bonnes pratiques de chaque écosystème

---

### ♻️ Principes de développement

Le code doit respecter :

- **DRY** (Don’t Repeat Yourself)
- **KISS** (Keep It Simple, Stupid)
- **SOLID** :
  - Single Responsibility
  - Open/Closed
  - Liskov Substitution
  - Interface Segregation
  - Dependency Inversion

---

### ⚡ Qualité technique attendue

- code facilement testable
- extensible
- évite toute complexité inutile
- prêt pour montée en charge (migration PostgreSQL)

---

## 🧠 Principe clé UX

### 🔥 PRIORITÉ ABSOLUE : INTUITIVITÉ

#### 👨‍💼 Pour les admins :
- création d’événement simple et rapide
- configuration visuelle des tâches et créneaux
- vue globale immédiate
- modification via drag & drop
- aucune complexité inutile

#### 🙋 Pour les bénévoles :
- inscription en quelques clics
- compréhension immédiate
- choix des créneaux simple
- visibilité claire :
  - disponible
  - complet
  - assigné

➡️ L’utilisateur ne doit jamais réfléchir à l’outil

---

## 🗄️ Modélisation des données

### 🎉 Event
- nom
- type
- date_debut / date_fin
- organisateur (User)
- entree_libre (bool)
- description

---

### 👤 User
- utilisateur Django
- rôles :
  - admin global
  - organisateur
  - bénévole

---

### 🤝 EventMembership
- user
- event
- rôle (admin / bénévole)

---

### 🛠️ Task
- event
- nom
- description
- nb_benevoles_min (optionnel)
- nb_benevoles_max (optionnel / null = illimité)

---

### ⏱️ Slot
- task
- date_debut
- date_fin
- nb_places (optionnel / null = illimité)

⚠️ Les créneaux :
- indépendants par tâche
- peuvent se chevaucher entre tâches

---

### ✅ Assignment
- user
- slot
- statut :
  - confirmé
  - secours

---

### 📰 News
- event (optionnel)
- titre
- contenu
- date

---

### 💬 Message
- sender
- receiver
- contenu
- date
- lu (bool)

---

## ⚠️ Règles métier

### 🔁 Inscriptions
- inscription libre
- ajout possible par admin

---

### ⛔ Conflits
- un user ne peut pas avoir 2 créneaux qui se chevauchent
- chevauchement autorisé entre tâches

---

### 👥 Capacités
- slots limités ou illimités
- si plein → inscription en secours

---

### 🥇 Priorité
- first come, first served
- modifiable par admin

---

### 🔐 Permissions

#### Admin événement :
- créer / modifier événement
- gérer tâches et créneaux
- gérer bénévoles
- gérer news

#### Bénévole :
- rejoindre événement
- s’inscrire sur créneaux
- consulter planning

---

## 🎨 Frontend – UX/UI

### 🧠 Objectifs

L’interface doit être :

- **moderne**
- **épurée**
- **fluide**
- **agréable visuellement**
- **intuitive**

➡️ L’UX est un facteur clé de succès du projet

---

### 🎯 Principes de design

- design minimaliste
- hiérarchie visuelle claire
- couleurs cohérentes (états)
- feedback immédiat
- animations légères

---

### 🖱️ Drag & Drop (ESSENTIEL)

- interaction fluide
- aucun lag
- feedback visuel clair
- mise à jour instantanée

---

### 📊 Vues

#### 1. Planning (calendrier)
- timeline claire

#### 2. Tableau
- colonnes = tâches
- lignes = créneaux

#### 3. Dashboard
- remplissage
- slots incomplets
- bénévoles libres

---

### 🚀 Résultat attendu

Une interface :
- **rapide**
- **évidente**
- **plaisante**

➡️ utilisable sans explication

---

### 📱 Mobile-first

#### Philosophie
- **Conception mobile-first** : l'interface est pensée pour mobile d'abord, enrichie pour desktop
- Pas d'app native ni de PWA, mais **100% fonctionnel sur mobile** (bénévoles ET admins)

#### Bénévoles sur mobile
- inscription, consultation planning, choix des créneaux : tout en quelques taps
- vue planning adaptée (vue jour, cartes empilées)
- cibles tactiles >= 44px

#### Admins sur mobile
- toutes les fonctions admin accessibles sur mobile
- CRUD tâches, créneaux, affectations via modales plein écran et menus contextuels
- pas de drag & drop sur mobile → remplacé par tap + actions contextuelles / swipe
- drag & drop disponible sur desktop et tablettes

#### Adaptation par écran
- **mobile** : navigation bottom bar, formulaires pleine largeur, vues empilées
- **tablette** : sidebar rétractable, grilles partielles, touch DnD activé
- **desktop** : sidebar, vue tableau/timeline complète, drag & drop natif

---

## 🔔 Fonctionnalités complémentaires

- système de news
- messagerie interne
- (optionnel)
  - notifications email
  - export planning

---

## 🔐 Sécurité

### 🎯 Objectifs
- protection des données
- contrôle des accès
- fiabilité

---

### 🔑 Authentification
- Django (session ou JWT)
- mots de passe sécurisés

---

### 👤 Autorisations
- accès limité aux ressources autorisées
- aucune élévation de privilège

---

### 🚫 Protection des données
- validation backend obligatoire
- contrôle des assignations

---

### 🔒 API
- endpoints sécurisés
- vérification des droits

---

### 🛡️ Bonnes pratiques
- CSRF
- XSS protection
- ORM Django
- logs (optionnel)

---

## 🚀 Vision produit

Créer un outil :

- simple pour les bénévoles
- puissant pour les organisateurs
- fluide et moderne

➡️ Le produit doit donner l’impression que tout est naturel
