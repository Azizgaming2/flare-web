from pathlib import Path

import numpy as np
import torch


class ShardedDataset:
    def __init__(self, shard_dir: str, split: str, seq_len: int):
        self.seq_len = seq_len
        self.shard_paths = sorted(Path(shard_dir).glob(f"{split}_*.bin"))
        if not self.shard_paths:
            raise FileNotFoundError(f"No shards found for split '{split}' in {shard_dir}")

        self.shard_sizes = [
            np.memmap(p, dtype=np.uint16, mode="r").shape[0] for p in self.shard_paths
        ]

    def get_batch(self, batch_size: int, device: str) -> tuple[torch.Tensor, torch.Tensor]:
        shard_idx = np.random.randint(0, len(self.shard_paths))
        shard = np.memmap(self.shard_paths[shard_idx], dtype=np.uint16, mode="r")

        max_start = len(shard) - self.seq_len - 1
        starts = np.random.randint(0, max_start, size=batch_size)

        x = np.stack([shard[s : s + self.seq_len].astype(np.int64) for s in starts])
        y = np.stack([shard[s + 1 : s + 1 + self.seq_len].astype(np.int64) for s in starts])

        x = torch.from_numpy(x)
        y = torch.from_numpy(y)

        if device.startswith("cuda"):
            x = x.pin_memory().to(device, non_blocking=True)
            y = y.pin_memory().to(device, non_blocking=True)
        else:
            x = x.to(device)
            y = y.to(device)

        return x, y