"""12 behavioral non-regression tests for the reminders feature."""
import pytest
import uuid
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock, AsyncMock


def _make_reminder(**overrides):
    base = {
        "id": str(uuid.uuid4()),
        "original_text": "Alert me when AAPL hits $200",
        "ticker": "AAPL",
        "company_name": "Apple Inc.",
        "action": "Review and take action",
        "status": "active",
        "condition_type": "price_above",
        "target_price": 200.0,
        "percent_change": None,
        "trigger_time": None,
        "custom_condition": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "triggered_at": None,
        "current_price": 185.5,
        "notes": None,
    }
    base.update(overrides)
    return base


def _make_alert(**overrides):
    base = {
        "id": str(uuid.uuid4()),
        "reminder_id": str(uuid.uuid4()),
        "ticker": "AAPL",
        "message": "AAPL crossed $200",
        "triggered_at": datetime.now(timezone.utc).isoformat(),
        "is_read": False,
    }
    base.update(overrides)
    return base


class TestRemindersRegression:

    def test_get_reminders_returns_list(self, client):
        with patch("database.get_all_reminders", return_value=[]):
            resp = client.get("/api/v1/reminders")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_parse_price_above_reminder(self, client):
        """POST /reminders/parse with price-above text → ParsedReminder with correct fields."""
        mock_parsed = {
            "ticker": "AAPL", "company_name": "Apple Inc.", "action": "Review",
            "condition_type": "price_above", "target_price": 200.0,
            "percent_change": None, "trigger_time": None, "current_price": 185.5,
            "notes": None, "source": "llm",
        }
        with patch("routers.reminders.parse_reminder", return_value=mock_parsed), \
             patch("routers.reminders.get_finnhub_quote", return_value={"c": 185.5}):
            resp = client.post("/api/v1/reminders/parse", json={"text": "Alert me when AAPL hits $200"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ticker"] == "AAPL"
        assert data["condition_type"] == "price_above"
        assert data["target_price"] == 200.0

    def test_parse_price_below_reminder(self, client):
        mock_parsed = {
            "ticker": "TSLA", "company_name": "Tesla", "action": "Review",
            "condition_type": "price_below", "target_price": 150.0,
            "percent_change": None, "trigger_time": None, "current_price": 200.0,
            "notes": None, "source": "llm",
        }
        with patch("routers.reminders.parse_reminder", return_value=mock_parsed), \
             patch("routers.reminders.get_finnhub_quote", return_value={"c": 200.0}):
            resp = client.post("/api/v1/reminders/parse", json={"text": "Alert me when TSLA drops below $150"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["condition_type"] == "price_below"
        assert data["target_price"] == 150.0

    def test_save_reminder_stores_and_returns(self, client):
        """POST /reminders with a SaveReminderRequest → 201 with saved reminder."""
        row = _make_reminder()
        with patch("database.create_reminder", return_value=row), \
             patch("services.price_monitor.check_single_reminder", new=AsyncMock()):
            resp = client.post("/api/v1/reminders", json={
                "original_text": "Alert me when AAPL hits $200",
                "ticker": "AAPL",
                "action": "Review",
                "condition_type": "price_above",
                "target_price": 200.0,
                "current_price": 185.5,
            })
        assert resp.status_code == 201
        assert resp.json()["ticker"] == "AAPL"

    def test_derive_target_price_for_percent_change(self, client):
        """percent_change=10 with current_price=100 → target_price=110.0 stored in DB."""
        row = _make_reminder(condition_type="percent_change", percent_change=10.0, target_price=110.0)
        with patch("database.create_reminder", return_value=row) as mock_create, \
             patch("services.price_monitor.check_single_reminder", new=AsyncMock()):
            resp = client.post("/api/v1/reminders", json={
                "original_text": "Alert me when AAPL rises 10%",
                "ticker": "AAPL",
                "action": "Review",
                "condition_type": "percent_change",
                "percent_change": 10.0,
                "current_price": 100.0,
            })
        call_payload = mock_create.call_args[0][0]
        assert call_payload["target_price"] == 110.0

    def test_delete_reminder_returns_204(self, client):
        reminder_id = str(uuid.uuid4())
        with patch("database.delete_reminder", return_value=True):
            resp = client.delete(f"/api/v1/reminders/{reminder_id}")
        assert resp.status_code == 204

    def test_delete_nonexistent_reminder_returns_404(self, client):
        with patch("database.delete_reminder", return_value=False):
            resp = client.delete(f"/api/v1/reminders/{uuid.uuid4()}")
        assert resp.status_code == 404

    def test_get_alerts_returns_list(self, client):
        with patch("database.get_all_alerts", return_value=[]):
            resp = client.get("/api/v1/alerts")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_alert_has_required_fields(self, client):
        alert = _make_alert()
        with patch("database.get_all_alerts", return_value=[alert]):
            resp = client.get("/api/v1/alerts")
        items = resp.json()
        assert len(items) == 1
        for field in ("id", "ticker", "message", "triggered_at", "is_read"):
            assert field in items[0], f"Missing field: {field}"

    def test_mark_alert_read(self, client):
        alert_id = str(uuid.uuid4())
        read_alert = _make_alert(id=alert_id, is_read=True)
        with patch("database.mark_alert_read", return_value={**read_alert, "is_read": 1}):
            resp = client.patch(f"/api/v1/alerts/{alert_id}/read")
        assert resp.status_code == 200
        assert resp.json()["is_read"] is True

    def test_two_reminders_same_ticker_coexist(self, client):
        r1 = _make_reminder(id="id1", target_price=200.0)
        r2 = _make_reminder(id="id2", target_price=210.0)
        with patch("database.get_all_reminders", return_value=[r1, r2]):
            resp = client.get("/api/v1/reminders")
        assert len(resp.json()) == 2

    def test_reminder_status_update(self, client):
        reminder_id = str(uuid.uuid4())
        updated = _make_reminder(id=reminder_id, status="cancelled")
        with patch("database.update_reminder_status", return_value=updated):
            resp = client.patch(f"/api/v1/reminders/{reminder_id}/status", json={"status": "cancelled"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"
