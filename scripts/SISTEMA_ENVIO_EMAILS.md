# 📧 SISTEMA DE ENVÍO DE CREDENCIALES POR EMAIL - IPES6

## ✅ ESTADO ACTUAL: CASI COMPLETADO

### 🎯 **Funcionalidades Implementadas:**

#### 1. ✅ **Modelo UserProfile Extendido**
- Campo `must_change_password` - Fuerza cambio en primer login
- Campo `temp_password` - Almacena contraseña temporal para envío
- Campo `credentials_sent_at` - Rastrea cuándo se enviaron las credenciales
- Migraciones: `0059_userprofile.py`, `0060_userprofile_temp_password.py`

#### 2.  ✅ **Script de Carga de Docentes Actualizado** 
- Genera contraseñas aleatorias seguras (12 caracteres)
- Crea UserProfile automáticamente
- Activa `must_change_password=True`
- Guarda `temp_password` para envío posterior
- Asigna al grupo "docente"

#### 3. ✅ **Script de Envío de Emails (Base)**
- `scripts/enviar_credenciales.py`
- Sistema de lotes con rate limiting
- Configuración de límites y delays
- Modo dry-run para pruebas
- Separado para docentes y estudiantes

---

## ⚠️ **PENDIENTE: Configuración Email Backend**

### **Opciones para Configuración de Email:**

#### **Opción 1: Gmail (Recomendado para desarrollo/testing)**
```python
# En backend/.env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=tu_email@gmail.com
EMAIL_HOST_PASSWORD=tu_app_password  # Contraseña de aplicación de Google
DEFAULT_FROM_EMAIL=IPES6 <tu_email@gmail.com>
```

#### **Opción 2: SendGrid (Recomendado para producción)**
```python
# En backend/.env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=tu_api_key_de_sendgrid
DEFAULT_FROM_EMAIL=IPES6 <noreply@ipes6.edu.ar>
```

**SendGrid Free Tier**: 100 emails/día gratis

#### **Opción 3: Amazon SES (Escal able para producción)**
- 62,000 emails/mes gratis (si está en EC2)
- Muy confiable
- Requiere configuración AWS

#### **Opción 4: Servidor SMTP Institucional**
Si el instituto tiene servidor de correo propio.

---

## 📊 **Sistema de Rate Limiting Implementado**

### **Para evitar bloqueos por spam:**

| Cantidad | Provider | Config Recomendada |
|----------|----------|-------------------|
| 300 docentes | Gmail | 50/lote, 10s delay = ~50min total |
| | SendGrid Free | 90/día | 
| 1000+ estudiantes | Gmail | **NO** - Usar SendGrid/SES |
| | SendGrid | 100/día (free) = 10 días |
| | SES | Sin límite práct ico |

### **Uso del script:**

```bash
# Dry run (prueba sin enviar)
python scripts/enviar_credenciales.py --tipo docentes --dry-run

# Enviar a 50 docentes con 5 segundos entre cada email
python scripts/enviar_credenciales.py --tipo docentes --limite 50 --delay 5

# Para estudiantes (lotes más grandes, más delay)
python scripts/enviar_credenciales.py --tipo estudiantes --limite 90 --delay 10
```

---

## 🔐 **Seguridad Implementada:**

1. ✅ Contraseñas aleatorias de 12 caracteres
2. ✅ Incluyen mayúsculas, minúsculas, números y símbolos
3. ✅ Cambio obligatorio en primer login
4. ✅ temp_password se borra después del primer cambio
5. ✅ No se almacenan en logs ni consola (solo durante carga inicial)
6. ✅ Emails encriptados en tránsito (TLS)

---

## 📝 **Próximos Pasos:**

### **1. Configurar Email Backend** (5 minutos)
- Elegir provider (Gmail para testing, SendGrid/SES para producción)
- Agregar credenciales a `.env`
- Verificar configuración

### **2. Probar Envío** (10 minutos)
```bash
# Crear usuario de prueba
python scripts/carga_docentes.py scripts/test_docente.csv

# Dry run
python scripts/enviar_credenciales.py --tipo docentes --dry-run

# Enviar a 1 docente
python scripts/enviar_credenciales.py --tipo docentes --limite 1 --delay 0
```

### **3. Adaptar para Estudiantes** (30 minutos)
- Modificar script de carga de estudiantes (similar a docentes)
- Generar contraseñas aleatorias (en lugar de DNI+pass)
- Usar mismo sistema de UserProfile

### **4. Producción** (cuando lleguen los CSV)
```bash
# Cargar docentes
python scripts/carga_docentes.py docentes_reales.csv

# Enviar en lotes de 50
python scripts/enviar_credenciales.py --tipo docentes --limite 50 --delay 10

# Repetir hasta completar todos
```

---

## 📧 **Plantilla de Email (Actual):**

```
Asunto: Credenciales de acceso - Sistema IPES6

Hola [Nombre] [Apellido],

Te damos la bienvenida al Sistema de Gestión IPES6.

Tus credenciales de acceso son:

🔐 Usuario: [DNI]
🔑 Contraseña: [Contraseña Aleatoria]

🌐 Link de acceso: https://ipes6.lucasoviedodev.org/login

IMPORTANTE:
- Por seguridad, deberás cambiar tu contraseña en el primer inicio de sesión.
- Guarda estas credenciales en un lugar seguro.
- Si tienes problemas para acceder, contacta a soporte técnico.

Saludos cordiales,
Equipo IPES6
```

---

## 🎉 **Estado: LISTO PARA CONFIGURAR EMAIL**

Todo el sistema está implementado. Solo falta:
1. Configurar credenciales de email en `.env`
2. Probar con 1-2 docentes
3. Ejecutar envío masivo cuando tengas los CSV

**Tiempo estimado para estar 100% funcional: 15-30 minutos**

---

**Creado**: 2025-12-15
**Sistema**: IPES6 - Gestión Educativa
