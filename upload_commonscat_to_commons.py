import os
import sys
from pathlib import Path

PYWIKIBOT_PACKAGE_DIR = Path(r"C:\Users\Vera\Documents\Wikimedia\pywikibot")
PYWIKIBOT_CONFIG_DIR = Path(r"C:\Users\Vera\Documents\autoLastName\pywikibot_upload_config")
SOURCE = Path(r"C:\Users\Vera\Documents\autoLastName\commonsCat.js")
TARGET_TITLE = "User:1VeertjeBot/commonsCat.js"

os.environ["PYWIKIBOT_DIR"] = str(PYWIKIBOT_CONFIG_DIR)
sys.path.insert(0, str(PYWIKIBOT_PACKAGE_DIR))

import pywikibot


def main():
    site = pywikibot.Site("commons", "commons")
    site.login()

    text = SOURCE.read_text(encoding="utf-8")
    page = pywikibot.Page(site, TARGET_TITLE)

    if page.text == text:
        print(f"No changes needed: {TARGET_TITLE}")
        return

    page.text = text
    page.save(summary="Updating commonsCat bootstrap", minor=False)
    print(f"Updated: {TARGET_TITLE}")


if __name__ == "__main__":
    main()
