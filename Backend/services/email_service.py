"""
Email Service — Send notification emails via Resend.

Called after each save_generated_notification() to email the user
(if they have a confirmed email and notifications enabled).
"""

import os
import resend
from database import get_user_settings

resend.api_key = os.environ.get("RESEND_API_KEY", "")

FROM_ADDRESS = "Financial Insights <onboarding@resend.dev>"


def send_notification_email(notification: dict):
    """Send an email for a generated notification. Silently skips if not configured."""
    try:
        settings = get_user_settings()
        if not settings["email"] or not settings["email_confirmed"] or not settings["email_notifications_enabled"]:
            return

        subject = _build_subject(notification)
        html = _build_email_html(notification)

        params: resend.Emails.SendParams = {
            "from": FROM_ADDRESS,
            "to": [settings["email"]],
            "subject": subject,
            "html": html,
        }

        result = resend.Emails.send(params)
        print(f"  [Email] Sent to {settings['email']}: {subject} (id={result.get('id', '?')})")
    except Exception as e:
        print(f"  [Email] Failed to send: {e}")


def send_confirmation_email(email: str, code: str):
    """Send a 6-digit confirmation code to the user's email."""
    try:
        params: resend.Emails.SendParams = {
            "from": FROM_ADDRESS,
            "to": [email],
            "subject": f"Your confirmation code: {code}",
            "html": _confirmation_email_html(code),
        }
        result = resend.Emails.send(params)
        print(f"  [Email] Confirmation sent to {email} (id={result.get('id', '?')})")
    except Exception as e:
        print(f"  [Email] Failed to send confirmation: {e}")


def send_alert_email(alert: dict, reminder: dict):
    """
    Send an email when a reminder condition is triggered.
    Silently skips if email not configured / confirmed / enabled.
    alert   — row from the alerts table (id, ticker, message, triggered_at)
    reminder — row from the reminders table (action, condition_type, target_price, etc.)
    """
    try:
        settings = get_user_settings()
        if not settings["email"] or not settings["email_confirmed"] or not settings["email_notifications_enabled"]:
            return

        ticker = alert.get("ticker", "")
        subject = f"🔔 {ticker} Reminder Triggered — {reminder.get('action', 'Check now')}"
        html = _reminder_alert_template(alert, reminder)

        params: resend.Emails.SendParams = {
            "from": FROM_ADDRESS,
            "to": [settings["email"]],
            "subject": subject,
            "html": html,
        }

        result = resend.Emails.send(params)
        print(f"  [Email] Reminder alert sent to {settings['email']}: {subject} (id={result.get('id', '?')})")
    except Exception as e:
        print(f"  [Email] Failed to send reminder alert: {e}")


# ===== Subject Line Builders =====

def _build_subject(notification: dict) -> str:
    ntype = notification.get("type", "")
    symbol = notification.get("symbol", "")
    pct = notification.get("percentChange", 0)
    direction = notification.get("direction", "")

    if ntype == "NEWS_BRIEFING":
        return f"📰 {symbol} — Morning News Briefing"
    elif ntype == "DAILY_EOD":
        arrow = "📈" if direction == "up" else "📉"
        return f"{arrow} {symbol} {'+' if pct >= 0 else ''}{pct:.2f}% — End of Day"
    elif ntype == "MOMENTUM_2H":
        arrow = "🚀" if direction == "up" else "⚠️"
        return f"{arrow} {symbol} {'+' if pct >= 0 else ''}{pct:.2f}% — Momentum Alert"
    elif ntype == "MORNING_GAP":
        arrow = "⬆️" if direction == "up" else "⬇️"
        return f"{arrow} {symbol} {'+' if pct >= 0 else ''}{pct:.2f}% — Morning Gap"
    else:
        return f"🔔 {symbol} — Notification"


# ===== HTML Email Templates =====

COMMON_STYLES = """
<style>
  body { margin: 0; padding: 0; background-color: #0f1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .container { max-width: 560px; margin: 0 auto; padding: 32px 24px; }
  .card { background: #1a1d28; border-radius: 12px; padding: 28px; border: 1px solid #2a2d3a; }
  .logo { color: #6366f1; font-size: 18px; font-weight: 700; margin-bottom: 20px; }
  .symbol { font-size: 28px; font-weight: 800; color: #ffffff; margin-bottom: 4px; }
  .subtitle { font-size: 13px; color: #8b8fa3; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px; }
  .pct-positive { color: #10b981; font-size: 36px; font-weight: 800; }
  .pct-negative { color: #ef4444; font-size: 36px; font-weight: 800; }
  .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a2d3a; }
  .detail-label { color: #8b8fa3; font-size: 13px; }
  .detail-value { color: #e2e4eb; font-size: 13px; font-weight: 600; }
  .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #555870; }
  .article-card { background: #22253a; border-radius: 8px; padding: 14px 16px; margin-bottom: 10px; }
  .article-headline { color: #e2e4eb; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
  .article-summary { color: #8b8fa3; font-size: 12px; line-height: 1.5; margin-bottom: 8px; }
  .article-link { color: #6366f1; font-size: 12px; text-decoration: none; }
  .article-link:hover { text-decoration: underline; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .badge-up { background: rgba(16, 185, 129, 0.15); color: #10b981; }
  .badge-down { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
  .badge-news { background: rgba(99, 102, 241, 0.15); color: #6366f1; }
</style>
"""


def _build_email_html(notification: dict) -> str:
    ntype = notification.get("type", "")

    if ntype == "NEWS_BRIEFING":
        return _news_briefing_template(notification)
    elif ntype == "REMINDER_ALERT":
        return _reminder_alert_template(
            notification.get("_alert", {}),
            notification.get("_reminder", {})
        )
    else:
        return _price_alert_template(notification)


def _reminder_alert_template(alert: dict, reminder: dict) -> str:
    ticker      = alert.get("ticker", "")
    message     = alert.get("message", "")
    action      = reminder.get("action", "")
    ctype       = reminder.get("condition_type", "")
    target      = reminder.get("target_price")
    pct         = reminder.get("percent_change")
    company     = reminder.get("company_name") or ticker
    triggered   = alert.get("triggered_at", "")[:16].replace("T", " ")

    # Build a human-readable condition label
    if ctype == "price_above" and target:
        condition_label = f"Price rose above ${target:.2f}"
    elif ctype == "price_below" and target:
        condition_label = f"Price dropped below ${target:.2f}"
    elif ctype == "percent_change" and pct is not None:
        direction = "gained" if pct > 0 else "dropped"
        condition_label = f"Price {direction} {abs(pct):.1f}%"
    elif ctype == "time_based":
        condition_label = "Scheduled time reached"
    else:
        condition_label = "Custom condition met"

    return f"""
<!DOCTYPE html>
<html>
<head>{COMMON_STYLES}</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">📊 Financial Insights Engine</div>
      <div style="margin-bottom: 20px;">
        <span class="badge" style="background: rgba(244,63,94,0.15); color: #f43f5e;">🔔 Reminder Triggered</span>
      </div>
      <div class="symbol">{ticker}</div>
      <div class="subtitle">{company}</div>

      <div style="background:#22253a; border-radius:8px; padding:16px; margin: 16px 0;">
        <div style="color:#8b8fa3; font-size:12px; margin-bottom:8px;">CONDITION MET</div>
        <div style="color:#f43f5e; font-size:20px; font-weight:700;">{condition_label}</div>
      </div>

      <div style="background:#22253a; border-radius:8px; padding:16px; margin-bottom:12px;">
        <div style="color:#8b8fa3; font-size:12px; margin-bottom:6px;">DETAILS</div>
        <div style="color:#e2e4eb; font-size:14px; line-height:1.6;">{message}</div>
      </div>

      {'<div style="background:#22253a; border-radius:8px; padding:16px;"><div style="color:#8b8fa3; font-size:12px; margin-bottom:6px;">YOUR ACTION</div><div style="color:#e2e4eb; font-size:14px; font-weight:600;">' + action + '</div></div>' if action else ''}

      <div style="color:#555870; font-size:12px; margin-top:16px;">Triggered at {triggered}</div>
    </div>
    <div class="footer">
      Financial Insights Engine • You're receiving this because email notifications are enabled.
    </div>
  </div>
</body>
</html>
"""


def _price_alert_template(notification: dict) -> str:
    symbol = notification.get("symbol", "")
    ntype = notification.get("type", "")
    pct = notification.get("percentChange", 0)
    direction = notification.get("direction", "up")
    message = notification.get("message", "")
    title = notification.get("title", "")

    is_up = direction == "up"
    pct_class = "pct-positive" if is_up else "pct-negative"
    pct_str = f"+{pct:.2f}%" if pct >= 0 else f"{pct:.2f}%"
    arrow = "▲" if is_up else "▼"

    type_labels = {
        "DAILY_EOD": "End of Day Summary",
        "MOMENTUM_2H": "Momentum Alert",
        "MORNING_GAP": "Morning Gap",
    }
    badge_class = "badge-up" if is_up else "badge-down"
    type_label = type_labels.get(ntype, ntype)

    return f"""
<!DOCTYPE html>
<html>
<head>{COMMON_STYLES}</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">📊 Financial Insights Engine</div>
      <div style="margin-bottom: 20px;">
        <span class="badge {badge_class}">{type_label}</span>
      </div>
      <div class="symbol">{symbol}</div>
      <div class="subtitle">{title}</div>
      <div style="text-align: center; padding: 24px 0;">
        <div class="{pct_class}">{arrow} {pct_str}</div>
      </div>
      <div style="background: #22253a; border-radius: 8px; padding: 16px; margin-top: 12px;">
        <div style="color: #8b8fa3; font-size: 12px; margin-bottom: 6px;">DETAILS</div>
        <div style="color: #e2e4eb; font-size: 14px; line-height: 1.6;">{message}</div>
      </div>
    </div>
    <div class="footer">
      Financial Insights Engine • You're receiving this because email notifications are enabled.
    </div>
  </div>
</body>
</html>
"""


def _news_briefing_template(notification: dict) -> str:
    import json
    symbol = notification.get("symbol", "")
    articles_raw = notification.get("articles", "")

    articles = []
    if isinstance(articles_raw, str) and articles_raw:
        try:
            articles = json.loads(articles_raw)
        except Exception:
            pass
    elif isinstance(articles_raw, list):
        articles = articles_raw

    articles_html = ""
    if articles:
        for art in articles[:5]:
            headline = art.get("headline", "Untitled")
            summary = art.get("summary", "")
            url = art.get("url", "#")
            source = art.get("source", "")
            source_tag = f'<span style="color: #6366f1; font-size: 11px;">({source})</span>' if source else ""

            articles_html += f"""
      <div class="article-card">
        <div class="article-headline">{headline} {source_tag}</div>
        {'<div class="article-summary">' + summary[:200] + ('...' if len(summary) > 200 else '') + '</div>' if summary else ''}
        <a href="{url}" class="article-link">Read full article →</a>
      </div>
"""
    else:
        articles_html = '<div style="color: #8b8fa3; text-align: center; padding: 20px;">No articles found today.</div>'

    return f"""
<!DOCTYPE html>
<html>
<head>{COMMON_STYLES}</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">📊 Financial Insights Engine</div>
      <div style="margin-bottom: 20px;">
        <span class="badge badge-news">Morning News Briefing</span>
      </div>
      <div class="symbol">{symbol}</div>
      <div class="subtitle">Today's Top Headlines</div>
      {articles_html}
    </div>
    <div class="footer">
      Financial Insights Engine • You're receiving this because email notifications are enabled.
    </div>
  </div>
</body>
</html>
"""


def _confirmation_email_html(code: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head>{COMMON_STYLES}</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">📊 Financial Insights Engine</div>
      <div class="symbol" style="font-size: 22px;">Confirm Your Email</div>
      <div class="subtitle">Enter this code in the app to enable email notifications</div>
      <div style="text-align: center; padding: 28px 0;">
        <div style="display: inline-block; background: #22253a; padding: 16px 40px; border-radius: 12px; border: 2px solid #6366f1;">
          <span style="font-size: 36px; font-weight: 800; color: #ffffff; letter-spacing: 12px;">{code}</span>
        </div>
      </div>
      <div style="color: #8b8fa3; font-size: 13px; text-align: center;">
        This code expires when you submit a new email address.
      </div>
    </div>
    <div class="footer">
      Financial Insights Engine • If you didn't request this, you can ignore this email.
    </div>
  </div>
</body>
</html>
"""
