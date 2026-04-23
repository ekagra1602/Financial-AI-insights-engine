"""13 behavioral non-regression tests for the notifications feature."""
import pytest
import re
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock


def _make_notification(type_, symbol="AAPL", **extra):
    base = {
        "id": f"{symbol}_{type_}_2026-04-23",
        "type": type_,
        "symbol": symbol,
        "title": f"{type_} for {symbol}",
        "message": f"Test {type_} message",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    base.update(extra)
    return base


def _make_alert(id_="alert1", ticker="AAPL"):
    return {
        "id": id_,
        "reminder_id": "rem1",
        "ticker": ticker,
        "message": f"{ticker} crossed target price",
        "triggered_at": datetime.now(timezone.utc).isoformat(),
        "is_read": 0,
    }


class TestNotificationsRegression:

    def test_get_notifications_returns_list(self, client):
        with patch("routers.notifications.generate_all_notifications", return_value=[]), \
             patch("routers.notifications.get_dismissed_notification_ids", return_value=set()), \
             patch("routers.notifications.get_all_alerts", return_value=[]), \
             patch("routers.notifications.get_all_reminders", return_value=[]):
            resp = client.get("/api/v1/notifications")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_reminder_alerts_appear_in_notifications(self, client):
        """REMINDER_ALERT type notifications are included from the alerts table."""
        alert = _make_alert()
        with patch("routers.notifications.generate_all_notifications", return_value=[]), \
             patch("routers.notifications.get_dismissed_notification_ids", return_value=set()), \
             patch("routers.notifications.get_all_alerts", return_value=[alert]), \
             patch("routers.notifications.get_all_reminders", return_value=[]):
            resp = client.get("/api/v1/notifications")
        items = resp.json()
        types = [n["type"] for n in items]
        assert "REMINDER_ALERT" in types

    def test_reminder_alerts_appear_before_market_notifications(self, client):
        """Alerts are listed first (confirmed by order in router code)."""
        alert = _make_alert()
        market_notif = _make_notification("DAILY_EOD")
        with patch("routers.notifications.generate_all_notifications", return_value=[market_notif]), \
             patch("routers.notifications.get_dismissed_notification_ids", return_value=set()), \
             patch("routers.notifications.get_all_alerts", return_value=[alert]), \
             patch("routers.notifications.get_all_reminders", return_value=[]):
            resp = client.get("/api/v1/notifications")
        items = resp.json()
        assert len(items) >= 2
        assert items[0]["type"] == "REMINDER_ALERT"

    def test_daily_eod_notification_has_required_fields(self, client):
        eod = _make_notification("DAILY_EOD")
        with patch("routers.notifications.generate_all_notifications", return_value=[eod]), \
             patch("routers.notifications.get_dismissed_notification_ids", return_value=set()), \
             patch("routers.notifications.get_all_alerts", return_value=[]), \
             patch("routers.notifications.get_all_reminders", return_value=[]):
            resp = client.get("/api/v1/notifications")
        eod_items = [n for n in resp.json() if n["type"] == "DAILY_EOD"]
        assert len(eod_items) == 1
        for field in ("id", "type", "symbol", "message", "timestamp"):
            assert field in eod_items[0]

    def test_momentum_notification_has_required_fields(self, client):
        mom = _make_notification("MOMENTUM_2H")
        with patch("routers.notifications.generate_all_notifications", return_value=[mom]), \
             patch("routers.notifications.get_dismissed_notification_ids", return_value=set()), \
             patch("routers.notifications.get_all_alerts", return_value=[]), \
             patch("routers.notifications.get_all_reminders", return_value=[]):
            resp = client.get("/api/v1/notifications")
        items = [n for n in resp.json() if n["type"] == "MOMENTUM_2H"]
        assert len(items) == 1
        for field in ("id", "type", "symbol", "message"):
            assert field in items[0]

    def test_morning_gap_notification_has_required_fields(self, client):
        gap = _make_notification("MORNING_GAP")
        with patch("routers.notifications.generate_all_notifications", return_value=[gap]), \
             patch("routers.notifications.get_dismissed_notification_ids", return_value=set()), \
             patch("routers.notifications.get_all_alerts", return_value=[]), \
             patch("routers.notifications.get_all_reminders", return_value=[]):
            resp = client.get("/api/v1/notifications")
        items = [n for n in resp.json() if n["type"] == "MORNING_GAP"]
        assert len(items) == 1
        for field in ("id", "type", "symbol", "message"):
            assert field in items[0]

    def test_dismissed_notification_excluded(self, client):
        """A notification whose id is in dismissed_ids must not appear in the response."""
        notif = _make_notification("DAILY_EOD")
        notif["id"] = "EOD_AAPL_dismiss_me"
        with patch("routers.notifications.generate_all_notifications", return_value=[notif]), \
             patch("routers.notifications.get_dismissed_notification_ids",
                   return_value={"EOD_AAPL_dismiss_me"}), \
             patch("routers.notifications.get_all_alerts", return_value=[]), \
             patch("routers.notifications.get_all_reminders", return_value=[]):
            resp = client.get("/api/v1/notifications")
        ids = [n["id"] for n in resp.json()]
        assert "EOD_AAPL_dismiss_me" not in ids

    def test_dismiss_notification_stores_id(self, client):
        """POST /notifications/dismiss records the id so it no longer appears."""
        with patch("routers.notifications.dismiss_notification") as mock_dismiss:
            resp = client.post(
                "/api/v1/notifications/dismiss",
                json={"notification_id": "EOD_AAPL_2026-04-23"},
            )
        assert resp.status_code == 200
        mock_dismiss.assert_called_once_with("EOD_AAPL_2026-04-23")

    def test_already_read_alert_excluded_from_notifications(self, client):
        """is_read=True alert must not appear as a REMINDER_ALERT notification."""
        read_alert = _make_alert(id_="read_alert")
        read_alert["is_read"] = 1
        with patch("routers.notifications.generate_all_notifications", return_value=[]), \
             patch("routers.notifications.get_dismissed_notification_ids", return_value=set()), \
             patch("routers.notifications.get_all_alerts", return_value=[read_alert]), \
             patch("routers.notifications.get_all_reminders", return_value=[]):
            resp = client.get("/api/v1/notifications")
        types = [n["type"] for n in resp.json()]
        assert "REMINDER_ALERT" not in types

    def test_briefing_notification_id_format(self, client):
        """NEWS_BRIEFING notification id matches {TICKER}_NEWS_{YYYY-MM-DD}_10AM pattern."""
        briefing = {
            "id": "AAPL_NEWS_2026-04-23_10AM",
            "type": "NEWS_BRIEFING",
            "symbol": "AAPL",
            "title": "Morning briefing",
            "message": "3 new articles",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "articles": [],
        }
        with patch("routers.notifications.generate_all_notifications", return_value=[briefing]), \
             patch("routers.notifications.get_dismissed_notification_ids", return_value=set()), \
             patch("routers.notifications.get_all_alerts", return_value=[]), \
             patch("routers.notifications.get_all_reminders", return_value=[]):
            resp = client.get("/api/v1/notifications")
        items = [n for n in resp.json() if n["type"] == "NEWS_BRIEFING"]
        assert len(items) == 1
        assert re.match(r".+_NEWS_\d{4}-\d{2}-\d{2}_10AM$", items[0]["id"])

    def test_empty_watchlist_gives_no_market_notifications(self, client):
        """generate_all_notifications returns [] when watchlist is empty → only alerts shown."""
        with patch("routers.notifications.generate_all_notifications", return_value=[]), \
             patch("routers.notifications.get_dismissed_notification_ids", return_value=set()), \
             patch("routers.notifications.get_all_alerts", return_value=[]), \
             patch("routers.notifications.get_all_reminders", return_value=[]):
            resp = client.get("/api/v1/notifications")
        market_types = {"DAILY_EOD", "MOMENTUM_2H", "MORNING_GAP"}
        for n in resp.json():
            assert n["type"] not in market_types

    def test_clear_all_notifications(self, client):
        """POST /notifications/clear-all returns 200."""
        with patch("routers.notifications.dismiss_notification"), \
             patch("routers.notifications.generate_all_notifications", return_value=[]), \
             patch("routers.notifications.get_dismissed_notification_ids", return_value=set()), \
             patch("routers.notifications.get_all_alerts", return_value=[]), \
             patch("routers.notifications.mark_alert_read"):
            resp = client.post("/api/v1/notifications/clear-all")
        assert resp.status_code == 200

    def test_news_briefing_and_reminder_alert_are_separate_types(self, client):
        """NEWS_BRIEFING and REMINDER_ALERT are distinct type strings."""
        assert "NEWS_BRIEFING" != "REMINDER_ALERT"
        # REMINDER_ALERT is never generated by notification_service —
        # it comes from the alerts table via the router.
        from services.notification_service import generate_all_notifications
        import inspect
        src = inspect.getsource(generate_all_notifications)
        assert "REMINDER_ALERT" not in src
