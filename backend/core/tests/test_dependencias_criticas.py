"""
Ejercita las bibliotecas de terceros que se suben de version mayor por CVEs
(Pillow, weasyprint, pypdf, cryptography). Un salto mayor puede cambiar la API
o el comportamiento, y estos usos —procesar imagenes que sube el publico y
generar PDFs oficiales— no los cubre ningun otro test.

No comprueban seguridad en abstracto: reproducen exactamente lo que hace el
codigo de la app (apps/preinscriptions/upload_utils.py y los write_pdf de
weasyprint), para que si una version nueva rompe la generacion de PDF o el
rechazo de un upload malicioso, falle aca y no en produccion.
"""

import io

import pytest


def _png_bytes(size=(64, 64), color=(120, 60, 30)):
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    buf.seek(0)
    buf.name = "prueba.png"
    return buf


# ── Pillow: procesamiento de imagenes subidas ────────────────────────────────


def test_pillow_valida_imagen_real():
    """is_allowed() acepta un PNG legitimo (magic bytes + decodificacion)."""
    from apps.preinscriptions.upload_utils import is_allowed

    img = _png_bytes()
    data = img.getvalue()
    ok, err = is_allowed(img, size=len(data))
    assert ok, f"deberia aceptar un PNG valido, error: {err}"


def test_pillow_rechaza_no_imagen_con_extension_falsa():
    """
    Un ejecutable renombrado a .png no debe pasar: la validacion mira los magic
    bytes, no la extension. Es la defensa contra polyglots.
    """
    from apps.preinscriptions.upload_utils import is_allowed

    fake = io.BytesIO(b"MZ\x90\x00\x03" + b"\x00" * 200)  # cabecera de .exe
    fake.name = "foto.png"
    ok, _ = is_allowed(fake, size=len(fake.getvalue()))
    assert not ok, "un ejecutable renombrado a .png no debe aceptarse"


def test_pillow_sanitize_reserializa_y_descarta_metadata():
    """
    sanitize_image() decodifica y re-guarda como JPEG. Es la funcion que corre
    sobre cada foto que se almacena; si un Pillow nuevo cambia la API, se rompe
    la subida de fotos.
    """
    from PIL import Image

    from apps.preinscriptions.upload_utils import sanitize_image

    out = sanitize_image(_png_bytes())
    out.seek(0)
    with Image.open(out) as img:
        assert img.format == "JPEG"
        assert img.mode == "RGB"  # sin canal alpha ni EXIF


# ── weasyprint: generacion de PDF ─────────────────────────────────────────────


def test_weasyprint_genera_pdf():
    """
    Reproduce el write_pdf() que usan analiticos, certificados y preinscripciones.
    Un PDF valido empieza con %PDF y termina con %%EOF.
    """
    from weasyprint import HTML

    html = "<html><body><h1>Analitico de prueba</h1><p>Contenido</p></body></html>"
    pdf = HTML(string=html).write_pdf()
    assert pdf[:5] == b"%PDF-", "la salida no es un PDF valido"
    assert b"%%EOF" in pdf[-1024:], "el PDF no cierra correctamente"
    assert len(pdf) > 500


# ── pypdf: lectura/validacion de PDFs subidos ─────────────────────────────────


def test_pypdf_lee_pdf_generado():
    """pypdf debe poder abrir un PDF real. Es lo que hace _validate_pdf sobre los
    PDFs que se suben."""
    import pypdf
    from weasyprint import HTML

    pdf = HTML(string="<p>una pagina</p>").write_pdf()
    reader = pypdf.PdfReader(io.BytesIO(pdf), strict=False)
    assert len(reader.pages) >= 1


# ── cryptography: la usa PyJWT para firmar, entre otros ───────────────────────


def test_cryptography_disponible():
    """Sanity check de que la version nueva importa y opera."""
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    sig = key.sign(
        b"dato",
        __import__("cryptography.hazmat.primitives.asymmetric.padding", fromlist=["PKCS1v15"]).PKCS1v15(),
        hashes.SHA256(),
    )
    assert len(sig) == 256
