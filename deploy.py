"""
꿈해몽 사이트 자동 배포 스크립트
================================
사용법: python deploy.py
동작: build.py 실행 → git add → git commit → git push
"""

import subprocess
import sys
from datetime import datetime


def run(cmd, description):
    """쉘 명령어를 실행하고 결과를 출력한다."""
    print(f"  ▶ {description}")
    print(f"    $ {cmd}")

    result = subprocess.run(
        cmd,
        shell=True,
        capture_output=True,
        text=True,
    )

    if result.stdout.strip():
        for line in result.stdout.strip().split("\n"):
            print(f"    {line}")

    if result.returncode != 0:
        print(f"\n  ✗ 실패! (exit code: {result.returncode})")
        if result.stderr.strip():
            for line in result.stderr.strip().split("\n"):
                print(f"    {line}")
        return False

    print(f"  ✓ 완료")
    return True


def main():
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    print(f"\n{'='*50}")
    print(f"  꿈해몽 사이트 자동 배포 시작")
    print(f"  {timestamp}")
    print(f"{'='*50}\n")

    # ── 1단계: 빌드 ──
    print("[1/4] 사이트 빌드 중...")
    if not run(f"{sys.executable} build.py", "build.py 실행"):
        print("\n빌드 실패. 배포를 중단합니다.")
        sys.exit(1)
    print()

    # ── 2단계: git add ──
    print("[2/4] 변경 사항 스테이징...")
    if not run("git add .", "모든 파일 스테이징"):
        print("\ngit add 실패. 배포를 중단합니다.")
        sys.exit(1)
    print()

    # ── 3단계: git commit ──
    print("[3/4] 커밋 생성 중...")
    commit_msg = f"Update dream content - {timestamp}"
    result = subprocess.run(
        "git status --porcelain",
        shell=True,
        capture_output=True,
        text=True,
    )

    if not result.stdout.strip():
        print("  ⏭ 변경 사항 없음. 커밋을 건너뜁니다.")
        print("\n배포할 새 콘텐츠가 없습니다.")
        sys.exit(0)

    if not run(f'git commit -m "{commit_msg}"', f'커밋: "{commit_msg}"'):
        print("\ngit commit 실패. 배포를 중단합니다.")
        sys.exit(1)
    print()

    # ── 4단계: git push ──
    print("[4/4] 원격 저장소에 푸시 중...")
    if not run("git push origin main", "origin/main 에 푸시"):
        print("\ngit push 실패. 배포를 중단합니다.")
        sys.exit(1)
    print()

    # ── 완료 ──
    print(f"{'='*50}")
    print(f"  배포 완료!")
    print(f"  https://github.com/yonghuilee7369/Product-builder")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    main()
