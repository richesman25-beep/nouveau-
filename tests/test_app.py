import json

import pytest
from flask import Flask

from app import app
from trading_analysis_system import MarketDataSimulator


@pytest.fixture
def client():
    app.config['TESTING'] = True
    return app.test_client()


def test_wsgi_export_and_home(client):
    assert isinstance(app, Flask)
    response = client.get('/')
    assert response.status_code == 200
    assert 'Atelier Trading' in response.text
    assert '/static/plotly.min.js' in response.text
    assert client.get('/health').json == {'status': 'ok'}
    for path in ['/static/app.js', '/static/style.css', '/static/plotly.min.js']:
        assert client.get(path).status_code == 200


def test_demo_analysis_and_backtest(client):
    response = client.post('/api/analyze', json={'settings': {'account_balance': 5000}})
    assert response.status_code == 200
    result = response.json
    assert result['report']['data_source'] == 'demo'
    assert result['history']['metrics']['trades'] > 0
    assert result['history']['metrics']['initial_balance'] == 5000
    assert len(result['chart']['dates']) == 750
    assert result['history']['csv'].startswith('signal_time,')
    assert response.headers['Cache-Control'] == 'no-store'
    json.dumps(result, allow_nan=False)


def test_csv_and_no_backtest(client):
    csv = MarketDataSimulator.generate_ohlcv(300).to_csv()
    response = client.post('/api/analyze', json={
        'source': 'csv', 'csv': csv, 'symbol': 'BTC-USD', 'run_backtest': False})
    assert response.status_code == 200
    assert response.json['count'] == 300
    assert response.json['report']['symbol'] == 'BTC-USD'
    assert response.json['history'] is None
    json.dumps(response.json, allow_nan=False)


def test_warmup_serializes_to_null(client):
    csv = MarketDataSimulator.generate_ohlcv(200).to_csv()
    response = client.post('/api/analyze', json={'source': 'csv', 'csv': csv})
    assert response.status_code == 200
    assert response.json['chart']['ema_200'][0] is None
    assert response.json['history'] is None
    json.dumps(response.json, allow_nan=False)


@pytest.mark.parametrize('body', [
    [], {'source': 'unknown'}, {'source': 'csv', 'csv': ''},
    {'source': 'csv', 'csv': 'incorrect'}, {'settings': {'unknown': 1}},
    {'settings': {'max_risk_pct': -1}}, {'settings': {'max_risk_pct': 'nan'}},
    {'settings': {'account_balance': True}}, {'bars': 250.5}, {'bars': 999999},
    {'seed': -1}, {'symbol': ''}, {'allow_short': 'false'}, {'run_backtest': 1},
    {'source': 'csv', 'csv': 'timestamp,open,high,low,close,volume\n' + 'x\n' * 10001},
])
def test_invalid_input_returns_json_error(client, body):
    response = client.post('/api/analyze', json=body)
    assert response.status_code == 400
    assert isinstance(response.json['error'], str)


def test_oversized_payload(client):
    response = client.post('/api/analyze', data='x' * (4 * 1024 * 1024 + 1),
                           content_type='application/json')
    assert response.status_code == 413
    assert 'error' in response.json
