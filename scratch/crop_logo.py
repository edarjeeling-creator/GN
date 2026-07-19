from PIL import Image, ImageOps

def crop_and_square_logo():
    # Load the logo
    img = Image.open('public/logo.png')
    
    # Get alpha channel bounding box
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
        
    alpha = img.split()[-1]
    bbox = alpha.getbbox()
    
    if not bbox:
        print("Error: No content found in image.")
        return
        
    # Crop to content
    cropped = img.crop(bbox)
    
    # Calculate target square size (using the larger dimension of the content)
    w, h = cropped.size
    square_size = max(w, h)
    
    # Create new square transparent background image
    square_img = Image.new('RGBA', (square_size, square_size), (0, 0, 0, 0))
    
    # Paste cropped content centered
    offset_x = (square_size - w) // 2
    offset_y = (square_size - h) // 2
    square_img.paste(cropped, (offset_x, offset_y), cropped)
    
    # Resize to a standard high-quality square dimension (e.g., 512x512)
    final_img = square_img.resize((512, 512), Image.Resampling.LANCZOS)
    
    # Save back to public/logo.png
    final_img.save('public/logo.png', format='PNG')
    print("Successfully cropped and squared logo to 512x512 PNG at public/logo.png")

if __name__ == '__main__':
    crop_and_square_logo()
