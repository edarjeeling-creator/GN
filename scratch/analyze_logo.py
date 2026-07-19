from PIL import Image

def analyze():
    img = Image.open('public/logo.png')
    print("Mode:", img.mode)
    print("Size:", img.size)
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        # Get the alpha channel
        alpha = img.split()[-1]
        bbox = alpha.getbbox()
        if bbox:
            print("Non-transparent bounding box:", bbox)
            width = bbox[2] - bbox[0]
            height = bbox[3] - bbox[1]
            print(f"Content width: {width}, Content height: {height}")
        else:
            print("No non-transparent content found.")
    else:
        print("No alpha channel found.")

if __name__ == '__main__':
    analyze()
