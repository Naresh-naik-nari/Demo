# PowerShell script to allow UDP port 14550 (MAVLink) through Windows Firewall
# Run as Administrator: Right-click → Run as Administrator

Write-Host "Adding Windows Firewall rule for MAVLink UDP port 14550..." -ForegroundColor Cyan

$ruleName = "MAVLink GCS UDP 14550"

# Check if rule already exists
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "✓ Firewall rule already exists" -ForegroundColor Green
    Write-Host "  Rule name: $ruleName" -ForegroundColor Gray
    Write-Host "  Status: $($existingRule.Enabled)" -ForegroundColor Gray
} else {
    # Create new firewall rule
    New-NetFirewallRule `
        -DisplayName $ruleName `
        -Direction Inbound `
        -Protocol UDP `
        -LocalPort 14550 `
        -Action Allow `
        -Profile Any `
        -Description "Allow incoming MAVLink telemetry on UDP port 14550 for Ground Control Station"
    
    Write-Host "✓ Firewall rule created successfully" -ForegroundColor Green
    Write-Host "  Port 14550 (UDP) is now open for incoming MAVLink traffic" -ForegroundColor Gray
}

Write-Host ""
Write-Host "You can now receive telemetry from the flight controller." -ForegroundColor Green
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
