# Atelier Trading — application web Flask

Application en français pour analyser des cours OHLCV, calculer les EMA/RSI/ATR,
dimensionner une position et simuler une stratégie sur historique.
Aucun ordre n'est envoyé et aucune clé de courtier n'est requise.

## Mise en ligne sur Vercel

Le dépôt **richesman25-beep/nouveau-**, branche **main**, contient une application
Flask compatible avec le point d'entrée Python de Vercel : `app.py` exporte `app`.
L'interface utilise des pages HTML et une API HTTP, sans serveur Streamlit ni WebSocket.

Dans Vercel, importez ce dépôt et utilisez la racine du dépôt comme Root Directory.
Laissez Vercel détecter Flask, installer `requirements.txt` et utiliser `app.py`.
Supprimez d'éventuelles anciennes commandes de build/démarrage Streamlit et tout
Output Directory personnalisé. Pour un projet déjà importé, redéployez le dernier
commit de `main`. Voir **MISE_EN_LIGNE.md** pour les détails.

`vercel.json` inclut les templates et fichiers statiques dans la fonction et fixe
un délai de calcul maximal de 60 secondes, sous réserve des limites de votre offre.
La version Python demandée par `.python-version` est 3.12.
La bibliothèque Plotly est servie avec l'application, sans CDN à contacter dans le navigateur.

## Utilisation

1. Ouvrez votre URL HTTPS Vercel. La démonstration se charge avec des prix **fictifs**.
2. Choisissez **Importer un CSV** pour utiliser votre propre historique.
3. Réglez le capital, le risque et les coûts, puis cliquez sur **Lancer l'analyse**.
4. Explorez Marché, Scénario et risque, et Simulation historique.
5. Exportez les cours CSV, le rapport JSON et le journal de simulation CSV.

Le nom de l'actif est une étiquette : il ne télécharge aucun cours en direct.
Les calculs se font uniquement lorsque l'analyse est lancée ; les réglages ne
modifient pas un rapport déjà affiché avant une nouvelle analyse.

## Données CSV

```csv
timestamp,open,high,low,close,volume
2026-01-01T00:00:00Z,100,102,99,101,1200
2026-01-01T01:00:00Z,101,103,100,102,1400
```

Ces deux lignes illustrent le format : **200 bougies clôturées minimum** sont requises
pour l'analyse et **202** pour la simulation. Préférez un historique bien plus long.
L'interface web accepte au maximum **3 Mo et 10 000 bougies** ; les requêtes JSON sont
limitées à 4 Mo pour rester adaptées à l'hébergement. Le moteur en ligne de commande
n'a pas cette limite de lignes. Les graphiques affichent au plus 1 000 bougies.

UTF-8, point décimal et séparateur virgule, point-virgule ou tabulation. Les noms
`date`, `datetime` et `time` sont acceptés à la place de `timestamp`. Les noms de
colonnes sont insensibles à la casse. Dates ISO 8601 uniquement ; les dates sans fuseau
sont interprétées en UTC. Les lignes sont triées et les dates dupliquées, valeurs
manquantes, prix non positifs et bougies incohérentes sont refusés.

Utilisez une fréquence régulière, un même marché et uniquement des bougies clôturées.
Le fichier seul ne permet pas de vérifier la provenance ni la clôture d'une bougie.
Les trous ne sont pas comblés. Pour les actions, vérifiez les ajustements de splits et
dividendes chez votre fournisseur. `exemple_donnees_simulees.csv` contient des prix fictifs.

Prix et capital doivent être dans la même devise. La taille est donnée en unités de
l'actif, sans pas de lot, multiplicateur, contrat ou conversion de devise du courtier.

## Calculs et risque

- RSI de Wilder correctement initialisé sur 14 variations ; hausses seules = 100,
  baisses seules = 0, prix constant = 50. L'amorçage reste indisponible.
- ATR de Wilder : moyenne initiale puis lissage récursif, sans données futures.
- Signal : prix et EMA 20/50/200 alignés, proximité de l'EMA 50 **et** RSI entre 40 et 60.
  Aucune entrée lorsque la volatilité est nulle.
- Supports/résistances : extrêmes des 30 dernières bougies, pas des pivots confirmés.
- Position : budget intégrant frais et glissement au stop, exposition plafonnée au capital,
  aucun levier. Le ratio gain/risque est brut, avant coûts.

## Simulation historique

Les 200 premières bougies amorcent les indicateurs. Un signal clôturé déclenche une
entrée à l'ouverture suivante avec glissement adverse. Stop et objectif sont recalculés
à partir de cette entrée et de l'ATR connu au signal. Une position à la fois, pas de
réentrée sur la bougie de sortie. Frais à l'entrée et à la sortie.

Si stop et objectif sont touchés sur une même bougie, le stop a priorité ; un gap au
stop utilise l'ouverture, avec glissement. Une ouverture au-delà de l'objectif est
comptée à l'objectif sans amélioration favorable. La dernière position est liquidée
au dernier cours avec coûts et marquée `fin_echantillon`. La baisse maximale se mesure
au capital valorisé aux clôtures, pas à l'intérieur des bougies.

Achats seuls par défaut. La vente à découvert facultative reste un modèle simplifié,
sans emprunt, marge de maintenance ni liquidation. Un gap extrême peut dépasser le
budget de risque ou le capital. Spread, liquidité, financement, fiscalité et exécutions
partielles ne sont pas modélisés séparément. Résultats sur l'échantillon fourni,
sans validation hors échantillon. Aucune rentabilité n'est démontrée.

## Données et accès

L'application n'a pas de comptes utilisateurs. Toute personne disposant du lien peut
l'ouvrir. Les imports sont envoyés au serveur pour le calcul, sans sauvegarde durable
programmée par l'application. Aucun partage de cache applicatif entre utilisateurs.
N'importez pas d'informations confidentielles sur un service public. Téléchargez les
exports que vous souhaitez conserver. Aucun envoi à une API de marché n'est programmé.

## Utilisation locale

Python 3.12 recommandé (3.11 minimum), avec pip et venv.

- Windows : double-cliquez `start.bat` après avoir installé Python avec son lanceur `py`.
- Linux/macOS : exécutez `bash start.sh`.

Ouvrez ensuite `http://127.0.0.1:8501` sur votre ordinateur. Gardez le terminal ouvert ;
Ctrl+C arrête le serveur. Le lanceur local écoute uniquement sur cet ordinateur.
Ce serveur de développement n'est pas celui utilisé par Vercel ou Render.

Installation manuelle :

```bash
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python app.py
```

Sous Windows, remplacez `.venv/bin/python` par `.venv\Scripts\python.exe`.
Pour un hébergeur avec processus persistant, activez le venv puis lancez `bash web-start.sh` :
Gunicorn utilise `app:app`, écoute sur `0.0.0.0` et lit `PORT` (8501 par défaut).
Le manifeste Render reste disponible.

## Ligne de commande et tests

```bash
.venv/bin/python trading_analysis_system.py --backtest --output journal.csv
.venv/bin/python trading_analysis_system.py --csv mes_cours.csv --symbol ETH-USDT --capital 5000 --risk 1 --backtest
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
```

Les tests couvrent les références RSI, la causalité des indicateurs, les entrées et
sorties, les gaps, les coûts et la cohérence comptable, ainsi que l'API, les imports
et les exports. La ligne de commande simule uniquement des achats. Le lanceur Windows
est fourni mais n'a pas été exécuté sous Windows.

Plotly.js 2.35.2 est distribué sous licence MIT : voir `static/PLOTLY_LICENSE`.
