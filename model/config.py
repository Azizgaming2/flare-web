from dataclasses import dataclass


@dataclass
class ModelConfig:
    vocab_size: int = 32000
    dim: int = 896
    n_layers: int = 14
    n_heads: int = 14
    n_kv_heads: int = 2
    max_seq_len: int = 2048

    n_experts: int = 6
    n_experts_per_token: int = 2
    expert_hidden_dim: int = 1792

    think_max_tokens: int = 256
    think_token_id: int = 4
    think_end_token_id: int = 5

    rope_theta: float = 10000.0
    rms_norm_eps: float = 1e-5
    dropout: float = 0.0

    @property
    def head_dim(self) -> int:
        return self.dim // self.n_heads

    @property
    def total_params_estimate(self) -> int:
        embed = self.vocab_size * self.dim
        attn_per_layer = self.dim * self.dim * 2 + self.dim * (self.dim // self.n_heads * self.n_kv_heads) * 2
        moe_per_layer = self.n_experts * (self.dim * self.expert_hidden_dim * 2)
        per_layer = attn_per_layer + moe_per_layer
        return embed + per_layer * self.n_layers


@dataclass
class TrainConfig:
    batch_size: int = 2
    grad_accum_steps: int = 32
    learning_rate: float = 1e-4
    min_learning_rate: float = 1e-5
    warmup_steps: int = 1000
    max_steps: int = 12000
    weight_decay: float = 0.1
    grad_clip: float = 0.5
    checkpoint_interval: int = 250
    eval_interval: int = 250
    mixed_precision: str = "bf16"
    gradient_checkpointing: bool = True