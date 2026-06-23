import os
import sys
from pathlib import Path

PYWIKIBOT_PACKAGE_DIR = Path(r"C:\Users\Vera\Documents\Wikimedia\pywikibot")
PYWIKIBOT_CONFIG_DIR = Path(r"C:\Users\Vera\Documents\autoLastName\pywikibot_upload_config")
UPLOADS = [
    (
        Path(r"C:\Users\Vera\Documents\autoLastName\commonsCat\mappings.json"),
        "User:1VeertjeBot/commonsCat/mappings.json",
        "Updating commonsCat mappings",
    ),
    (
        Path(r"C:\Users\Vera\Documents\autoLastName\commonsCat\styles.css"),
        "User:1VeertjeBot/commonsCat/styles.css",
        "Updating commonsCat styles",
    ),
    (
        Path(r"C:\Users\Vera\Documents\autoLastName\commonsCat\app.js"),
        "User:1VeertjeBot/commonsCat/app.js",
        "Updating commonsCat application",
    ),
    (
        Path(r"C:\Users\Vera\Documents\autoLastName\commonsCat.js"),
        "User:1VeertjeBot/commonsCat.js",
        "Updating commonsCat bootstrap",
    ),
]

os.environ["PYWIKIBOT_DIR"] = str(PYWIKIBOT_CONFIG_DIR)
sys.path.insert(0, str(PYWIKIBOT_PACKAGE_DIR))

import pywikibot


def main():
    site = pywikibot.Site("wikidata", "wikidata")
    site.username()
    site.login()

    for source, target_title, summary in UPLOADS:
        text = source.read_text(encoding="utf-8")
        page = pywikibot.Page(site, target_title)

        if page.text.rstrip("\r\n") == text.rstrip("\r\n"):
            print(f"No changes needed: {target_title}")
            continue

        page.text = text
        page.save(summary=summary, minor=False)
        print(f"Updated: {target_title}")


if __name__ == "__main__":
    main()
