import torch
import torch.nn as nn
import torch.utils.checkpoint as checkpoint

from model.attention import GroupedQueryAttention
from model.config import ModelConfig
from model.cot_head import ThinkGate
from model.moe import MoELayer


class RMSNorm(nn.Module):
    def __init__(self, dim: int, eps: float):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        norm = x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps)
        return norm * self.weight


class TransformerBlock(nn.Module):
    def __init__(self, config: ModelConfig):
        super().__init__()
        self.attn_norm = RMSNorm(config.dim, config.rms_norm_eps)
        self.attn = GroupedQueryAttention(config)
        self.moe_norm = RMSNorm(config.dim, config.rms_norm_eps)
        self.moe = MoELayer(config)

    def forward(self, x: torch.Tensor, attn_mask: torch.Tensor | None = None) -> tuple[torch.Tensor, torch.Tensor]:
        x = x + self.attn(self.attn_norm(x), attn_mask)
        moe_out, load_balance_loss = self.moe(self.moe_norm(x))
        x = x + moe_out
        return x, load_balance_loss


class FlareSLM(nn.Module):
    def __init__(self, config: ModelConfig, gradient_checkpointing: bool = False):
        super().__init__()
        self.config = config
        self.gradient_checkpointing = gradient_checkpointing

        self.token_embedding = nn.Embedding(config.vocab_size, config.dim)
        self.blocks = nn.ModuleList([TransformerBlock(config) for _ in range(config.n_layers)])
        self.final_norm = RMSNorm(config.dim, config.rms_norm_eps)
        self.lm_head = nn.Linear(config.dim, config.vocab_size, bias=False)
        self.think_gate = ThinkGate(config)

        self.token_embedding.weight = self.lm_head.weight

        self.apply(self._init_weights)

    def _init_weights(self, module: nn.Module) -> None:
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def _run_block(self, block: TransformerBlock, x: torch.Tensor, attn_mask: torch.Tensor | None):
        if self.gradient_checkpointing and self.training:
            def custom_forward(x_inner):
                return block(x_inner, attn_mask)
            return checkpoint.checkpoint(custom_forward, x, use_reentrant=False)
        return block(x, attn_mask)

    def forward(
        self,
        input_ids: torch.Tensor,
        attn_mask: torch.Tensor | None = None,
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        x = self.token_embedding(input_ids)

        total_load_balance_loss = torch.zeros(1, device=input_ids.device)
        for block in self.blocks:
            x, load_balance_loss = self._run_block(block, x, attn_mask)
            total_load_balance_loss = total_load_balance_loss + load_balance_loss

        x = self.final_norm(x)
        logits = self.lm_head(x)
        think_scores = self.think_gate(x)

        avg_load_balance_loss = total_load_balance_loss / len(self.blocks)
        return logits, think_scores, avg_load_balance_loss

    def num_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters())