import os
import tempfile
import uuid
from flask import Blueprint, request, jsonify, send_file
from backend.api.books import is_vip_request
from backend.services.translation import get_engine, parse_custom_dict_text
from backend.services import epub_service

epub_bp = Blueprint("epub", __name__, url_prefix="/api/epub")


@epub_bp.route("/translate", methods=["POST"])
def api_epub_translate():
    if not is_vip_request():
        return jsonify({"error": "Chức năng Dịch EPUB nâng cao chỉ dành cho thành viên VIP!"}), 403

    if "file" not in request.files:
        return jsonify({"error": "Không tìm thấy file EPUB tải lên!"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Tên file rỗng!"}), 400

    mode = request.form.get("mode", "fast")
    limit_chapters = int(request.form.get("limit_chapters", "-1"))
    clean_styles = request.form.get("clean_styles", "false").lower() == "true"
    strip_images = request.form.get("strip_images", "false").lower() == "true"
    strip_fonts = request.form.get("strip_fonts", "false").lower() == "true"
    custom_dict_text = request.form.get("custom_dict", "").strip()
    custom_dict = parse_custom_dict_text(custom_dict_text)

    temp_dir = tempfile.gettempdir()
    src_path = os.path.join(temp_dir, f"src_{uuid.uuid4().hex}.epub")
    dest_path = os.path.join(temp_dir, f"translated_{uuid.uuid4().hex}.epub")

    try:
        file.save(src_path)
        eng = get_engine()
        duration = epub_service.translate_epub_file(
            src_path, dest_path, eng, mode=mode,
            limit_chapters=limit_chapters, custom_dict=custom_dict,
            clean_styles=clean_styles, strip_images=strip_images, strip_fonts=strip_fonts
        )
        print(f"[VIP EPUB] Translated {file.filename} in {duration:.2f}s in mode {mode}")

        base, ext = os.path.splitext(file.filename)
        output_filename = f"{base}_Dich_{mode}{ext}"

        return send_file(
            dest_path,
            as_attachment=True,
            download_name=output_filename,
            mimetype="application/epub+zip"
        )
    except Exception as e:
        print(f"[VIP EPUB ERROR] Translate failed: {e}")
        return jsonify({"error": f"Lỗi trong quá trình dịch EPUB: {str(e)}"}), 500
    finally:
        if os.path.exists(src_path):
            try:
                os.remove(src_path)
            except Exception:
                pass


@epub_bp.route("/convert-txt", methods=["POST"])
def api_epub_convert_txt():
    if not is_vip_request():
        return jsonify({"error": "Chức năng chuyển đổi truyện sang EPUB chỉ dành cho thành viên VIP!"}), 403

    title = request.form.get("title", "Truyện convert").strip()
    author = request.form.get("author", "Vô danh").strip()
    description = request.form.get("description", "").strip()
    split_regex = request.form.get("split_regex", r"第\s*\d+\s*[章|回|节]").strip()
    translate_bool = request.form.get("translate", "false").lower() == "true"
    mode = request.form.get("mode", "fast")
    custom_dict_text = request.form.get("custom_dict", "").strip()

    txt_content = ""
    if "file" in request.files:
        file = request.files["file"]
        if file.filename != "":
            txt_content = file.read().decode("utf-8", errors="ignore")
    else:
        txt_content = request.form.get("text", "").strip()

    if not txt_content:
        return jsonify({"error": "Nội dung văn bản rỗng!"}), 400

    custom_dict = parse_custom_dict_text(custom_dict_text)
    temp_dir = tempfile.gettempdir()
    dest_path = os.path.join(temp_dir, f"converted_{uuid.uuid4().hex}.epub")

    try:
        eng = get_engine() if translate_bool else None
        epub_service.convert_txt_to_epub(
            txt_content, title, author, split_regex, dest_path,
            description=description, engine=eng,
            mode=mode if translate_bool else None, custom_dict=custom_dict
        )
        return send_file(
            dest_path,
            as_attachment=True,
            download_name=f"{title}.epub",
            mimetype="application/epub+zip"
        )
    except Exception as e:
        print(f"[VIP EPUB ERROR] Convert TXT failed: {e}")
        return jsonify({"error": f"Lỗi tạo EPUB: {str(e)}"}), 500


@epub_bp.route("/optimize", methods=["POST"])
def api_epub_optimize():
    if not is_vip_request():
        return jsonify({"error": "Chức năng Tối ưu hóa EPUB chỉ dành cho thành viên VIP!"}), 403

    if "file" not in request.files:
        return jsonify({"error": "Không tìm thấy file EPUB tải lên!"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Tên file rỗng!"}), 400

    strip_images = request.form.get("strip_images", "false").lower() == "true"
    strip_fonts = request.form.get("strip_fonts", "false").lower() == "true"

    temp_dir = tempfile.gettempdir()
    src_path = os.path.join(temp_dir, f"opt_src_{uuid.uuid4().hex}.epub")
    dest_path = os.path.join(temp_dir, f"opt_dest_{uuid.uuid4().hex}.epub")

    try:
        file.save(src_path)

        class MockEngine:
            def translate(self, text, **kwargs):
                return text

        epub_service.translate_epub_file(
            src_path, dest_path, MockEngine(), mode=None,
            limit_chapters=-1, custom_dict=None, clean_styles=True,
            strip_images=strip_images, strip_fonts=strip_fonts
        )

        base, ext = os.path.splitext(file.filename)
        return send_file(
            dest_path,
            as_attachment=True,
            download_name=f"{base}_Optimized{ext}",
            mimetype="application/epub+zip"
        )
    except Exception as e:
        return jsonify({"error": f"Lỗi tối ưu EPUB: {str(e)}"}), 500
    finally:
        if os.path.exists(src_path):
            try:
                os.remove(src_path)
            except Exception:
                pass
