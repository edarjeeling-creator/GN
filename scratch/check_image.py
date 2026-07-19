from PIL import Image

try:
    img = Image.open('public/logo.png')
    print(f"Dimensions: {img.size}")
    print(f"Format: {img.format}")
    print(f"Mode: {img.mode}")
except Exception as e:
    print("Error:", e)
