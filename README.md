# BaseXX Converter (GitHub Pages)

Base64 전용이던 도구를 **Binary ↔ BaseXX 양방향 변환기**로 확장한 정적 웹앱입니다.

## 지원 포맷

- Base16 (Hex)
- Base32 (RFC4648)
- Base58 (Bitcoin alphabet)
- Base62
- Base64 (RFC4648)
- Base64 URL-safe
- Base85 (Ascii85 alphabet)

Raw 입력/출력:

- Text (UTF-8)
- Hex bytes
- Binary bits (`010101...`)

## 로컬 실행

```bash
npm ci
npm run build
```

빌드 결과는 `docs/`에 생성됩니다.

## GitHub Pages 배포

1. 저장소 Settings → Pages → Source를 **GitHub Actions** 로 설정
2. `main` 브랜치에 push 하면 `.github/workflows/deploy-pages.yml`로 자동 배포

## SEO 반영 사항

- 메타 타이틀/설명/키워드
- Open Graph / Twitter Card
- Canonical URL
- JSON-LD (`WebApplication`)

> 배포 전 `src/index.html`의 canonical/og:url의 `<YOUR_GITHUB_USERNAME>`, `<YOUR_REPO_NAME>` 값을 실제 저장소 주소로 바꿔주세요.
