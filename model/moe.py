import torch
import torch.nn as nn
import torch.nn.functional as F

from model.config import ModelConfig


class Expert(nn.Module):
    def __init__(self, dim: int, hidden_dim: int):
        super().__init__()
        self.gate_proj = nn.Linear(dim, hidden_dim, bias=False)
        self.up_proj = nn.Linear(dim, hidden_dim, bias=False)
        self.down_proj = nn.Linear(hidden_dim, dim, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.down_proj(F.silu(self.gate_proj(x)) * self.up_proj(x))


class MoELayer(nn.Module):
    def __init__(self, config: ModelConfig):
        super().__init__()
        self.n_experts = config.n_experts
        self.top_k = config.n_experts_per_token

        self.router = nn.Linear(config.dim, config.n_experts, bias=False)
        self.experts = nn.ModuleList(
            [Expert(config.dim, config.expert_hidden_dim) for _ in range(config.n_experts)]
        )

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        batch, seq_len, dim = x.shape
        x_flat = x.view(-1, dim)

        router_logits = self.router(x_flat)
        router_probs = F.softmax(router_logits, dim=-1)
        top_probs, top_indices = torch.topk(router_probs, self.top_k, dim=-1)
        top_probs = top_probs / top_probs.sum(dim=-1, keepdim=True)

        output = torch.zeros_like(x_flat)

        for expert_idx in range(self.n_experts):
            token_mask, k_slot = torch.where(top_indices == expert_idx)
            if token_mask.numel() == 0:
                continue

            expert_input = x_flat[token_mask]
            expert_output = self.experts[expert_idx](expert_input)
            weights = top_probs[token_mask, k_slot].unsqueeze(-1)
            output.index_add_(0, token_mask, expert_output * weights)

        output = output.view(batch, seq_len, dim)
        load_balance_loss = self._load_balance_loss(router_probs, top_indices)
        return output, load_balance_loss

    def _load_balance_loss(self, router_probs: torch.Tensor, top_indices: torch.Tensor) -> torch.Tensor:
        tokens_per_expert = torch.zeros(self.n_experts, device=router_probs.device)
        ones = torch.ones_like(top_indices, dtype=torch.float, device=router_probs.device)
        tokens_per_expert.scatter_add_(0, top_indices.flatten(), ones.flatten())
        tokens_per_expert = tokens_per_expert / top_indices.numel()

        mean_router_prob = router_probs.mean(dim=0)
        return self.n_experts * torch.sum(tokens_per_expert * mean_router_prob)