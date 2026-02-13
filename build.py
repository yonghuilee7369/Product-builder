"""
꿈해몽 정적 사이트 생성기 (Static Site Generator)
===================================================
사용법: python build.py
필수 패키지: pip install jinja2
"""

import json
import os
import shutil
from datetime import datetime

from jinja2 import Environment, FileSystemLoader

# ─── 설정 ───────────────────────────────────────────
SITE_URL = "https://yourdomain.com"
SITE_NAME = "오늘의 꿈풀이"
DATA_DIR = "data"
TEMPLATE_DIR = "templates"
OUTPUT_DIR = "output"


def load_dreams():
    """data/dreams.json을 로드하고 관련 꿈 데이터를 서로 연결한다."""
    with open(os.path.join(DATA_DIR, "dreams.json"), "r", encoding="utf-8") as f:
        dreams = json.load(f)

    # id → dream 빠른 조회용 딕셔너리
    dreams_by_id = {d["id"]: d for d in dreams}

    # related_dreams id 목록을 실제 dream 객체 목록으로 변환
    for dream in dreams:
        related_ids = dream.get("related_dreams", [])
        dream["related_dreams_data"] = [
            dreams_by_id[rid] for rid in related_ids if rid in dreams_by_id
        ]

    return dreams, dreams_by_id


def clean_output():
    """output 폴더를 초기화한다."""
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR)


def build_dream_pages(env, dreams):
    """각 꿈 해몽 상세 페이지를 output/{id}/index.html 로 생성한다."""
    template = env.get_template("dream_detail.html")

    for dream in dreams:
        # Clean URL: /snake_bite/ → output/snake_bite/index.html
        page_dir = os.path.join(OUTPUT_DIR, dream["id"])
        os.makedirs(page_dir, exist_ok=True)

        html = template.render(
            **dream,
            site_url=SITE_URL,
            site_name=SITE_NAME,
            tags_str=", ".join(dream.get("tags", [])),
        )

        out_path = os.path.join(page_dir, "index.html")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html)

        print(f"  ✓ {out_path}")


def build_index_page(env, dreams):
    """메인 페이지를 output/index.html 로 생성한다."""
    template = env.get_template("index.html")

    # 카테고리별 분류
    categories = {}
    for dream in dreams:
        cat = dream.get("category", "기타")
        categories.setdefault(cat, []).append(dream)

    html = template.render(
        dreams=dreams,
        categories=categories,
        total_count=len(dreams),
        site_url=SITE_URL,
        site_name=SITE_NAME,
    )

    out_path = os.path.join(OUTPUT_DIR, "index.html")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"  ✓ {out_path}")


def build_sitemap(dreams):
    """sitemap.xml을 output/sitemap.xml 로 생성한다."""
    today = datetime.now().strftime("%Y-%m-%d")

    urls = []

    # 메인 페이지
    urls.append(
        f"  <url>\n"
        f"    <loc>{SITE_URL}/</loc>\n"
        f"    <lastmod>{today}</lastmod>\n"
        f"    <changefreq>daily</changefreq>\n"
        f"    <priority>1.0</priority>\n"
        f"  </url>"
    )

    # 각 꿈 상세 페이지
    for dream in dreams:
        lastmod = dream.get("updated_date", today)
        urls.append(
            f"  <url>\n"
            f"    <loc>{SITE_URL}/{dream['id']}/</loc>\n"
            f"    <lastmod>{lastmod}</lastmod>\n"
            f"    <changefreq>weekly</changefreq>\n"
            f"    <priority>0.8</priority>\n"
            f"  </url>"
        )

    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )

    out_path = os.path.join(OUTPUT_DIR, "sitemap.xml")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(sitemap)

    print(f"  ✓ {out_path}")


def main():
    print(f"\n🌙 {SITE_NAME} - 정적 사이트 빌드 시작\n")

    # 1) 데이터 로드
    print("[1/4] 데이터 로드 중...")
    dreams, dreams_by_id = load_dreams()
    print(f"  → {len(dreams)}개의 꿈 데이터 로드 완료\n")

    # 2) output 폴더 초기화
    print("[2/4] output 폴더 초기화...")
    clean_output()
    print(f"  → {OUTPUT_DIR}/ 준비 완료\n")

    # 3) Jinja2 환경 설정
    env = Environment(
        loader=FileSystemLoader(TEMPLATE_DIR),
        autoescape=False,  # HTML content를 그대로 렌더링
    )

    # 4) 페이지 생성
    print("[3/4] HTML 페이지 생성 중...")
    build_index_page(env, dreams)
    build_dream_pages(env, dreams)
    print()

    # 5) sitemap.xml 생성
    print("[4/4] sitemap.xml 생성 중...")
    build_sitemap(dreams)
    print()

    # 결과 요약
    total_files = 1 + len(dreams) + 1  # index + dream pages + sitemap
    print("=" * 45)
    print(f"  빌드 완료! 총 {total_files}개 파일 생성")
    print(f"  output/index.html        (메인 페이지)")
    for d in dreams:
        print(f"  output/{d['id']}/index.html")
    print(f"  output/sitemap.xml       (사이트맵)")
    print("=" * 45)
    print()


if __name__ == "__main__":
    main()
