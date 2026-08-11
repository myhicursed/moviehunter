from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.donation import Donation


async def create_donation(
    session: AsyncSession,
    nickname: str,
    amount: int,
    message: str | None = None,
) -> Donation:
    donation = Donation(
        nickname=nickname,
        amount=amount,
        message=message,
    )
    session.add(donation)
    await session.commit()
    await session.refresh(donation)
    return donation


async def get_top_donations(session: AsyncSession, limit: int = 10) -> list[dict]:
    # Подзапрос: последнее сообщение для каждого ника
    latest_msg_sq = (
        select(
            Donation.nickname.label("nick"),
            Donation.message.label("msg"),
            Donation.created_at.label("dt"),
        )
        .order_by(Donation.nickname, Donation.created_at.desc())
        .distinct(Donation.nickname)
        .subquery()
    )

    stmt = (
        select(
            Donation.nickname,
            func.sum(Donation.amount).label("total_amount"),
            func.max(Donation.created_at).label("last_donation"),
            func.count(Donation.id).label("donations_count"),
        )
        .group_by(Donation.nickname)
        .order_by(func.sum(Donation.amount).desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    rows = result.all()

    # Получаем последнее сообщение отдельным запросом (проще)
    donators = []
    for row in rows:
        # Ищем последнее непустое сообщение для этого ника
        msg_stmt = (
            select(Donation.message)
            .where(
                Donation.nickname == row.nickname,
                Donation.message.is_not(None),
            )
            .order_by(Donation.created_at.desc())
            .limit(1)
        )
        msg_result = await session.execute(msg_stmt)
        last_message = msg_result.scalar_one_or_none()

        donators.append(
            {
                "nickname": row.nickname,
                "total_amount": row.total_amount,
                "last_donation": row.last_donation,
                "donations_count": row.donations_count,
                "last_message": last_message,
            }
        )

    return donators


async def get_recent_donations(
    session: AsyncSession, limit: int = 20
) -> list[Donation]:
    """Последние N донатов (для админки/истории)."""
    stmt = select(Donation).order_by(Donation.created_at.desc()).limit(limit)
    result = await session.execute(stmt)
    return list(result.scalars().all())
