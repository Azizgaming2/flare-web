import argparse
import re
from pathlib import Path


CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
MULTI_SPACE = re.compile(r"[ \t]{2,}")


def clean_line(line: str) -> str:
    line = CONTROL_CHARS.sub("", line)
    line = MULTI_SPACE.sub(" ", line)
    return line.strip()


def clean_file(input_path: str, output_path: str, min_chars: int, max_chars: int, dedup: bool) -> None:
    seen: set[int] = set()
    written = 0
    skipped_short = 0
    skipped_dup = 0
    total = 0

    with open(input_path, "r", encoding="utf-8") as fin, \
         open(output_path, "w", encoding="utf-8") as fout:
        for raw_line in fin:
            total += 1
            line = clean_line(raw_line)

            if len(line) < min_chars:
                skipped_short += 1
                continue

            if len(line) > max_chars:
                line = line[:max_chars]

            if dedup:
                key = hash(line)
                if key in seen:
                    skipped_dup += 1
                    continue
                seen.add(key)

            fout.write(line + "\n")
            written += 1

            if total % 500_000 == 0:
                print(f"Processed {total:,} lines | written {written:,} | dedup set size {len(seen):,}")

    print(f"Done. Written: {written:,} | Skipped short: {skipped_short:,} | Skipped dup: {skipped_dup:,}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clean and optionally deduplicate raw text corpus.")
    parser.add_argument("--input", type=str, required=True)
    parser.add_argument("--output", type=str, required=True)
    parser.add_argument("--min-chars", type=int, default=20)
    parser.add_argument("--max-chars", type=int, default=10000)
    parser.add_argument("--no-dedup", action="store_true", help="Skip in-memory deduplication (use for very large files)")
    args = parser.parse_args()

    clean_file(args.input, args.output, args.min_chars, args.max_chars, dedup=not args.no_dedup)