import os
import zipfile

def create_archive():
    exclude_dirs = {'node_modules', 'dist', '.git', 'temp_media'}
    exclude_files = {'.DS_Store', 'create_zip.py'}
    zip_path = '/tmp/nazzil-bot-source.zip'

    if os.path.exists(zip_path):
        try:
            os.remove(zip_path)
        except Exception:
            pass

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
            for file in files:
                if file in exclude_files or file.endswith('.zip') or file.endswith('.pyc'):
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, '.')
                zipf.write(file_path, arcname)

    print(f"OK:{zip_path}")

if __name__ == '__main__':
    create_archive()
