"""
Cliente para proveedores de IA con API compatible con OpenAI.

Groq, DeepSeek, Qwen, Cerebras, Mistral y OpenRouter hablan todos el mismo
dialecto, asi que un solo cliente sirve para todos y se elige por configuracion.
El objetivo es no quedar atados a un proveedor: si a uno se le agota la cuota,
sube el precio o baja la calidad, se cambia una variable de entorno.

Las herramientas se declaran una sola vez en el formato de Gemini
(TOOL_DECLARATIONS) y aca se traducen, para no mantener dos listas en paralelo.
"""

import json
import logging

import requests
from django.conf import settings

from apps.asistente_ia.services.gemini_service import (
    SYSTEM_INSTRUCTION,
    TOOL_DECLARATIONS,
    _anonimizar_para_ia,
    _ejecutar_herramienta_local,
)

logger = logging.getLogger(__name__)

TIMEOUT_SEGUNDOS = 12
MAX_TURNOS_HISTORIAL = 6


def _tools_formato_openai() -> list[dict]:
    """Traduce las declaraciones de herramientas del formato Gemini al de OpenAI."""
    tools = []
    for decl in TOOL_DECLARATIONS:
        params = decl.get("parameters", {}) or {}
        propiedades = params.get("properties", {}) or {}
        tools.append(
            {
                "type": "function",
                "function": {
                    "name": decl["name"],
                    "description": decl.get("description", ""),
                    "parameters": {
                        # OpenAI espera los tipos en minuscula; Gemini los declara en mayuscula.
                        "type": "object",
                        "properties": {
                            nombre: {
                                "type": str(campo.get("type", "string")).lower(),
                                "description": campo.get("description", ""),
                            }
                            for nombre, campo in propiedades.items()
                        },
                        "required": params.get("required", []),
                    },
                },
            }
        )
    return tools


def _config() -> tuple[str, str, str]:
    """Devuelve (base_url, modelo, api_key) del proveedor configurado."""
    base_url = (getattr(settings, "IA_BASE_URL", "") or "").rstrip("/")
    modelo = getattr(settings, "IA_MODEL", "") or ""
    api_key = getattr(settings, "IA_API_KEY", "") or ""
    return base_url, modelo, api_key


def _pedir(base_url: str, api_key: str, payload: dict) -> dict:
    resp = requests.post(
        f"{base_url}/chat/completions",
        json=payload,
        # La clave va en el header, no en la URL: asi no queda escrita en los
        # logs de proxies ni en el historial de peticiones.
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        timeout=TIMEOUT_SEGUNDOS,
    )
    if resp.status_code == 429:
        # Se distingue del resto para poder avisar que se agoto la cuota en vez
        # de responder con el motor local como si nada hubiera pasado.
        raise CuotaAgotadaError("El proveedor de IA rechazo la consulta por limite de uso.")
    if resp.status_code != 200:
        logger.error("Error del proveedor de IA (%s): %s", resp.status_code, resp.text[:400])
        raise RuntimeError(f"Error en proveedor de IA ({resp.status_code})")
    return resp.json()


class CuotaAgotadaError(RuntimeError):
    """El proveedor devolvio 429: se agoto la cuota o se supero el ritmo permitido."""


def procesar_con_openai_compat(mensaje: str, historial: list, user) -> tuple[str, list[str]]:
    """Resuelve la consulta contra un proveedor compatible con OpenAI."""
    base_url, modelo, api_key = _config()
    herramientas_usadas: list[str] = []

    mensajes = [{"role": "system", "content": SYSTEM_INSTRUCTION}]
    for h in historial[-MAX_TURNOS_HISTORIAL:]:
        mensajes.append({"role": "user" if h.role == "user" else "assistant", "content": h.content})
    mensajes.append({"role": "user", "content": mensaje})

    payload = {
        "model": modelo,
        "messages": mensajes,
        "tools": _tools_formato_openai(),
        "temperature": 0.2,
        "max_tokens": 800,
    }

    data = _pedir(base_url, api_key, payload)
    choices = data.get("choices") or []
    if not choices:
        return "No pude generar una respuesta en este momento. Por favor intentá nuevamente.", []

    respuesta = choices[0].get("message", {}) or {}
    tool_calls = respuesta.get("tool_calls") or []

    if not tool_calls:
        return (respuesta.get("content") or "").strip(), herramientas_usadas

    # El modelo pidio herramientas: se ejecutan todas las solicitadas y se le
    # devuelven juntas. Gemini, en cambio, solo atiende la primera.
    mensajes.append(respuesta)
    for llamada in tool_calls:
        funcion = llamada.get("function", {}) or {}
        nombre = funcion.get("name", "")
        try:
            args = json.loads(funcion.get("arguments") or "{}")
        except json.JSONDecodeError:
            args = {}
        herramientas_usadas.append(nombre)

        resultado = _ejecutar_herramienta_local(nombre, args, user)
        mensajes.append(
            {
                "role": "tool",
                "tool_call_id": llamada.get("id", ""),
                "name": nombre,
                # Sin datos identificatorios: no salen del instituto.
                "content": json.dumps(_anonimizar_para_ia(resultado), ensure_ascii=False),
            }
        )

    data2 = _pedir(
        base_url,
        api_key,
        {"model": modelo, "messages": mensajes, "temperature": 0.2, "max_tokens": 800},
    )
    choices2 = data2.get("choices") or []
    texto = (choices2[0].get("message", {}).get("content") or "").strip() if choices2 else ""
    if texto:
        return texto, herramientas_usadas

    # Si la segunda vuelta no trajo texto, al menos se devuelve el dato crudo.
    return json.dumps(_anonimizar_para_ia(resultado), ensure_ascii=False, indent=2), herramientas_usadas
