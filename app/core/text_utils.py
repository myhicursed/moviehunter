def clean_title_for_letters(text: str) -> str:
    return text.split(":")[0].strip().upper()
