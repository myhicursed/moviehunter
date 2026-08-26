from datetime import (
    date,
    datetime,
    timedelta,
    timezone,
)
from zoneinfo import (
    ZoneInfo,
    ZoneInfoNotFoundError,
)

try:
    MOSCOW_TZ = ZoneInfo("Europe/Moscow")

except ZoneInfoNotFoundError:
    # Москва круглый год UTC+3
    MOSCOW_TZ = timezone(timedelta(hours=3))


def now_moscow() -> datetime:
    return datetime.now(MOSCOW_TZ)


def today_moscow() -> date:
    return now_moscow().date()
