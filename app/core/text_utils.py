import re

from app.core.banned_words import BANNED_WORDS, CHAR_REPLACEMENTS

LATIN_TO_CYRILLIC = {
    "a": "а",
    "b": "б",
    "c": "с",
    "d": "д",
    "e": "е",
    "f": "ф",
    "g": "г",
    "h": "х",
    "i": "и",
    "j": "й",
    "k": "к",
    "l": "л",
    "m": "м",
    "n": "н",
    "o": "о",
    "p": "р",
    "q": "к",
    "r": "р",
    "s": "с",
    "t": "т",
    "u": "у",
    "v": "в",
    "w": "в",
    "x": "х",
    "y": "у",
    "z": "з",
}


def clean_title_for_letters(text: str) -> str:
    return text.split(":")[0].strip().upper()


def normalize_username(username: str) -> str:
    """
    Нормализует ник для проверки:
    - в нижний регистр
    - убирает цифры-заменители (0->о, 1->и и т.д.)
    - убирает разделители (. _ - и т.д.)
    - заменяет каждую латинскую букву на похожую кириллическую
    """
    text = username.lower().strip()

    # 1. Замена символов-обходов (цифры → буквы, спецсимволы → пусто)
    for old, new in CHAR_REPLACEMENTS.items():
        text = text.replace(old, new)

    # 2. Каждую латинскую букву заменяем на похожую кириллическую
    result = []
    for char in text:
        if char in LATIN_TO_CYRILLIC:
            result.append(LATIN_TO_CYRILLIC[char])
        else:
            result.append(char)
    text = "".join(result)

    # 3. Убираем всё, что не буквы/цифры
    text = re.sub(r"[^а-яё0-9]", "", text)

    return text


def is_username_banned(username: str) -> tuple[bool, str | None]:
    """
    Проверяет ник на запрещённые слова.
    Проверяет и оригинал, и нормализованную версию.
    """
    # Проверка на пустоту
    if not username or not username.strip():
        return True, "empty"

    normalized = normalize_username(username)

    if not normalized:
        return True, "empty"

    # Проверка нормализованной версии
    for word in BANNED_WORDS:
        if word in normalized:
            return True, word

    # Дополнительно — проверяем оригинал в нижнем регистре (для латинских слов)
    original_lower = username.lower()
    for word in BANNED_WORDS:
        if word in original_lower:
            return True, word

    return False, None
