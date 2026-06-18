import fitz # PyMuPDF

doc = fitz.open("../contexts/sample_report.pdf")
text = ""
for page in doc:
    text += page.get_text("text") + "\n"
    
print(text[:2000])
