from sqlalchemy.ext.asyncio import AsyncSession

from app.models.game_answer import GameAnswer


async def create_game_answer(
    session: AsyncSession,
    user_id: int,
    movie_id: int,
    is_correct: bool,
    points: int,
) -> GameAnswer:
    game = GameAnswer(
        user_id=user_id,
        movie_id=movie_id,
        is_correct=is_correct,
        points=points,
    )
    session.add(game)
    await session.commit()
    await session.refresh(game)
    return game
