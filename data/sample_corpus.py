import argparse
import random


def reservoir_sample(input_path: str, output_path: str, sample_size: int, seed: int) -> None:
    random.seed(seed)
    reservoir = []

    with open(input_path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            if i < sample_size:
                reservoir.append(line)
            else:
                j = random.randint(0, i)
                if j < sample_size:
                    reservoir[j] = line

            if i % 5_000_000 == 0 and i > 0:
                print(f"Scanned {i:,} lines")

    with open(output_path, "w", encoding="utf-8") as f:
        f.writelines(reservoir)

    print(f"Sampled {len(reservoir):,} lines to {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Randomly sample lines from a large corpus (reservoir sampling).")
    parser.add_argument("--input", type=str, required=True)
    parser.add_argument("--output", type=str, required=True)
    parser.add_argument("--lines", type=int, default=3_500_000)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    reservoir_sample(args.input, args.output, args.lines, args.seed)