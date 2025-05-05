import pytest
import httpx

async def test_health_endpoint():
    """Test that the health endpoint returns a 200 status code."""
    backend_url = "http://test-backend:8000"
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{backend_url}/api/v1/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
