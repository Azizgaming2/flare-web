import torch
import torch.nn as nn

from model.config import ModelConfig


class ThinkGate(nn.Module):
    """
    Decides, per sequence position, whether the model should enter an
    explicit reasoning ("think") span before producing its final answer
    tokens. Used during generation to control think/answer switching,
    and during training to weight the loss on think-span tokens.
    """

    def __init__(self, config: ModelConfig):
        super().__init__()
        self.think_token_id = config.think_token_id
        self.think_end_token_id = config.think_end_token_id
        self.think_max_tokens = config.think_max_tokens

        self.gate_proj = nn.Linear(config.dim, 1, bias=False)

    def forward(self, hidden_states: torch.Tensor) -> torch.Tensor:
        return torch.sigmoid(self.gate_proj(hidden_states)).squeeze(-1)

    def build_think_mask(self, input_ids: torch.Tensor) -> torch.Tensor:
        """
        Builds a boolean mask marking positions that fall inside a
        <think> ... </think> span, for loss-weighting during training.
        Vectorized: no Python-level loop over batch/seq_len.
        """
        is_start = input_ids == self.think_token_id
        is_end = input_ids == self.think_end_token_id
        state = is_start.int() - is_end.int()
        mask = torch.cumsum(state, dim=1) > 0
        return mask


def compute_think_weighted_loss(
    logits: torch.Tensor,
    targets: torch.Tensor,
    think_mask: torch.Tensor,
    think_weight: float = 0.5,
) -> torch.Tensor:
    """
    Standard cross-entropy loss with a reduced weight applied to tokens
    inside think spans, so the model is not over-penalized for exploring
    reasoning paths that don't match the reference text exactly.
    """
    per_token_loss = torch.nn.functional.cross_entropy(
        logits.view(-1, logits.size(-1)),
        targets.view(-1),
        reduction="none",
    ).view(targets.shape)

    weights = torch.where(think_mask, think_weight, 1.0)
    return (per_token_loss * weights).sum() / weights.sum()