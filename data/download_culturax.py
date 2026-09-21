import argparse
from pathlib import Path

from datasets import load_dataset


def download(language: str, output_dir: str, max_docs: int | None) -> None:
    dataset = load_dataset("uonlp/CulturaX", language, split="train", streaming=True)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    out_file = output_path / f"culturax_{language}.txt"

    count = 0
    with open(out_file, "w", encoding="utf-8") as f:
        for example in dataset:
            text = example.get("text", "").strip()
            if not text:
                continue
            f.write(text + "\n")
            count += 1
            if max_docs is not None and count >= max_docs:
                break

    print(f"Saved {count} documents to {out_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Stream and save CulturaX documents to a text file.")
    parser.add_argument("--language", type=str, default="az", help="CulturaX language subset code")
    parser.add_argument("--output", type=str, default="data/raw", help="Output directory")
    parser.add_argument("--max-docs", type=int, default=None, help="Optional document limit")
    args = parser.parse_args()

    download(args.language, args.output, args.max_docs)