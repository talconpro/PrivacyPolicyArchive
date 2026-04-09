from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json().get('status') == 'ok'


def test_validation_error_shape():
    response = client.post('/api/compare', json={'slugs': ['only-one']})
    assert response.status_code in (400, 422)
    body = response.json()
    assert 'code' in body
    assert 'message' in body


def test_auth_me_shape():
    response = client.get('/api/auth/me')
    assert response.status_code == 200
    assert 'user' in response.json()
