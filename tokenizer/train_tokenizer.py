import argparse
from pathlib import Path

from tokenizers import ByteLevelBPETokenizer


def train(corpus_path: str, output_dir: str, vocab_size: int, min_frequency: int) -> None:
    tokenizer = ByteLevelBPETokenizer()

    special_tokens = ["<pad>", "<bos>", "<eos>", "<unk>", "<think>", "</think>"]

    tokenizer.train(
        files=[corpus_path],
        vocab_size=vocab_size,
        min_frequency=min_frequency,
        special_tokens=special_tokens,
    )

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    tokenizer.save_model(output_dir)
    tokenizer.save(str(Path(output_dir) / "tokenizer.json"))

    print(f"Tokenizer saved to {output_dir}")
    print(f"Vocab size: {tokenizer.get_vocab_size()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train a byte-level BPE tokenizer.")
    parser.add_argument("--corpus", type=str, required=True, help="Path to raw text corpus (.txt)")
    parser.add_argument("--output", type=str, default="tokenizer", help="Output directory")
    parser.add_argument("--vocab-size", type=int, default=32000)
    parser.add_argument("--min-frequency", type=int, default=2)
    args = parser.parse_args()

    train(args.corpus, args.output, args.vocab_size, args.min_frequency)