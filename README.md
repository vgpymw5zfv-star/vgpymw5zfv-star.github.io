# 🧮 도토리 계산기 (dotori-calc)

직장인·자취생 생활비·절세 계산기 8종 — **순수 정적 사이트(HTML + CSS + Vanilla JS)**.
빌드 서버 없이 GitHub Pages에 그대로 올려 쓰는 구조입니다.

- 홈: https://vgpymw5zfv-star.github.io/
- 계산 기준일: 2026년 11월
- 의존성: Pretendard 웹폰트(CDN, 실패 시 시스템 폰트 폴백) 외 0개

## 계산기

| 경로 | 내용 | 근거 |
| --- | --- | --- |
| `/salary/` | 2026 연봉 실수령액 (4대보험·간이세액·비과세·부양가족·중소기업 90% 감면) | 국민연금법 §88, 국민건강보험법 시행령 §44, 노인장기요양보험법 시행령 §4, 고용보험법 시행령 §12, 소득세법 시행령 [별표 2] |
| `/sme-tax/` | 중소기업 취업자 소득세 감면 90% · 5년 경정청구 | 조세특례제한법 §30, 국세기본법 §45의2 |
| `/housing/` | 전세 vs 월세 주거비 손익분기 (전환율·월세 세액공제) | 주택임대차보호법 §7조의2·시행령 §9, 조세특례제한법 §95의2 |
| `/electricity/` | 우리집 전기세 · 누진제 (총 사용량(kWh)·청구액·평수, 저압·고압) | 한국전력 전기요금표 (2026) |
| `/transit/` | K-패스 vs 기후동행카드 손익분기 | 국토교통부 K-패스, 서울시 기후동행카드 |
| `/rent-tax/` | 월세 세액공제 vs 현금영수증 소득공제 | 조세특례제한법 §95의2 |
| `/ai-cost/` | AI 구독 조합 가성비 | 각 서비스 공식 요금 |
| `/heating/` | 겨울 난방비 · 도시가스·지역난방 (사용열량 MJ·Mcal, 계량기 ㎥, 평수) | 2026년 11월 도시가스 주택용 요금표, 한국지역난방공사 열요금표(2024.7.1부) |

정책 페이지: `/about/` · `/privacy/` · `/contact/` · `404.html` · `robots.txt` · `sitemap.xml`

## 폴더 구조

```
.
├── .nojekyll                 # GitHub Pages Jekyll 처리 비활성화
├── index.html                # 홈(계산기 목록·카테고리 필터)
├── 404.html
├── robots.txt · sitemap.xml
├── assets/
│   ├── style.css             # 디자인 시스템 전체
│   ├── site-config.js        # ★ 중앙 설정(애드센스·배너·임베드)
│   ├── app.js                # 공통 UI, 임베드 모드, 애드센스/배너 주입
│   ├── favicon.svg · og-dotori.png
│   └── js/
│       ├── dotori-core.js    # 세금·포맷 공용 코어 (DOM 비의존)
│       ├── salary.js · sme-tax.js · housing.js · electricity.js · transit.js · rent-tax.js · ai-cost.js · heating.js
│       └── page-*.js         # 각 페이지 입력 → 결과 연결
├── salary/ · sme-tax/ · housing/ · electricity/ · transit/ · rent-tax/ · ai-cost/ · heating/
└── about/ · privacy/ · contact/
```

## 설정 하나로 광고 켜기

`assets/site-config.js`만 고치면 전 페이지에 반영됩니다.

```js
ADSENSE_CLIENT_ID: "",   // "ca-pub-1234567890123456" 를 넣으면 전 페이지 자동 삽입
ADSENSE_SLOTS: { top: "", bottom: "" },  // 수동 광고 단위를 쓸 때만 슬롯 ID 입력
```

- 클라이언트 ID만 넣으면 `google-adsense-account` 메타 + 애드센스 스크립트가 모든 페이지 `<head>`에 자동 주입되고, **Auto ads**가 동작합니다.
- 슬롯 ID까지 넣으면 본문 위/아래에 광고 단위(`<ins class="adsbygoogle">`)가 자동 생성됩니다.
- `BLOG_BANNER`로 블로그·제휴 배너를 끄고 켤 수 있습니다.

## 티스토리 임베드

각 페이지는 `?embed=1`로 접속하면 상단 메뉴·푸터·광고가 숨고 콘텐츠만 표시되며, 부모 페이지로 높이를 `postMessage`로 보냅니다.
붙여넣기용 스니펫과 자동 높이 조절 스크립트는 [`docs/dotori-calc-embed.md`](../../docs/dotori-calc-embed.md) 참고.

```html
<iframe src="https://vgpymw5zfv-star.github.io/sme-tax/?embed=1"
        style="width:100%;height:1250px;border:0;border-radius:12px"
        title="중소기업 취업자 소득세 감면 계산기" loading="lazy"></iframe>
```

> 임베드 모드에서는 애드센스를 의도적으로 숨깁니다(iframe 내 광고는 AdSense 정책상 무효 노출 위험).

## 배포

GitHub Pages(사용자 사이트) 저장소 루트에 이 폴더의 **내용물 전체**를 올리면 끝입니다.

```bash
git add -A && git commit -m "도토리 계산기 배포" && git push origin main
```

Settings → Pages → Source: `Deploy from a branch` / `main` / `/ (root)`.

## 검증

계산 로직은 Node 단위 테스트로 검증합니다(저장소 밖 `tools/dotori-build/tests/calc.test.js`).
입력값은 브라우저 밖으로 나가지 않으며, 모든 계산은 방문자 기기에서 실행됩니다.
