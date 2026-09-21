import argparse

import torch

from model.config import ModelConfig
from model.transformer import FlareSLM
from tokenizers import Tokenizer


@torch.no_grad()
def generate(
    model: FlareSLM,
    tokenizer: Tokenizer,
    prompt: str,
    max_new_tokens: int,
    temperature: float,
    top_k: int,
    device: str,
    deep_think: bool = False,
) -> str:
    model.eval()
    ids = tokenizer.encode(prompt).ids
    input_ids = torch.tensor([ids], dtype=torch.long, device=device)

    eos_id = tokenizer.token_to_id("<eos>")
    think_id = tokenizer.token_to_id("<think>")

    for step in range(max_new_tokens):
        context = input_ids[:, -model.config.max_seq_len :]
        logits, _, _ = model(context)
        next_logits = logits[:, -1, :] / temperature

        if not deep_think and step == 0:
            next_logits[:, think_id] = float("-inf")

        top_values, top_indices = torch.topk(next_logits, top_k)
        probs = torch.softmax(top_values, dim=-1)
        sampled = torch.multinomial(probs, num_samples=1)
        next_token = top_indices.gather(-1, sampled)

        input_ids = torch.cat([input_ids, next_token], dim=1)

        if next_token.item() == eos_id:
            break

    output_ids = input_ids[0].tolist()
    return tokenizer.decode(output_ids)
    

def load_model(checkpoint_path: str, device: str) -> FlareSLM:
    config = ModelConfig()
    model = FlareSLM(config).to(device)
    checkpoint = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(checkpoint["model"])
    return model


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate text from a trained Flare SLM checkpoint.")
    parser.add_argument("--checkpoint", type=str, required=True)
    parser.add_argument("--tokenizer", type=str, required=True, help="Path to tokenizer.json")
    parser.add_argument("--prompt", type=str, required=True)
    parser.add_argument("--max-new-tokens", type=int, default=200)
    parser.add_argument("--temperature", type=float, default=0.8)
    parser.add_argument("--top-k", type=int, default=40)
    parser.add_argument("--deep-think", action="store_true", help="Allow the model to enter a <think> reasoning span")
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    tokenizer = Tokenizer.from_file(args.tokenizer)
    model = load_model(args.checkpoint, device)

    output = generate(
        model, tokenizer, args.prompt, args.max_new_tokens,
        args.temperature, args.top_k, device, deep_think=args.deep_think,
    )
    print(output)