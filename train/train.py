# train/train.py
import argparse
import math
from pathlib import Path

import torch
import torch.nn as nn

from model.config import ModelConfig, TrainConfig
from model.cot_head import compute_think_weighted_loss
from model.transformer import FlareSLM
from train.dataloader import ShardedDataset


def get_lr(step: int, config: TrainConfig) -> float:
    if step < config.warmup_steps:
        return config.learning_rate * step / config.warmup_steps

    if step > config.max_steps:
        return config.min_learning_rate

    decay_ratio = (step - config.warmup_steps) / (config.max_steps - config.warmup_steps)
    coeff = 0.5 * (1.0 + math.cos(math.pi * decay_ratio))
    return config.min_learning_rate + coeff * (config.learning_rate - config.min_learning_rate)


def train(shard_dir: str, checkpoint_dir: str, resume_from: str | None) -> None:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    n_gpus = torch.cuda.device_count()

    model_config = ModelConfig()
    train_config = TrainConfig()

    model = FlareSLM(model_config, gradient_checkpointing=train_config.gradient_checkpointing).to(device)

    raw_model = model
    if n_gpus > 1:
        model = nn.DataParallel(model)
        print(f"Using {n_gpus} GPUs via DataParallel")

    print(f"Model parameters: {raw_model.num_parameters():,}")

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=train_config.learning_rate,
        weight_decay=train_config.weight_decay,
        betas=(0.9, 0.95),
    )

    train_dataset = ShardedDataset(shard_dir, "train", model_config.max_seq_len)
    val_dataset = ShardedDataset(shard_dir, "val", model_config.max_seq_len)

    scaler = torch.cuda.amp.GradScaler(enabled=train_config.mixed_precision == "fp16")
    amp_dtype = torch.bfloat16 if train_config.mixed_precision == "bf16" else torch.float16

    start_step = 0
    if resume_from is not None:
        checkpoint = torch.load(resume_from, map_location=device)
        raw_model.load_state_dict(checkpoint["model"])
        optimizer.load_state_dict(checkpoint["optimizer"])
        start_step = checkpoint["step"]
        print(f"Resumed from step {start_step}")

    Path(checkpoint_dir).mkdir(parents=True, exist_ok=True)

    effective_batch = train_config.batch_size * max(n_gpus, 1)

    model.train()
    for step in range(start_step, train_config.max_steps):
        lr = get_lr(step, train_config)
        for param_group in optimizer.param_groups:
            param_group["lr"] = lr

        optimizer.zero_grad(set_to_none=True)
        accumulated_loss = 0.0

        for _ in range(train_config.grad_accum_steps):
            x, y = train_dataset.get_batch(effective_batch, device)

            with torch.autocast(device_type=device, dtype=amp_dtype):
                logits, think_scores, load_balance_loss = model(x)
                think_mask = raw_model.think_gate.build_think_mask(x)
                lm_loss = compute_think_weighted_loss(logits, y, think_mask)
                loss = lm_loss + 0.01 * load_balance_loss.mean()
                loss = loss / train_config.grad_accum_steps

            scaler.scale(loss).backward()
            accumulated_loss += loss.item()

        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), train_config.grad_clip)
        scaler.step(optimizer)
        scaler.update()

        if step % 10 == 0:
            print(f"step {step} | loss {accumulated_loss:.4f} | lr {lr:.6f}")

        if step % train_config.eval_interval == 0 and step > 0:
            evaluate(model, raw_model, val_dataset, train_config, device, amp_dtype, effective_batch)

        if step % train_config.checkpoint_interval == 0 and step > 0:
            save_checkpoint(raw_model, optimizer, step, checkpoint_dir)

    save_checkpoint(raw_model, optimizer, train_config.max_steps, checkpoint_dir)


@torch.no_grad()
def evaluate(model, raw_model, val_dataset, train_config, device, amp_dtype, batch_size, eval_iters: int = 20) -> None:
    model.eval()
    losses = []

    for _ in range(eval_iters):
        x, y = val_dataset.get_batch(batch_size, device)
        with torch.autocast(device_type=device, dtype=amp_dtype):
            logits, _, load_balance_loss = model(x)
            think_mask = raw_model.think_gate.build_think_mask(x)
            loss = compute_think_weighted_loss(logits, y, think_mask) + 0.01 * load_balance_loss.mean()
        losses.append(loss.item())

    print(f"eval loss: {sum(losses) / len(losses):.4f}")
    model.train()


def save_checkpoint(raw_model, optimizer, step: int, checkpoint_dir: str) -> None:
    path = Path(checkpoint_dir) / f"checkpoint_{step:06d}.pth"
    torch.save(
        {
            "model": raw_model.state_dict(),
            "optimizer": optimizer.state_dict(),
            "step": step,
        },
        path,
    )
    print(f"Checkpoint saved: {path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train the Flare SLM.")
    parser.add_argument("--shards", type=str, required=True)
    parser.add_argument("--checkpoints", type=str, default="checkpoints")
    parser.add_argument("--resume", type=str, default=None)
    args = parser.parse_args()

    train(args.shards, args.checkpoints, args.resume)