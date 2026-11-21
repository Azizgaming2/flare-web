$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Run PowerShell as Administrator and start this script again."
    exit 1
}

$exe = "C:\Program Files\Tesseract-OCR\tesseract.exe"
if (-not (Test-Path $exe)) {
    winget install --id UB-Mannheim.TesseractOCR -e --accept-package-agreements --accept-source-agreements
}
if (-not (Test-Path $exe)) {
    Write-Host "Tesseract was not found at $exe after installation."
    exit 1
}

$tessdata = "C:\Program Files\Tesseract-OCR\tessdata"
foreach ($lang in @("aze", "rus", "eng")) {
    $target = Join-Path $tessdata "$lang.traineddata"
    if (-not (Test-Path $target)) {
        Invoke-WebRequest -Uri "https://github.com/tesseract-ocr/tessdata_fast/raw/main/$lang.traineddata" -OutFile $target
    }
}

& $exe --list-langs
Write-Host "Done. Restart the backend."
