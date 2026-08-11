"""
Обработка видеоотрывков для квиза.

Простой запуск:
    python scripts/process_video.py 1.mp4 2.mp4

По умолчанию:
    - Зеркалит видео
    - Сжимает до 480p
    - Берёт весь файл (не обрезает по времени)
    - Не обрезает чёрные полосы

Дополнительные флаги:
    --crop           обрезать чёрные полосы
    --no-mirror      не зеркалить
    --duration 10    взять только 10 секунд
    --start 5        начать с 5-й секунды
    --quality 720p   качество (360p/480p/720p/1080p)
    --mute           убрать звук
    --crf 25         сжатие (18-32, меньше = лучше качество)
"""

import argparse
import os
import re
import subprocess
import sys

QUALITY_PRESETS = {
    "360p": "640:360",
    "480p": "854:480",
    "720p": "1280:720",
    "1080p": "1920:1080",
}


def check_ffmpeg() -> bool:
    """Проверяет, установлен ли FFmpeg."""
    try:
        subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            check=True,
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def detect_crop(input_path: str, start: float = 0, duration: float = 5) -> str | None:
    """
    Определяет параметры обрезки чёрных полос.
    Возвращает строку типа "crop=1920:800:0:140" или None.
    """
    print("🔍 Анализирую чёрные полосы...")

    command = [
        "ffmpeg",
        "-ss",
        str(start),
        "-i",
        input_path,
        "-t",
        str(duration),
        "-vf",
        "cropdetect=24:16:0",
        "-f",
        "null",
        "-",
    ]

    result = subprocess.run(command, capture_output=True, text=True)

    matches = re.findall(r"crop=(\d+:\d+:\d+:\d+)", result.stderr)

    if matches:
        crop_value = matches[-1]
        print(f"   Найдены параметры обрезки: crop={crop_value}")
        return f"crop={crop_value}"

    print("   ⚠️  Чёрные полосы не найдены, пропускаю обрезку")
    return None


def process_video(
    input_path: str,
    output_path: str,
    start: float = 0,
    duration: float | None = None,
    mirror: bool = True,
    quality: str = "480p",
    crf: int = 28,
    mute: bool = False,
    auto_crop: bool = False,
) -> bool:
    """
    Обрабатывает видео: зеркалит, сжимает.
    По умолчанию берёт весь файл (duration=None), не обрезает чёрные полосы.
    """
    if not os.path.exists(input_path):
        print(f"❌ Файл не найден: {input_path}")
        return False

    if quality not in QUALITY_PRESETS:
        print(f"❌ Неизвестное качество: {quality}")
        return False

    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    # 1. Обрезка чёрных полос (только если явно указан --crop)
    crop_filter = None
    if auto_crop:
        detect_duration = min(duration, 5) if duration else 5
        crop_filter = detect_crop(input_path, start=start, duration=detect_duration)

    # 2. Собираем фильтры
    filters = []

    if crop_filter:
        filters.append(crop_filter)

    if mirror:
        filters.append("hflip")

    filters.append(f"scale={QUALITY_PRESETS[quality]}")

    filter_str = ",".join(filters)

    # 3. Команда FFmpeg
    command = ["ffmpeg", "-ss", str(start), "-i", input_path]

    # Обрезка по времени — только если явно указано
    if duration is not None:
        command.extend(["-t", str(duration)])

    command.extend(
        [
            "-vf",
            filter_str,
            "-c:v",
            "libx264",
            "-crf",
            str(crf),
            "-preset",
            "medium",
            "-movflags",
            "+faststart",
        ]
    )

    if mute:
        command.append("-an")
    else:
        command.extend(["-c:a", "aac", "-b:a", "96k"])

    command.extend(["-y", output_path])

    print(f"🎬 Обрабатываю: {input_path}")
    print(f"   → {output_path}")
    if duration:
        print(f"   Отрезок: {start}с — {start + duration}с ({duration}с)")
    else:
        print(f"   Длительность: весь файл (с {start}с)")
    print(
        f"   Качество: {quality}, зеркалить: {'да' if mirror else 'нет'}, звук: {'нет' if mute else 'да'}"
    )
    print(f"   Фильтры: {filter_str}")
    print()

    result = subprocess.run(command, capture_output=True, text=True)

    if result.returncode != 0:
        print("❌ Ошибка FFmpeg:")
        print(result.stderr[-500:])
        return False

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print("✅ Готово!")
    print(f"   📁 Файл: {output_path}")
    print(f"   📏 Размер: {size_mb:.2f} МБ")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Обработка видеоотрывков для квиза",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры:
  python scripts/process_video.py raw.mp4 clip.mp4
  python scripts/process_video.py raw.mp4 clip.mp4 --quality 720p
  python scripts/process_video.py raw.mp4 clip.mp4 --duration 10 --start 5
  python scripts/process_video.py raw.mp4 clip.mp4 --crop --no-mirror
        """,
    )

    parser.add_argument("input", help="Входной файл")
    parser.add_argument("output", help="Выходной файл")
    parser.add_argument(
        "--start", type=float, default=0, help="Секунда начала (по умолчанию 0)"
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=None,
        help="Длительность в секундах (по умолчанию — весь файл)",
    )
    parser.add_argument(
        "--no-mirror", action="store_true", help="Не зеркалить (по умолчанию зеркалит)"
    )
    parser.add_argument(
        "--quality",
        default="480p",
        choices=list(QUALITY_PRESETS.keys()),
        help="Качество (по умолчанию 480p)",
    )
    parser.add_argument(
        "--crf", type=int, default=28, help="Сжатие 18-32 (по умолчанию 28)"
    )
    parser.add_argument("--mute", action="store_true", help="Убрать звук")
    parser.add_argument("--crop", action="store_true", help="Обрезать чёрные полосы")

    args = parser.parse_args()

    if not check_ffmpeg():
        print("❌ FFmpeg не установлен или не в PATH!")
        sys.exit(1)

    success = process_video(
        input_path=args.input,
        output_path=args.output,
        start=args.start,
        duration=args.duration,
        mirror=not args.no_mirror,
        quality=args.quality,
        crf=args.crf,
        mute=args.mute,
        auto_crop=args.crop,
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
