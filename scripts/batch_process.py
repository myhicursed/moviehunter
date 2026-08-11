"""
Пакетная обработка всех видео из папки.

Кладёшь raw-видео в папку `raw/`, называешь как хочешь.
Запускаешь скрипт — обработанные попадают в `processed/`.

Использование:
    python scripts/batch_process.py
    python scripts/batch_process.py --duration 8 --quality 720p
"""

import argparse
import os
from pathlib import Path

from process_video import check_ffmpeg, process_video


def main():
    parser = argparse.ArgumentParser(description="Пакетная обработка видео")
    parser.add_argument("--input-dir", default="raw", help="Папка с исходниками")
    parser.add_argument(
        "--output-dir", default="processed", help="Папка для результатов"
    )
    parser.add_argument("--start", type=float, default=0, help="Секунда начала")
    parser.add_argument("--duration", type=float, default=10, help="Длительность")
    parser.add_argument("--no-mirror", action="store_true")
    parser.add_argument("--quality", default="480p")
    parser.add_argument("--mute", action="store_true")

    args = parser.parse_args()

    if not check_ffmpeg():
        print("❌ FFmpeg не установлен!")
        return

    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)

    if not input_dir.exists():
        print(f"❌ Папка не найдена: {input_dir}")
        return

    output_dir.mkdir(exist_ok=True)

    # Ищем все видео
    extensions = [".mp4", ".mkv", ".avi", ".mov", ".webm"]
    videos = [f for f in input_dir.iterdir() if f.suffix.lower() in extensions]

    if not videos:
        print(f"❌ В папке {input_dir} нет видео")
        return

    print(f"📦 Найдено видео: {len(videos)}")
    print()

    success_count = 0
    for video in videos:
        output_path = output_dir / f"{video.stem}.mp4"

        success = process_video(
            input_path=str(video),
            output_path=str(output_path),
            start=args.start,
            duration=args.duration,
            mirror=not args.no_mirror,
            quality=args.quality,
            mute=args.mute,
        )

        if success:
            success_count += 1
        print("-" * 60)

    print(f"\n🎉 Обработано: {success_count}/{len(videos)}")


if __name__ == "__main__":
    main()
