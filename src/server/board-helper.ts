import "server-only";

/*
 * The desktop snipping helper (Windows PowerShell 5.1, nothing installed). The tutor runs one command
 * from the classroom's Snip panel; the script then watches the clipboard and posts every new image
 * (Win+Shift+S puts snips there) to that lesson's whiteboard with the short-lived room code. It can do
 * nothing else: the code only lets it post images to one board, and only until the lesson closes.
 * Kept free of backticks and dollar-brace so it can live in this template string.
 */
const TEMPLATE = String.raw`# TutorLink board snip helper: images you copy go straight to your lesson's whiteboard.
$ErrorActionPreference = 'Stop'
$Code = '__CODE__'
$Api = '__API__'
$Lesson = '__LESSON__'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Get-ClipPng {
  if (-not [System.Windows.Forms.Clipboard]::ContainsImage()) { return $null }
  $img = [System.Windows.Forms.Clipboard]::GetImage()
  if ($null -eq $img) { return $null }
  $scale = [Math]::Min(1.0, 1600 / [Math]::Max($img.Width, $img.Height))
  if ($scale -lt 1.0) {
    $w = [int]($img.Width * $scale); $h = [int]($img.Height * $scale)
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $w, $h)
    $g.Dispose(); $img.Dispose(); $img = $bmp
  }
  $ms = New-Object System.IO.MemoryStream
  $img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $img.Dispose()
  return ,$ms.ToArray()
}

function Get-Hash([byte[]]$bytes) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  return [System.BitConverter]::ToString($sha.ComputeHash($bytes))
}

Write-Host ''
Write-Host 'TutorLink snip helper' -ForegroundColor Cyan
Write-Host ('Lesson: ' + $Lesson)
Write-Host 'Snip with Win+Shift+S (or copy any image): it appears on the whiteboard.'
Write-Host 'Press P to pause or resume, Q to stop. Closing this window also stops it.'
Write-Host ''

$last = ''
try { $first = Get-ClipPng; if ($first) { $last = Get-Hash $first } } catch {}
$paused = $false
$sent = 0
while ($true) {
  try {
    while ([Console]::KeyAvailable) {
      $k = [Console]::ReadKey($true).Key
      if ($k -eq 'Q') { Write-Host 'Stopped.'; return }
      if ($k -eq 'P') {
        $paused = -not $paused
        if ($paused) { Write-Host 'Paused: copied images are not sent.' -ForegroundColor Yellow } else { Write-Host 'Listening again.' -ForegroundColor Green }
      }
    }
  } catch {}
  try {
    $png = Get-ClipPng
    if ($png) {
      $h = Get-Hash $png
      if ($h -ne $last) {
        $last = $h
        if (-not $paused) {
          $body = @{ code = $Code; image = 'data:image/png;base64,' + [Convert]::ToBase64String($png) } | ConvertTo-Json -Compress
          try {
            Invoke-RestMethod -Uri $Api -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 90 | Out-Null
            $sent++
            Write-Host ('Sent to the whiteboard (' + $sent + ')') -ForegroundColor Green
          } catch {
            $msg = $_.ErrorDetails.Message
            if ($msg) { try { $msg = ($msg | ConvertFrom-Json).error } catch {} }
            if (-not $msg) { $msg = $_.Exception.Message }
            Write-Host ('Not sent: ' + $msg) -ForegroundColor Red
            if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 403) {
              Write-Host 'This code has expired. Open the Snip panel in the classroom for a new command.'
              return
            }
          }
        }
      }
    }
  } catch {
    # The clipboard is busy while another app writes to it: try again on the next tick.
  }
  Start-Sleep -Milliseconds 700
}
`;

/** The script with this lesson's code and the site's address filled in. */
export function helperScript(code: string, apiUrl: string, lessonTitle: string): string {
  const quote = (s: string) => s.replace(/'/g, "''").replace(/[\r\n]/g, " ");
  return TEMPLATE.replaceAll("__CODE__", quote(code)).replaceAll("__API__", quote(apiUrl)).replaceAll("__LESSON__", quote(lessonTitle));
}
