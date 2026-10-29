"""Application Flask : point d'entrée WSGI reconnu par Vercel et Gunicorn."""
from dataclasses import asdict, fields
from io import StringIO
import json

from flask import Flask, jsonify, render_template, request
from werkzeug.exceptions import BadRequest, RequestEntityTooLarge

from trading_analysis_system import (
    EducationalTradingEngine, MarketDataSimulator, Settings, backtest, load_csv,
)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 4 * 1024 * 1024
MAX_BARS = 10000


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/health")
def health():
    return jsonify(status="ok")


@app.after_request
def response_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


def bounded_integer(value, minimum, maximum, name):
    if isinstance(value, bool) or int(value) != float(value) or not minimum <= int(value) <= maximum:
        raise ValueError(f"{name} doit être un entier entre {minimum} et {maximum}.")
    return int(value)


@app.post("/api/analyze")
def analyze():
    try:
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            raise ValueError("Envoyez un objet JSON valide.")
        raw_settings = body.get("settings", {})
        if not isinstance(raw_settings, dict) or set(raw_settings) - {f.name for f in fields(Settings)}:
            raise ValueError("Paramètres de stratégie non reconnus.")
        if any(isinstance(v, bool) for v in raw_settings.values()):
            raise ValueError("Les paramètres doivent être numériques.")
        settings = Settings(**{k: float(v) for k, v in raw_settings.items()})
        source = body.get("source", "demo")
        if source == "demo":
            bars = bounded_integer(body.get("bars", 750), 250, 5000, "Le nombre de bougies")
            seed = bounded_integer(body.get("seed", 42), 0, 10000, "Le scénario")
            data = MarketDataSimulator.generate_ohlcv(bars=bars, seed=seed)
        elif source == "csv":
            content = body.get("csv")
            if not isinstance(content, str) or not content.strip():
                raise ValueError("Sélectionnez un fichier CSV non vide.")
            if len(content.splitlines()) > MAX_BARS + 1:
                raise ValueError(f"Maximum {MAX_BARS:,} bougies dans la version web.")
            data = load_csv(StringIO(content))
            if len(data) > MAX_BARS:
                raise ValueError(f"Maximum {MAX_BARS:,} bougies dans la version web.")
        else:
            raise ValueError("Source inconnue : utilisez demo ou csv.")
        symbol = body.get("symbol", "DEMO")
        if not isinstance(symbol, str) or not 1 <= len(symbol.strip()) <= 50:
            raise ValueError("Le nom de l’actif doit contenir entre 1 et 50 caractères.")
        for name in ("allow_short", "run_backtest"):
            if name in body and not isinstance(body[name], bool):
                raise ValueError("Les options de simulation doivent être booléennes.")
        analysis = EducationalTradingEngine(symbol=symbol.strip(), settings=settings).analyze(data)
        frame = analysis.pop("df_analyzed").tail(1000)
        report = {**analysis, "signal": asdict(analysis["signal"]) if analysis["signal"] else None,
                  "settings": asdict(settings), "data_source": source}
        history = None
        if body.get("run_backtest", True) and len(data) >= 202:
            result = backtest(data, settings, body.get("allow_short", False))
            history = dict(metrics=result["metrics"],
                           trades=json.loads(result["trades"].to_json(orient="records", date_format="iso")),
                           csv=result["trades"].to_csv(index=False),
                           equity=dict(dates=result["equity"].index.astype(str).tolist(),
                                       values=result["equity"].tolist()))
        chart = frame.astype(object).where(frame.notna(), None).to_dict(orient="list")
        chart["dates"] = frame.index.astype(str).tolist()
        return jsonify(report=report, chart=chart, history=history,
                       count=len(data), start=data.index[0].isoformat(), end=data.index[-1].isoformat(),
                       csv=data.to_csv())
    except (ValueError, TypeError, OverflowError, BadRequest) as exc:
        return jsonify(error=str(exc)), 400


@app.errorhandler(RequestEntityTooLarge)
def too_large(_error):
    return jsonify(error="Requête trop volumineuse : maximum 4 Mo. Réduisez le fichier CSV."), 413


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8501, debug=False)
