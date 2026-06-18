import fitz # PyMuPDF
import sys
import json

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided"}))
        return

    file_path = sys.argv[1]
    try:
        doc = fitz.open(file_path)
        pages = []
        for i, page in enumerate(doc):
            text = page.get_text("text")
            pages.append({
                "page": i + 1,
                "text": text
            })
        print(json.dumps({"success": True, "pages": pages}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
