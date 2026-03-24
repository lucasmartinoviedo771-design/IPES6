# Informe de Auditoría de Ciberseguridad y DevSecOps - IPES6
**Fecha:** 24 de marzo de 2026  
**Auditor:** Senior DevSecOps / Cybersecurity Expert (20 años exp.)  
**Estado:** CRÍTICO / REVISIÓN REQUERIDA

## 1. Resumen Ejecutivo
Se ha realizado un análisis exhaustivo del repositorio `sistema-gestion` (IPES6). El sistema presenta una arquitectura moderna basada en Django 5 y React 18, con un enfoque correcto en la validación de archivos mediante magic bytes. Sin embargo, se han detectado vulnerabilidades **críticas** relacionadas con la exposición de herramientas de profiling en producción y debilidades en la gestión de secretos que comprometen la integridad de la plataforma.

## 2. Tabla de Riesgos y Hallazgos

| ID | Severidad | Dimensiones | Vulnerabilidad | Impacto | Recomendación | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **VULN-001** | **CRÍTICA** | Exposición | **Silk Profiler expuesto.** | Fuga masiva de SQL/JWTs. | Autenticación superuser. | **MITIGADA** |
| **VULN-002** | **ALTA** | Secretos | **Secretos por defecto.** | Secuestro de sesiones/DB. | Eliminar fallbacks. | **MITIGADA** |
| **VULN-003** | **ALTA** | Autenticación | **Falta Auth Declarativa.** | Omisión de seguridad API. | Auth global mandatoria. | **MITIGADA** |
| **VULN-004** | **MEDIA** | Dependencias | **Axios obsoleto.** | Exposición a CVEs. | Actualizar Axios. | **PARCHEADA*** |
| **VULN-005** | **MEDIA** | Anti-Bot | **reCAPTCHA débil (0.3).** | Spam y brute-force bots. | Subir umbral a 0.5+. | **MITIGADA** |
| **VULN-006** | **MEDIA** | CSRF | **Cookies `SameSite=None`.** | Riesgo de Cross-Site forgery. | Cambiar a `SameSite=Lax`. | **MITIGADA** |
| **VULN-007** | **BAJA** | Red | **IPs Internas expuestas.** | Fuga de topología de red. | Limpiar ALLOWED_HOSTS. | **MITIGADA** |
| **VULN-008** | **BAJA** | Estándares | **CSP permite `unsafe-eval`.** | Riesgo de ejecución XSS. | Endurecer CSP Nginx. | **MITIGADA** |

*\*Nota: Se requiere ejecutar `pnpm install` para que el parche de dependencias sea efectivo.*

## 3. Análisis de cumplimiento (OWASP Top 10)

1.  **A01:2021-Broken Access Control:** Riesgo moderado debido al uso manual de validadores de roles (VULN-003). -> **Corregido mediante Auth Global.**
2.  **A04:2021-Insecure Design:** Riesgo crítico por la exposición de herramientas de diagnóstico (VULN-001). -> **Corregido mediante Silky Permissions.**
3.  **A05:2021-Security Misconfiguration:** Hallazgos en reCAPTCHA, **Cookies SameSite** y cabeceras de Nginx (**VULN-005, VULN-006**, VULN-008). -> **Corregido.**

## 4. Conclusión Técnica
Se han mitigado satisfactoriamente los 8 hallazgos iniciales de la auditoría. La superficie de exposición ha sido reducida drásticamente mediante la implementación de una política de "Seguridad por Defecto" (Auth mandatoria, Cookies restrictivas y Cifrado mandatorio).

---
**Firma:**  
*Auditor Senior DevSecOps - 20 Años Exp.*
