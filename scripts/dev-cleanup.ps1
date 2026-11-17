param(
    [int[]]$Ports = @(8012, 5174)
)

$ErrorActionPreference = "Stop"

function Get-WorkspaceRoot {
    return (Split-Path -Parent $PSScriptRoot)
}

function Get-ListeningProcessIds {
    param(
        [int[]]$PortsToScan
    )

    $ids = New-Object 'System.Collections.Generic.HashSet[int]'
    foreach ($port in $PortsToScan) {
        $connections = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
        foreach ($connection in $connections) {
            $processId = 0
            if ($null -ne $connection -and $null -ne $connection.OwningProcess) {
                $processId = [int]$connection.OwningProcess
            }
            if ($processId -gt 0 -and $processId -ne $PID) {
                [void]$ids.Add($processId)
            }
        }
    }
    return $ids
}

function Get-MatchingProcessIds {
    param(
        [string]$WorkspaceRoot
    )

    $ids = New-Object 'System.Collections.Generic.HashSet[int]'
    $processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
    foreach ($process in $processes) {
        $processId = 0
        if ($null -ne $process -and $null -ne $process.ProcessId) {
            $processId = [int]$process.ProcessId
        }
        if ($processId -le 0 -or $processId -eq $PID) {
            continue
        }

        $commandLine = ""
        if ($null -ne $process -and $null -ne $process.CommandLine) {
            $commandLine = [string]$process.CommandLine
        }
        if ([string]::IsNullOrWhiteSpace($commandLine)) {
            continue
        }

        $frontendWorkspacePattern = [Regex]::Escape($WorkspaceRoot) + '.*apps[\\/]+frontend'
        $frontendCommandPattern = 'vite|npm(\.cmd)?\s+run\s+dev|npm-cli\.js\s+run\s+dev'
        $isBackendRunner = $commandLine -match 'apps\.backend\.app\.dev\.server_runner'
        $isFrontendRunner = ($commandLine -match $frontendWorkspacePattern) -and ($commandLine -match $frontendCommandPattern)

        if ($isBackendRunner -or $isFrontendRunner) {
            [void]$ids.Add($processId)
        }
    }
    return $ids
}

function Get-ProcessRecord {
    param(
        [int]$ProcessId
    )

    return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
}

function Stop-DevProcesses {
    param(
        [int[]]$TargetPorts
    )

    $workspaceRoot = Get-WorkspaceRoot
    $allIds = New-Object 'System.Collections.Generic.HashSet[int]'

    foreach ($processId in (Get-ListeningProcessIds -PortsToScan $TargetPorts)) {
        [void]$allIds.Add([int]$processId)
    }
    foreach ($processId in (Get-MatchingProcessIds -WorkspaceRoot $workspaceRoot)) {
        [void]$allIds.Add([int]$processId)
    }

    $records = @()
    foreach ($processId in $allIds) {
        $record = Get-ProcessRecord -ProcessId ([int]$processId)
        if ($null -ne $record) {
            $records += $record
        }
    }

    if ($records.Count -eq 0) {
        Write-Host "No dev zombie processes found." -ForegroundColor DarkGray
        return
    }

    foreach ($record in ($records | Sort-Object ProcessId -Unique)) {
        $commandLine = ""
        if ($null -ne $record -and $null -ne $record.CommandLine) {
            $commandLine = [string]$record.CommandLine
        }
        $preview = if ($commandLine.Length -gt 180) {
            $commandLine.Substring(0, 177) + "..."
        } else {
            $commandLine
        }

        Write-Host ("Stopping PID {0} [{1}]" -f $record.ProcessId, $record.Name) -ForegroundColor Yellow
        if (-not [string]::IsNullOrWhiteSpace($preview)) {
            Write-Host ("  {0}" -f $preview) -ForegroundColor DarkGray
        }

        try {
            Stop-Process -Id ([int]$record.ProcessId) -Force -ErrorAction Stop
        }
        catch {
            Write-Warning ("Could not stop PID {0}: {1}" -f $record.ProcessId, $_.Exception.Message)
        }
    }

    Start-Sleep -Milliseconds 500
    Write-Host ("Stopped {0} dev process(es)." -f $records.Count) -ForegroundColor Green
}

Stop-DevProcesses -TargetPorts $Ports
