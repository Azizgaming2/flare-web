$ErrorActionPreference = "Stop"

Write-Host "Pulling Qwen2.5 3B..."
ollama pull qwen2.5:3b

Write-Host "Creating Flare Tentium from ModelFile..."
ollama create flare-tentium -f .\backend\ModelFile

Write-Host "Installed models:"
ollama list

Write-Host "Starting Flare Tentium test chat..."
ollama run flare-tentium
