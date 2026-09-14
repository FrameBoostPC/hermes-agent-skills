param(
    [string]$Config,
    [ValidateRange(1, 65535)][int]$Port = 8765
)

$ErrorActionPreference = 'Stop'
$repository = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$localDirectory = Join-Path $repository 'local'
$pythonExecutable = Join-Path $repository '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonExecutable)) {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCommand) { throw 'Install Python and the repository requirements-dev.txt dependencies first.' }
    $pythonExecutable = $pythonCommand.Source
}

if (-not $Config) {
    if ($env:HERMES_MODEL_CONFIG) { $Config = $env:HERMES_MODEL_CONFIG }
    else {
        $Config = Join-Path $localDirectory 'content-model.json'
        if (-not (Test-Path -LiteralPath $Config)) { $Config = Join-Path $PSScriptRoot 'model.example.json' }
    }
}
$Config = (Resolve-Path -LiteralPath $Config).Path
# Reuse the server's defaults and environment precedence. Only the endpoint and
# provider are returned; credentials stay inside the Python process environment.
$effectiveConfiguration = & $pythonExecutable -c 'import sys,json; sys.path.insert(0,sys.argv[1]); from server import load_config; c=load_config(sys.argv[2]); print(json.dumps({"provider":c.provider,"base_url":c.base_url}))' $PSScriptRoot $Config
if ($LASTEXITCODE -ne 0) { throw 'Model configuration is invalid. Check the server configuration fields.' }
$modelConfiguration = $effectiveConfiguration | ConvertFrom-Json

# Start a local runtime only for the default local Ollama endpoint. Other model
# services are managed by their owner and remain independent of this launcher.
if ($modelConfiguration.provider -eq 'ollama' -and $modelConfiguration.base_url.TrimEnd('/') -eq 'http://127.0.0.1:11434') {
    $runtimeAvailable = $false
    try {
        $null = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 3
        $runtimeAvailable = $true
    } catch { }
    if (-not $runtimeAvailable) {
        $ollamaExecutable = Join-Path $localDirectory 'ollama-runtime/bin/ollama.exe'
        $portable = Test-Path -LiteralPath $ollamaExecutable
        if (-not $portable) {
            $ollamaCommand = Get-Command ollama -ErrorAction SilentlyContinue
            if (-not $ollamaCommand) { throw 'Install Ollama and pull the configured model, or configure another model service.' }
            $ollamaExecutable = $ollamaCommand.Source
        }
        New-Item -ItemType Directory -Path $localDirectory -Force | Out-Null
        $runtimeLog = Join-Path $localDirectory 'ollama-runtime'
        New-Item -ItemType Directory -Path $runtimeLog -Force | Out-Null
        $previousEnvironment = @{}
        $runtimeEnvironment = @{ OLLAMA_HOST = '127.0.0.1:11434'; OLLAMA_NUM_PARALLEL = '1'; OLLAMA_MAX_LOADED_MODELS = '1' }
        if ($portable) { $runtimeEnvironment.OLLAMA_MODELS = Join-Path $localDirectory 'ollama-models' }
        try {
            foreach ($entry in $runtimeEnvironment.GetEnumerator()) {
                $previousEnvironment[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, 'Process')
                [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
            }
            $runtimeProcess = Start-Process -FilePath $ollamaExecutable -ArgumentList 'serve' -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeLog 'stdout.log') -RedirectStandardError (Join-Path $runtimeLog 'stderr.log') -PassThru
            $runtimeProcess.Id | Set-Content -LiteralPath (Join-Path $runtimeLog 'process-id.txt')
        } finally {
            foreach ($entry in $previousEnvironment.GetEnumerator()) {
                [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
            }
        }
        Write-Host 'Local Ollama started. The first model request may take a moment to initialise.'
    }
}

# The server runs in this terminal. Ctrl+C stops the preview; Ollama may remain
# available for subsequent runs and unloads idle model memory automatically.
& $pythonExecutable (Join-Path $PSScriptRoot 'server.py') --config $Config --port $Port
exit $LASTEXITCODE
