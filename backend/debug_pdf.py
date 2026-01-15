
import sys
import os
import django
from pypdf import PdfReader

def analyze_pdf(path):
    print(f"Analyzing: {path}")
    try:
        reader = PdfReader(path)
        print(f"Number of pages: {len(reader.pages)}")
        
        page = reader.pages[0]
        text = page.extract_text()
        
        print("\n--- Extracted Text (First Page) ---")
        print(text[:1000]) # First 1000 chars
        print("--- End Extracted Text ---")
        
        if not text.strip():
            print("WARNING: No text extracted. It might be an image-based PDF.")
    except Exception as e:
        print(f"Error reading PDF: {e}")

if __name__ == "__main__":
    # Test with one file
    test_file = '/app/Primariatemporal/2025/1º/1º Cuatrimestre/Alfabetización Académica (Comisión Matemática) - Copia de tall_lab_sem Cuatri.pdf'
    # Fallback to local path if not in docker
    if not os.path.exists(test_file):
        test_file = '/home/ipesrg/Primariatemporal/2025/1º/1º Cuatrimestre/Alfabetización Académica (Comisión Matemática) - Copia de tall_lab_sem Cuatri.pdf'

    analyze_pdf(test_file)
