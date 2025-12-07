# Script de preparacion para despliegue en Ubuntu
# Ejecutar desde: c:\proyectos\IPES6
# Uso: .\scripts\prepare-deploy.ps1

param(
    [Parameter()]
    [string]$ServerIP = "",
    [Parameter()]
    [string]$ServerUser = ""
)

$ErrorActionPreference = "Stop"

# Colores
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host "⚠ $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "✗ $args" -ForegroundColor Red }

Write-Info "=== Preparacion para Despliegue IPES6 en Ubuntu ==="
Write-Info ""

# Verificar que estamos en el directorio correcto
if (-not (Test-Path ".\backend\docker-compose.yml")) {
    Write-Err "Este script debe ejecutarse desde el directorio raiz del proyecto IPES6"
    exit 1
}

Write-Info "1. Verificando archivos necesarios..."

# Verificar archivos Docker
$requiredFiles = @(
    "backend\Dockerfile",
    "backend\docker-compose.yml",
    "frontend\Dockerfile",
    "frontend\nginx.conf"
)

$allFilesExist = $true
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Success "  ✓ $file"
    } else {
        Write-Err "  ✗ $file NO ENCONTRADO"
        $allFilesExist = $false
    }
}

if (-not $allFilesExist) {
    Write-Err "Faltan archivos necesarios. Abortando."
    exit 1
}

# Verificar .env
Write-Info "`n2. Verificando configuracion de entorno..."

if (Test-Path "backend\.env") {
    Write-Warning "Ya existe backend\.env"
    $overwrite = Read-Host "¿Quieres crear uno nuevo desde el ejemplo? (s/N)"
    if ($overwrite -eq "s" -or $overwrite -eq "S") {
        if (Test-Path "backend\.env.docker.example") {
            Copy-Item "backend\.env.docker.example" "backend\.env" -Force
            Write-Success "  ✓ Creado backend\.env desde ejemplo"
        }
    }
} else {
    if (Test-Path "backend\.env.docker.example") {
        Copy-Item "backend\.env.docker.example" "backend\.env"
        Write-Success "  ✓ Creado backend\.env desde ejemplo"
    } else {
        Write-Warning "  No se encontro .env.docker.example"
    }
}

# Crear archivo de configuracion de produccion
Write-Info "`n3. Creando archivo de configuracion para produccion..."

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$prodConfig = @"
# Configuracion para produccion en Ubuntu Server
# Generado el: $timestamp

DJANGO_ENV=production
DEBUG=False

# IMPORTANTE: Cambia estos valores
SECRET_KEY=CAMBIAR_ESTO_POR_UNA_CLAVE_SECURA_GENERADA_ALEATORIAMENTE
DB_ROOT_PASSWORD=CAMBIAR_ESTO_TU_CONTRASENA_ROOT_MYSQL
DB_PASSWORD=CAMBIAR_ESTO_TU_CONTRASENA_USUARIO_MYSQL
DB_NAME=ipes6
DB_USER=ipes_user
DB_HOST=db
DB_PORT=3306

# Configuracion de red (REEMPLAZA CON TU IP O DOMINIO)
# Si tu servidor tiene IP 192.168.1.100:
# ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.100
# FRONTEND_ORIGINS=http://192.168.1.100
# CSRF_TRUSTED_ORIGINS=http://192.168.1.100
# FRONTEND_URL=http://192.168.1.100

ALLOWED_HOSTS=localhost,127.0.0.1,TU_IP_O_DOMINIO_AQUI
FRONTEND_ORIGINS=http://TU_IP_O_DOMINIO_AQUI
CSRF_TRUSTED_ORIGINS=http://TU_IP_O_DOMINIO_AQUI
FRONTEND_URL=http://TU_IP_O_DOMINIO_AQUI

# Configuracion de correo (opcional)
# EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
# EMAIL_HOST=smtp.gmail.com
# EMAIL_PORT=587
# EMAIL_USE_TLS=True
# EMAIL_HOST_USER=tu_email@gmail.com
# EMAIL_HOST_PASSWORD=tu_contrasena_de_app
"@

$prodConfig | Out-File -FilePath "backend\.env.production" -Encoding UTF8
Write-Success "  ✓ Creado backend\.env.production"
Write-Warning "  EDITA este archivo con la configuracion real de tu servidor"

# Crear archivo .dockerignore si no existe
Write-Info "`n4. Verificando archivos .dockerignore..."

if (-not (Test-Path "backend\.dockerignore")) {
    $dockerignoreBackend = @"
__pycache__
*.pyc
*.pyo
*.pyd
.Python
env/
.venv/
venv/
ENV/
.pytest_cache/
.coverage
*.log
.env.local
.DS_Store
*.sqlite3
*.db
media/
staticfiles/
node_modules/
"@
    $dockerignoreBackend | Out-File -FilePath "backend\.dockerignore" -Encoding UTF8
    Write-Success "  ✓ Creado backend\.dockerignore"
}

if (-not (Test-Path "frontend\.dockerignore")) {
    $dockerignoreFrontend = @"
node_modules/
.pnpm-store/
dist/
.vite/
.env.local
.env.*.local
*.log
.DS_Store
coverage/
.turbo/
"@
    $dockerignoreFrontend | Out-File -FilePath "frontend\.dockerignore" -Encoding UTF8
    Write-Success "  ✓ Creado frontend\.dockerignore"
}

# Preparar archivo comprimido para transferencia
Write-Info "`n5. ¿Quieres crear un archivo comprimido para transferir? (s/N)"
$compress = Read-Host

if ($compress -eq "s" -or $compress -eq "S") {
    Write-Info "Creando archivo comprimido..."
    
    $excludes = @(
        "node_modules",
        ".venv",
        "__pycache__",
        "dist",
        ".git",
        "*.pyc",
        ".pytest_cache",
        "staticfiles",
        "media"
    )
    
    $timestampFile = Get-Date -Format "yyyyMMdd_HHmmss"
    $outputFile = "..\IPES6_deploy_$timestampFile.zip"
    
    # Usar 7-Zip si esta disponible, sino usar Compress-Archive
    if (Get-Command 7z -ErrorAction SilentlyContinue) {
        $excludeArgs = $excludes | ForEach-Object { "-xr!$_" }
        & 7z a $outputFile . $excludeArgs
    } else {
        Write-Warning "7-Zip no encontrado, usando Compress-Archive (mas lento)..."
        # Compress-Archive no tiene buenas opciones para excluir, usar Get-ChildItem
        Get-ChildItem -Recurse -File | 
            Where-Object { 
                $path = $_.FullName
                -not ($excludes | Where-Object { $path -like "*$_*" })
            } |
            Compress-Archive -DestinationPath $outputFile -Force
    }
    
    if (Test-Path $outputFile) {
        Write-Success "  ✓ Archivo creado: $outputFile"
        $sizeInMB = [math]::Round((Get-Item $outputFile).Length / 1MB, 2)
        Write-Info "  Tamaño: $sizeInMB MB"
    }
}

# Mostrar instrucciones
Write-Info "`n=== SIGUIENTES PASOS ==="
Write-Info ""
Write-Info "1. EDITAR CONFIGURACION:"
Write-Info "   - Abre: backend\.env.production"
Write-Info "   - Cambia SECRET_KEY, contrasenas, IP/dominio del servidor"
Write-Info ""
Write-Info "2. TRANSFERIR AL SERVIDOR:"
Write-Info "   Opcion A - Con Git (RECOMENDADO):"
Write-Info "     git add ."
Write-Info "     git commit -m 'Preparado para despliegue'"
Write-Info "     git push"
Write-Info "     # Luego en el servidor: git clone o git pull"
Write-Info ""
Write-Info "   Opcion B - Con SCP:"

if ($ServerIP -and $ServerUser) {
    Write-Info "     scp ..\IPES6_deploy_*.zip ${ServerUser}@${ServerIP}:~/"
} else {
    Write-Info "     scp ..\IPES6_deploy_*.zip usuario@IP_SERVIDOR:~/"
}

Write-Info ""
Write-Info "3. EN EL SERVIDOR UBUNTU:"
Write-Info "   # Descomprimir (si usaste zip)"
Write-Info "   unzip IPES6_deploy_*.zip -d IPES6"
Write-Info "   cd IPES6"
Write-Info ""
Write-Info "   # Copiar configuracion de produccion"
Write-Info "   cp backend/.env.production backend/.env"
Write-Info "   nano backend/.env  # Verificar y editar"
Write-Info ""
Write-Info "   # Dar permisos de ejecucion al script"
Write-Info "   chmod +x scripts/deploy.sh"
Write-Info ""
Write-Info "   # Ejecutar configuracion inicial"
Write-Info "   ./scripts/deploy.sh setup"
Write-Info ""
Write-Info "4. DOCUMENTACION COMPLETA:"
Write-Info "   Consulta: .agent\workflows\deploy-ubuntu.md"
Write-Info ""
Write-Success "=== Preparacion completada ==="
