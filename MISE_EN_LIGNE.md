# Mise en ligne — Vercel

## Corriger le déploiement existant

L'erreur « Found app.py but it does not export a top-level app, application, or handler »
provenait de l'ancienne interface Streamlit. La version actuelle utilise Flask et
exporte une variable `app` à la racine de `app.py`.

1. Dans votre projet Vercel, vérifiez que le dépôt est **richesman25-beep/nouveau-**
   et que la branche de production est **main**.
2. Root Directory : racine du dépôt, là où se trouve `app.py`.
3. Laissez la détection **Flask** et l'installation de `requirements.txt` actives.
   Retirez les anciennes commandes Streamlit et tout Output Directory personnalisé.
   Aucun `npm run build`, `streamlit run` ou dossier `dist` n'est nécessaire.
4. Déployez le dernier commit de `main`. Si l'ancien échec reste affiché,
   lancez un nouveau déploiement depuis Git ; ne redéployez pas l'ancien commit.
5. Ouvrez l'URL HTTPS fournie par Vercel. Le chemin `/health` doit répondre
   `{"status":"ok"}`.

Le push peut déclencher le déploiement automatiquement si l'intégration Git Vercel
est active. La publication distante et son résultat ne sont pas vérifiables sans
accès au projet Vercel. Aucune clé API n'est nécessaire au fonctionnement de l'application.

## Configuration fournie

- `app.py` : application Flask WSGI avec export `app`.
- `.python-version` : Python 3.12.
- `requirements.txt` : dépendances du serveur ; Streamlit et PyArrow n'en font plus partie.
- `vercel.json` : inclusion des templates et fichiers statiques, durée maximale de 60 s
  sous réserve des limites du compte.
- `static/` : interface et Plotly local, sans dépendance à un CDN dans le navigateur.

L'application utilise des requêtes HTTP classiques. Elle ne lance aucun serveur
Streamlit, tâche en arrière-plan ou connexion WebSocket persistante.
Les imports sont limités à 3 Mo et 10 000 bougies pour réduire le temps de calcul et
rester sous la limite de requête de l'hébergement ; diminuez la période si un calcul
expire sur votre offre.

## Vérifications après publication

1. L'accueil affiche le graphique des prix fictifs et le RSI.
2. L'onglet Simulation affiche le capital et le journal après coûts.
3. Importez `exemple_donnees_simulees.csv` et relancez l'analyse : la source devient CSV.
4. Les trois exports (cours CSV, rapport JSON, journal CSV) sont téléchargeables.
5. Vérifiez l'affichage sur téléphone.

## Alternative Render

Créez un Blueprint depuis le même dépôt, branche `main`, à la racine du projet.
`render.yaml` installe les dépendances et lance Gunicorn avec `bash web-start.sh`.
Le port vient de `PORT` et le contrôle de santé utilise `/health`.
Consultez les conditions et tarifs affichés avant de créer le service ; le manifeste
Render demande l'offre `free` si elle est disponible sur votre compte.

## Accès et données

Le lien n'est pas protégé par un compte utilisateur. Les CSV sont traités sur le serveur
et ne sont pas sauvegardés durablement par le code. Ne transmettez pas de données
confidentielles et conservez les exports nécessaires. Aucun ordre réel n'est envoyé.
