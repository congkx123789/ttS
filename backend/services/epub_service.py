import os
import re
import zipfile
import uuid
import html
import tempfile
import time

class EpubWriter:
    def __init__(self, title, author="Unknown", cover_img_bytes=None, cover_ext="jpg", description=""):
        self.title = title
        self.author = author
        self.description = description
        self.chapters = []  # List of tuples (title, content)
        self.cover_img_bytes = cover_img_bytes
        self.cover_ext = cover_ext

    def add_chapter(self, title, content_html):
        self.chapters.append((title, content_html))

    def write_to(self, dest_path):
        with zipfile.ZipFile(dest_path, 'w', compression=zipfile.ZIP_DEFLATED) as epub:
            # 1. mimetype (must be uncompressed and first entry)
            epub.writestr('mimetype', 'application/epub+zip', compress_type=zipfile.ZIP_STORED)

            # 2. META-INF/container.xml
            container_xml = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>"""
            epub.writestr('META-INF/container.xml', container_xml)

            # Generate NCX
            ncx_entries = []
            for i, (ch_title, _) in enumerate(self.chapters):
                ncx_entries.append(f"""    <navPoint id="navPoint-{i+1}" playOrder="{i+1}">
      <navLabel><text>{html.escape(ch_title)}</text></navLabel>
      <content src="text/chapter_{i+1}.xhtml"/>
    </navPoint>""")

            ncx_joined = "\n".join(ncx_entries)
            toc_ncx = f"""<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.safaribooksonline.com/ascent/1.0/ncx/" version="2005-1" xml:lang="vi">
  <head>
    <meta name="dtb:uid" content="urn:uuid:{uuid.uuid4()}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>{html.escape(self.title)}</text></docTitle>
  <docAuthor><text>{html.escape(self.author)}</text></docAuthor>
  <navMap>
    <navPoint id="navPoint-0" playOrder="0">
      <navLabel><text>Trang Tên Sách</text></navLabel>
      <content src="text/titlepage.xhtml"/>
    </navPoint>
{ncx_joined}
  </navMap>
</ncx>"""
            epub.writestr('OEBPS/toc.ncx', toc_ncx)

            # Generate manifest items
            manifest_items = [
                '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
                '<item id="titlepage" href="text/titlepage.xhtml" media-type="application/xhtml+xml"/>',
            ]
            spine_items = [
                '<itemref idref="titlepage"/>',
            ]

            if self.cover_img_bytes:
                manifest_items.append(f'<item id="cover-image" href="images/cover.{self.cover_ext}" media-type="image/{self.cover_ext if self.cover_ext != "jpg" else "jpeg"}"/>')
                manifest_items.append('<item id="coverpage" href="text/coverpage.xhtml" media-type="application/xhtml+xml"/>')
                spine_items.insert(0, '<itemref idref="coverpage"/>')

            for i in range(len(self.chapters)):
                manifest_items.append(f'<item id="chapter_{i+1}" href="text/chapter_{i+1}.xhtml" media-type="application/xhtml+xml"/>')
                spine_items.append(f'<itemref idref="chapter_{i+1}"/>')

            # Generate content.opf
            manifest_joined = "\n    ".join(manifest_items)
            spine_joined = "\n    ".join(spine_items)
            desc_meta = f'<meta name="description" content="{html.escape(self.description)}"/>' if self.description else ''
            cover_meta = '<meta name="cover" content="cover-image"/>' if self.cover_img_bytes else ''
            
            content_opf = f"""<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>{html.escape(self.title)}</dc:title>
    <dc:creator opf:role="aut">{html.escape(self.author)}</dc:creator>
    <dc:language>vi</dc:language>
    <dc:identifier id="bookid">urn:uuid:{uuid.uuid4()}</dc:identifier>
    {desc_meta}
    {cover_meta}
  </metadata>
  <manifest>
    {manifest_joined}
  </manifest>
  <spine toc="ncx">
    {spine_joined}
  </spine>
</package>"""
            epub.writestr('OEBPS/content.opf', content_opf)

            # Write cover files
            if self.cover_img_bytes:
                epub.writestr(f'OEBPS/images/cover.{self.cover_ext}', self.cover_img_bytes)
                coverpage_xhtml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="vi">
<head>
  <title>Bìa Sách</title>
  <style type="text/css">
    body {{ margin: 0; padding: 0; text-align: center; background-color: #ffffff; }}
    img {{ max-width: 100%; height: auto; max-height: 98vh; }}
  </style>
</head>
<body>
  <div>
    <img src="../images/cover.{self.cover_ext}" alt="Bìa sách"/>
  </div>
</body>
</html>"""
                epub.writestr('OEBPS/text/coverpage.xhtml', coverpage_xhtml)

            # Title page
            titlepage_xhtml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="vi">
<head>
  <title>{html.escape(self.title)}</title>
  <style type="text/css">
    body {{ font-family: sans-serif; text-align: center; padding: 10% 5%; }}
    h1 {{ font-size: 2.2em; margin-bottom: 0.5em; color: #1a237e; }}
    h2 {{ font-size: 1.4em; color: #555; margin-bottom: 2em; }}
    .desc {{ font-size: 1em; text-align: justify; margin: 2em auto; max-width: 85%; color: #333; line-height: 1.6; border: 1px solid #e0e0e0; padding: 15px; border-radius: 8px; background: #fafafa; }}
  </style>
</head>
<body>
  <h1>{html.escape(self.title)}</h1>
  <h2>Tác giả: {html.escape(self.author)}</h2>
  <hr style="width: 50%;"/>
  {f'<div class="desc"><strong>Giới thiệu:</strong><br/>{html.escape(self.description)}</div>' if self.description else ''}
  <p style="margin-top: 3em; font-style: italic; font-size: 0.9em; color: #777;">Được biên dịch & đóng gói tự động bằng VIP EPUB Tools</p>
</body>
</html>"""
            epub.writestr('OEBPS/text/titlepage.xhtml', titlepage_xhtml)

            # Write chapters XHTML
            for i, (ch_title, ch_content) in enumerate(self.chapters):
                if "</html>" in ch_content.lower() or "</p>" in ch_content.lower():
                    ch_xhtml = ch_content
                else:
                    paragraphs = ch_content.split('\n')
                    body_html = ""
                    for p in paragraphs:
                        p_clean = p.strip()
                        if p_clean:
                            body_html += f"<p>{html.escape(p_clean)}</p>\n"
                    
                    ch_xhtml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="vi">
<head>
  <title>{html.escape(ch_title)}</title>
  <style type="text/css">
    body {{ font-family: sans-serif; padding: 5%; line-height: 1.6; color: #222; }}
    h3 {{ font-size: 1.3em; text-align: center; margin-bottom: 1.5em; border-bottom: 1px solid #ddd; padding-bottom: 0.5em; color: #1a237e; }}
    p {{ text-indent: 2em; margin: 0.6em 0; text-align: justify; }}
  </style>
</head>
<body>
  <h3>{html.escape(ch_title)}</h3>
  {body_html}
</body>
</html>"""
                epub.writestr(f'OEBPS/text/chapter_{i+1}.xhtml', ch_xhtml)

def apply_custom_dictionary(text, custom_dict):
    """Replaces Chinese words with user-provided custom dictionary mappings."""
    if not custom_dict or not text:
        return text
    for zh, vi in custom_dict:
        if zh and zh in text:
            text = text.replace(zh, vi)
    return text

def clean_html_styles(html_content):
    """Strips inline CSS styles, custom font faces, and stylesheets."""
    cleaned = re.sub(r'\s+style="[^"]*"', '', html_content)
    cleaned = re.sub(r"\s+style='[^']*'", '', cleaned)
    cleaned = re.sub(r'\s+class="[^"]*"', '', cleaned)
    cleaned = re.sub(r"\s+class='[^']*'", '', cleaned)
    cleaned = re.sub(r'<style[^>]*>.*?</style>', '', cleaned, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r'<link[^>]*rel="stylesheet"[^>]*>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'<link[^>]*rel=\'stylesheet\'[^>]*>', '', cleaned, flags=re.IGNORECASE)
    return cleaned

def clean_punctuation_spacing(text):
    if not text:
        return text
    text = re.sub(r'["“”‘’\'『』「」【】()\[\]{}<>]', '', text)
    text = re.sub(r'([,;.:!?])(?=[^\s])', r'\1 ', text)
    text = re.sub(r'\s+([,;.:!?])', r'\1', text)
    text = re.sub(r'\s*-\s*', ' - ', text)
    return re.sub(r'\s+', ' ', text).strip()

def translate_html_content_advanced(html_content, engine, mode=None, custom_dict=None, clean_styles=False):
    """Parses HTML, extracts text segments, translates them, and preserves HTML tags."""
    if clean_styles:
        html_content = clean_html_styles(html_content)

    parts = re.split(r'(<[^>]+>)', html_content)
    translated_parts = []
    
    for part in parts:
        if not part:
            continue
        if part.startswith('<') and part.endswith('>'):
            translated_parts.append(part)
        else:
            stripped = part.strip()
            if stripped:
                txt = apply_custom_dictionary(part, custom_dict)
                translated_text = engine.translate(txt, multi_option=False, mode=mode)
                translated_text = clean_punctuation_spacing(translated_text)
                translated_parts.append(translated_text)
            else:
                translated_parts.append(part)
                
    return "".join(translated_parts)

def translate_epub_file(src_epub, dest_epub, engine, mode=None, limit_chapters=-1, custom_dict=None, clean_styles=False, strip_images=False, strip_fonts=False):
    """Translates an EPUB file and saves to dest_epub."""
    start_time = time.time()
    
    with zipfile.ZipFile(src_epub, 'r') as src_zip:
        with zipfile.ZipFile(dest_epub, 'w', compression=zipfile.ZIP_DEFLATED) as dest_zip:
            file_list = src_zip.namelist()
            
            if 'mimetype' in file_list:
                mimetype_data = src_zip.read('mimetype')
                dest_zip.writestr('mimetype', mimetype_data, compress_type=zipfile.ZIP_STORED)
                
            html_files = [f for f in file_list if f.endswith(('.html', '.xhtml', '.htm'))]
            
            def natural_sort_key(s):
                return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]
            html_files.sort(key=natural_sort_key)
            
            target_html_files = set(html_files)
            skipped_html_files = set()
            if limit_chapters > 0 and len(html_files) > limit_chapters:
                target_html_files = set(html_files[:limit_chapters])
                skipped_html_files = set(html_files[limit_chapters:])
                
            for file_name in file_list:
                if file_name == 'mimetype':
                    continue
                    
                if strip_images and file_name.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg')):
                    continue
                    
                if strip_fonts and file_name.lower().endswith(('.ttf', '.otf', '.woff', '.woff2')):
                    continue
                    
                raw_data = src_zip.read(file_name)
                
                if file_name in target_html_files:
                    try:
                        content = raw_data.decode('utf-8', errors='ignore')
                        translated_content = translate_html_content_advanced(
                            content, engine, mode=mode, custom_dict=custom_dict, clean_styles=clean_styles
                        )
                        dest_zip.writestr(file_name, translated_content.encode('utf-8'))
                    except Exception as e:
                        print(f"[EpubTool ERROR] Error translating {file_name}: {e}")
                        dest_zip.writestr(file_name, raw_data)
                elif file_name in skipped_html_files:
                    placeholder = '<html><head><meta charset="utf-8"/></head><body><h3>[Chương này được bỏ qua trong bản dịch giới hạn]</h3></body></html>'
                    dest_zip.writestr(file_name, placeholder.encode('utf-8'))
                elif file_name.endswith(('.ncx', '.opf', '.xml')):
                    try:
                        content = raw_data.decode('utf-8', errors='ignore')
                        translated_content = translate_html_content_advanced(
                            content, engine, mode=mode, custom_dict=custom_dict, clean_styles=False
                        )
                        dest_zip.writestr(file_name, translated_content.encode('utf-8'))
                    except Exception:
                        dest_zip.writestr(file_name, raw_data)
                else:
                    dest_zip.writestr(file_name, raw_data)
                    
    return time.time() - start_time

def convert_txt_to_epub(txt_content, title, author, split_regex, dest_path, description="", engine=None, mode=None, custom_dict=None):
    """Converts raw text file content to EPUB, optionally translating it first."""
    lines = txt_content.split('\n')
    chapters = []
    current_chapter_title = "Giới thiệu / Khởi đầu"
    current_chapter_lines = []
    
    regex = re.compile(split_regex) if split_regex else None
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
            
        if regex and regex.search(stripped) and len(stripped) < 100:
            if current_chapter_lines:
                chapters.append((current_chapter_title, "\n".join(current_chapter_lines)))
            current_chapter_title = stripped
            current_chapter_lines = []
        else:
            current_chapter_lines.append(line)
            
    if current_chapter_lines or not chapters:
        chapters.append((current_chapter_title, "\n".join(current_chapter_lines)))
        
    writer = EpubWriter(title=title, author=author, description=description)
    
    for ch_title, ch_text in chapters:
        if engine and mode:
            ch_title_vi = apply_custom_dictionary(ch_title, custom_dict)
            ch_title_vi = engine.translate(ch_title_vi, multi_option=False, mode=mode)
            
            paragraphs = ch_text.split('\n')
            paragraphs_vi = []
            for p in paragraphs:
                p_clean = p.strip()
                if p_clean:
                    p_vi = apply_custom_dictionary(p_clean, custom_dict)
                    p_vi = engine.translate(p_vi, multi_option=False, mode=mode)
                    paragraphs_vi.append(p_vi)
            ch_content_html = "\n".join(paragraphs_vi)
            writer.add_chapter(ch_title_vi, ch_content_html)
        else:
            writer.add_chapter(ch_title, ch_text)
            
    writer.write_to(dest_path)
