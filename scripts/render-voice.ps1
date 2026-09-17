# Renders every line in src/data/prompts.json to public/assets/voice/<id>.mp3 (A5).
# Uses the built-in Windows speech engine, so it runs offline with no accounts.
# Re-run after editing prompts.json:  npm run voice
# To use a better voice or your own recordings, replace the mp3 files; the names are the prompt ids.
param(
  [string]$Voice = 'Microsoft Zira Desktop',
  [int]$Rate = -1
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$prompts = Get-Content (Join-Path $root 'src/data/prompts.json') -Raw | ConvertFrom-Json
$outDir = Join-Path $root 'public/assets/voice'
New-Item -ItemType Directory -Force $outDir | Out-Null

$ffmpeg = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ffmpeg) { throw 'ffmpeg is needed to compress the voice files to mp3.' }

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice($Voice)
$synth.Rate = $Rate
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
  22050,
  [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
  [System.Speech.AudioFormat.AudioChannel]::Mono)

foreach ($prompt in $prompts.PSObject.Properties) {
  $wav = Join-Path $env:TEMP "pizza-party-$($prompt.Name).wav"
  $mp3 = Join-Path $outDir "$($prompt.Name).mp3"
  $synth.SetOutputToWaveFile($wav, $format)
  $synth.Speak([string]$prompt.Value)
  $synth.SetOutputToNull()
  # Trim leading silence, even out the level and compress.
  & $ffmpeg -y -loglevel error -i $wav -af 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-18:TP=-2' -ac 1 -b:a 64k $mp3
  Remove-Item $wav
  Write-Output "$($prompt.Name): $($prompt.Value)"
}
$synth.Dispose()
