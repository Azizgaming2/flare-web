import argparse
from pathlib import Path

import numpy as np
from tokenizers import Tokenizer
from tqdm import tqdm


def tokenize_to_shards(
    input_path: str,
    tokenizer_path: str,
    output_dir: str,
    shard_size: int,
    val_ratio: float,
) -> None:
    tokenizer = Tokenizer.from_file(tokenizer_path)
    eos_id = tokenizer.token_to_id("<eos>")

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    with open(input_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    val_count = int(len(lines) * val_ratio)
    train_lines = lines[val_count:]
    val_lines = lines[:val_count]

    _write_shards(train_lines, tokenizer, eos_id, output_path, "train", shard_size)
    _write_shards(val_lines, tokenizer, eos_id, output_path, "val", shard_size)


def _write_shards(
    lines: list[str],
    tokenizer: Tokenizer,
    eos_id: int,
    output_path: Path,
    split_name: str,
    shard_size: int,
) -> None:
    buffer: list[int] = []
    shard_idx = 0

    for line in tqdm(lines, desc=f"Tokenizing {split_name}"):
        ids = tokenizer.encode(line.strip()).ids
        ids.append(eos_id)
        buffer.extend(ids)

        while len(buffer) >= shard_size:
            shard = np.array(buffer[:shard_size], dtype=np.uint16)
            shard_path = output_path / f"{split_name}_{shard_idx:04d}.bin"
            shard.tofile(shard_path)
            buffer = buffer[shard_size:]
            shard_idx += 1

    if buffer:
        shard = np.array(buffer, dtype=np.uint16)
        shard_path = output_path / f"{split_name}_{shard_idx:04d}.bin"
        shard.tofile(shard_path)

    print(f"{split_name}: {shard_idx + 1} shard(s) written to {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Tokenize a cleaned text corpus into binary shards.")
    parser.add_argument("--input", type=str, required=True)
    parser.add_argument("--tokenizer", type=str, required=True, help="Path to tokenizer.json")
    parser.add_argument("--output", type=str, default="data/shards")
    parser.add_argument("--shard-size", type=int, default=10_000_000, help="Tokens per shard")
    parser.add_argument("--val-ratio", type=float, default=0.01)
    args = parser.parse_args()

    tokenize_to_shards(args.input, args.tokenizer, args.output, args.shard_size, args.val_ratio)