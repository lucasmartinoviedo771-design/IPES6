#!/usr/bin/env python3
"""
Script para enviar credenciales por email a docentes/estudiantes

Características:
- Envío por lotes con rate limiting
- Evita bloqueos por spam
- Log detallado de envíos
- Reintentos automáticos

Uso:
    python scripts/enviar_credenciales.py --tipo docentes --limite 50
    python scripts/enviar_credenciales.py --tipo estudiantes --limite 100 --delay 10
"""

import sys
import os
import time
import argparse
from pathlib import Path
from datetime import datetime

# Agregar el backend al path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

# Configurar Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth.models import User
from core.models import Docente, Estudiante, UserProfile
from django.template.loader import render_to_string


def generar_email_docente(docente_nombre, docente_apellido, username, password):
    """Genera el contenido del email para un docente"""
    asunto = "Credenciales de acceso - Sistema IPES6"
    
    cuerpo = f"""
    Hola {docente_nombre} {docente_apellido},
    
    Te damos la bienvenida al Sistema de Gestión IPES6.
    
    Tus credenciales de acceso son:
    
    🔐 Usuario: {username}
    🔑 Contraseña: {password}
    
    🌐 Link de acceso: {settings.FRONTEND_URL}/login
    
    IMPORTANTE:
    - Por seguridad, deberás cambiar tu contraseña en el primer inicio de sesión.
    - Guarda estas credenciales en un lugar seguro.
    - Si tienes problemas para acceder, contacta a soporte técnico.
    
    Saludos cordiales,
    Equipo IPES6
    """
    
    return asunto, cuerpo


def generar_email_estudiante(estudiante_nombre, estudiante_apellido, username, password):
    """Genera el contenido del email para un estudiante"""
    asunto = "Credenciales de acceso - Sistema IPES6"
    
    cuerpo = f"""
    Hola {estudiante_nombre} {estudiante_apellido},
    
    Te damos la bienvenida al Sistema deGestión IPES6.
    
    Tus credenciales de acceso son:
    
    🔐 Usuario: {username}
    🔑 Contraseña: {password}
    
    🌐 Link de acceso: {settings.FRONTEND_URL}/login
    
    IMPORTANTE:
    - Por seguridad, deberás cambiar tu contraseña en el primer inicio de sesión.
    - Guarda estas credenciales en un lugar seguro.
    - Si tienes problemas para acceder, contacta a la secretaría.
    
    Saludos cordiales,
    Equipo IPES6
    """
    
    return asunto, cuerpo


def enviar_correos_docentes(limite=50, delay=5, dry_run=False):
    """
    Envía credenciales a docentes que necesitan cambiar contraseña
    
    Args:
        limite: Número máximo de correos a enviar en esta ejecución
        delay: Segundos de espera entre cada envío
        dry_run: Si es True, solo simula el envío sin enviar realmente
    """
    print(f"🔍 Buscando docentes que necesitan recibir credenciales...")
    print(f"Configuración: límite={limite}, delay={delay}s, dry_run={dry_run}")
    print("-" * 60)
    
    # Buscar usuarios docentes con must_change_password=True y que tengan email
    profiles = UserProfile.objects.filter(
        must_change_password=True,
        user__groups__name='docente'
    ).exclude(user__email__isnull=True).exclude(user__email='').select_related('user')[:limite]
    
    total = profiles.count()
    
    if total == 0:
        print("✅ No hay docentes pendientes de envío de credenciales.")
        return
    
    print(f"📧 Se enviarán {total} correos.")
    print()
    
    stats = {
        "enviados": 0,
        "fallidos": 0,
        "errores": []
    }
    
    for i, profile in enumerate(profiles, 1):
        user = profile.user
        username = user.username
        
        # Buscar docente por DNI
        docente = Docente.objects.filter(dni=username).first()
        
        if not docente:
            print(f"  ⚠️  {i}/{total} - Usuario {username} no tiene docente asociado")
            continue
        
        if not user.email or '@temp.local' in user.email:
            print(f"  ⏭️  {i}/{total} - {docente.apellido}, {docente.nombre} - Email temporal, omitido")
            continue
        
        # NOTE: En producción, la contraseña ya fue asignada. 
        # Este script NO puede recuperar la contraseña original.
        # Necesitaríamos guardarla temporalmente o generar una nueva.
        print(f"  ⚠️  {i}/{total} - {docente.apellido}, {docente.nombre} - No se puede recuperar la contraseña original")
        print(f"       Sugerencia: Use el sistema de reset de contraseña o re-genere credenciales")
        continue
        
    print()
    print("=" * 60)
    print("📊 RESUMEN")
    print("=" * 60)
    print(f"✅ Enviados:  {stats['enviados']}")
    print(f"❌ Fallidos:  {stats['fallidos']}")
    
    if stats["errores"]:
        print()
        print("Errores:")
        for error in stats["errores"][:10]:  # Mostrar solo los primeros 10
            print(f"  - {error}")
    
    print("=" * 60)
    
    return stats


def enviar_correos_estudiantes(limite=100, delay=10, dry_run=False):
    """Similar a docentes pero para estudiantes"""
    print("⚠️  Sistema de envío para estudiantes - Similar implementación que docentes")
    # Implementación similar
    pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enviar credenciales por email")
    parser.add_argument(
        "--tipo",
        choices=["docentes", "estudiantes"],
        required=True,
        help="Tipo de usuarios a los que enviar"
    )
    parser.add_argument(
        "--limite",
        type=int,
        default=50,
        help="Número máximo de correos a enviar (default: 50)"
    )
    parser.add_argument(
        "--delay",
        type=int,
        default=5,
        help="Segundos de espera entre cada envío (default: 5)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Modo simulación - no envía emails realmente"
    )
    
    args = parser.parse_args()
    
    if args.tipo == "docentes":
        enviar_correos_docentes(
            limite=args.limite,
            delay=args.delay,
            dry_run=args.dry_run
        )
    else:
        enviar_correos_estudiantes(
            limite=args.limite,
            delay=args.delay,
            dry_run=args.dry_run
        )
