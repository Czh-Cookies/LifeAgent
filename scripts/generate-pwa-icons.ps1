param()

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$publicDirectory = Join-Path $projectRoot 'public'

function New-RoundedRectanglePath {
  param(
    [System.Drawing.RectangleF]$Rectangle,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-LifeAgentIcon {
  param(
    [int]$Size,
    [string]$FileName,
    [switch]$Maskable
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $green = [System.Drawing.ColorTranslator]::FromHtml('#173f35')
    $gold = [System.Drawing.ColorTranslator]::FromHtml('#f6c86e')
    $paper = [System.Drawing.ColorTranslator]::FromHtml('#f4f1e8')

    if ($Maskable) {
      $graphics.Clear($green)
      $left = $Size * 0.32
      $top = $Size * 0.28
      $right = $Size * 0.70
      $bottom = $Size * 0.72
    } else {
      $margin = $Size * 0.02
      $rectangle = [System.Drawing.RectangleF]::new($margin, $margin, $Size - (2 * $margin), $Size - (2 * $margin))
      $backgroundPath = New-RoundedRectanglePath -Rectangle $rectangle -Radius ($Size * 0.22)
      try {
        $brush = [System.Drawing.SolidBrush]::new($green)
        try { $graphics.FillPath($brush, $backgroundPath) } finally { $brush.Dispose() }
      } finally { $backgroundPath.Dispose() }
      $left = $Size * 0.29
      $top = $Size * 0.25
      $right = $Size * 0.73
      $bottom = $Size * 0.75
    }

    $pen = [System.Drawing.Pen]::new($gold, $Size * 0.105)
    try {
      $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
      $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
      $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
      $graphics.DrawLine($pen, $left, $top, $left, $bottom)
      $graphics.DrawLine($pen, $left, $bottom, $right, $bottom)
    } finally { $pen.Dispose() }

    $circleSize = $Size * 0.18
    $circleBrush = [System.Drawing.SolidBrush]::new($paper)
    try { $graphics.FillEllipse($circleBrush, $Size * 0.65 - ($circleSize / 2), $Size * 0.37 - ($circleSize / 2), $circleSize, $circleSize) } finally { $circleBrush.Dispose() }

    $outputPath = Join-Path $publicDirectory $FileName
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

New-LifeAgentIcon -Size 192 -FileName 'lifeagent-192.png'
New-LifeAgentIcon -Size 512 -FileName 'lifeagent-512.png'
New-LifeAgentIcon -Size 512 -FileName 'lifeagent-maskable-512.png' -Maskable
New-LifeAgentIcon -Size 180 -FileName 'apple-touch-icon.png'
