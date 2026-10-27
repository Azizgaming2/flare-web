from datetime import date, datetime


def json_default(value):
    """Convert Firestore timestamps and dates to JSON-safe values."""

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if hasattr(value, "isoformat") and callable(value.isoformat):
        return value.isoformat()

    # Fallback for other non-JSON-native values.
    return str(value)