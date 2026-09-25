# tokenize_dataset.py
import argparse
import random
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
    batch_lines: int = 20_000,
    seed: int = 42,
) -> None:
    tokenizer = Tokenizer.from_file(tokenizer_path)
    eos_id = tokenizer.token_to_id("<eos>")
    rng = random.Random(seed)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    buffers = {"train": [], "val": []}
    shard_idx = {"train": 0, "val": 0}

    def flush(split: str, force: bool = False):
        buf = buffers[split]
        while len(buf) >= shard_size or (force and buf):
            take = buf[:shard_size]
            shard = np.array(take, dtype=np.uint16)
            path = output_path / f"{split}_{shard_idx[split]:04d}.bin"
            shard.tofile(path)
            shard_idx[split] += 1
            buffers[split] = buf[shard_size:]
            buf = buffers[split]
            if not force:
                break

    with open(input_path, "r", encoding="utf-8") as f:
        total = sum(1 for _ in f)

    def batched_lines(path: str, n: int):
        batch = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    batch.append(line)
                if len(batch) >= n:
                    yield batch
                    batch = []
        if batch:
            yield batch

    pbar = tqdm(total=total, desc="Tokenizing")
    for batch in batched_lines(input_path, batch_lines):
        encodings = tokenizer.encode_batch(batch)
        for enc in encodings:
            split = "val" if rng.random() < val_ratio else "train"
            ids = enc.ids
            ids.append(eos_id)
            buffers[split].extend(ids)
        flush("train")
        flush("val")
        pbar.update(len(batch))
    pbar.close()

    flush("train", force=True)
    flush("val", force=True)

    for split in ("train", "val"):
        print(f"{split}: {shard_idx[split]} shard(s) written to {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Tokenize a cleaned text corpus into binary shards.")
    parser.add_argument("--input", type=str, required=True)
    parser.add_argument("--tokenizer", type=str, required=True)
    parser.add_argument("--output", type=str, default="data/shards")
    parser.add_argument("--shard-size", type=int, default=10_000_000)
    parser.add_argument("--val-ratio", type=float, default=0.01)
    parser.add_argument("--batch-lines", type=int, default=20_000)
    args = parser.parse_args()

    tokenize_to_shards(
        args.input, args.tokenizer, args.output,
        args.shard_size, args.val_ratio, args.batch_lines,
    )