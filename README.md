
Portail Chauffeurs - Fullstack Demo
===================================

Contenu:
- server.js : Node/Express backend (SQLite)
- public/index.html : frontend (simple SPA) served statically
- package.json : dépendances
- data.db will be created automatically on first run

### Prérequis
- Node.js (>=16)
- npm

### Installation et exécution
```bash
# installer les dépendances
npm install

# lancer le serveur
node server.js

# le site sera disponible sur http://localhost:3000
```

### Comportement initial
- Un compte admin par défaut est créé automatiquement:
  - nom: `admin`
  - mot de passe: `adminpass`
  - **Changez ce mot de passe immédiatement en créant un nouvel utilisateur admin ou en mettant à jour la DB.**

### API principales
- POST /api/login { name, password } -> { token, user }
- POST /api/users (admin) { name, password, role } -> create user
- GET /api/users (admin) -> list users
- GET /api/agenda (auth) -> list agenda for current user
- POST /api/agenda (auth) { title, date } -> add event for current user
- GET /api/missions (auth) -> list missions
- POST /api/missions (admin) { client, dt, pickup, dropoff } -> create mission
- POST /api/missions/:id/assign (admin) { user_id } -> assign mission

### Déploiement
- Pour production, changez la variable SECRET dans server.js par une valeur forte.
- Utilisez un reverse-proxy (nginx) ou une plateforme comme Heroku / Railway / Render / DigitalOcean App Platform.
- Configurez HTTPS, sauvegardes de la base SQLite (ou migrez vers Postgres/MySQL).

Si vous voulez, je peux :
- générer des scripts pour créer un dépôt GitHub et pousser le projet,
- préparer un Dockerfile pour containeriser l'application,
- ajouter une interface calendrier (FullCalendar) et notifications (email/SMS).
