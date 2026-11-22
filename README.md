# 🧮 도토리 툴즈 (dotori-calc)

직장인·자취생 생활비·절세·주거 계산기 17종 + 실전 체크도구 2종 + 문서·일정 도구 5종(24종) — **순수 정적 사이트(HTML + CSS + Vanilla JS)**.
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
| `/lease-check/` | 전세·월세 안전 계약 체크리스트 · 특약 복사기 (전세가율·선순위 위험도, 안전 특약 8종) | HUG 전세보증금반환보증 요건, 국토부 안심전세앱 위험도(80/90), 주택임대차보호법 §3조의6·§10·§30, 법무부 표준계약서 |
| `/year-end-check/` | 연말정산 공제·서류 체크리스트 (12월 액션 · 간소화 누락 서류, 유형 필터) | 조특법 §30·§58·§95조의2·§126조의2, 소득세법 §52·§59조의3·§59조의4, 국세청 간소화 안내 |
| `/heating/` | 겨울 난방비 · 도시가스·지역난방 (사용열량 MJ·Mcal, 계량기 ㎥, 평수) | 2026년 11월 도시가스 주택용 요금표, 한국지역난방공사 열요금표(2024.7.1부) |
| `/severance/` | 퇴직금 · 퇴직소득세 실수령 & 미사용 연차수당 (IRP 연금 감면 비교) | 근로자퇴직급여 보장법 §8, 근로기준법 §2·§60, 소득세법 §48·§55·시행규칙 별지 제40호의2 |
| `/car-cost/` | 내 차 유지비 vs 대중교통(K-패스) — 자동차세·유가·보험·정비·주차 | 지방세법 §127·§128·§151, 오피넷 2026-11-18 전국 평균, 국토교통부 K-패스 |
| `/unemployment/` | 2026 실업급여(구직급여) — 상한 68,100원·하한 66,048원, 소정급여일수 | 고용보험법 §45~§50·시행령 §68·[별표 1], 2026년 최저임금 10,320원 |
| `/loan/` | 대출 이자 · 원리금균등·원금균등·체증식·만기일시 비교 | 한국주택금융공사·시중은행 상환방식 안내 |
| `/text-counter/` | 글자수·바이트 & 줄바꿈 정리기 (공백 포함·제외, UTF-8/EUC-KR, SMS 90B·LMS 2,000B, 200자 원고지, 읽기 시간, 원클릭 정리) | 유니코드 코드 포인트, UTF-8 인코딩 규칙, TTA 정보통신용어사전(SMS·LMS), 관행적 200자 원고지 |
| `/dday/` | D-day · 근무일(공휴일 제외) · 기념일 (총 일수·주·개월, 2026·2027년 공휴일·대체공휴일 제외 근무일, 100일·1주년) | 「관공서의 공휴일에 관한 규정」(2026. 4. 30. 개정), 우주항공청 2026·2027년 월력요항, 한국천문연구원 달력자료, 공직선거법 §34 |
| `/unit-price/` | 단위가격 · 1+1 실구매가 비교기 (상품 4개, 100g·100ml·1개당 단가, 구성 수량, 쿠폰·카드 할인, 최저 단가 배지·2등 대비 절약률) | 계량에 관한 법률(법정 계량단위), 한국소비자원 단위가격 안내, 공정위 할인·증정 표시 기준 |
| `/msg-template/` | 실무 문자·메일 템플릿 생성기 (11가지 상황, 정중한 업무용·부드러운 카톡용, 원클릭 복사, 문자 규격 표시) | 주택임대차보호법 §6·§6의2·§6의3·§7, 민법 §623·§660, 전자상거래법 §17·§18, 근로기준법 §39·시행령 §19, 소득세법 §143 |
| `/annual-leave/` | 연차 일수 · 미사용 연차수당 (2026년 근로기준법 기준 발생 일수·사용기한, 1일 통상임금, 미사용 수당) | 근로기준법 §60·§61·§49, 근로기준법 시행령 §6, 고용노동부고시 제2025-47호(2026년 최저임금) |
| `/pyeong/` | 평수 · 전용면적 ㎡ 변환 (㎡↔평, 전용률로 공급면적·평형 추정, 평당 가격, 방 크기 감각) | 계량에 관한 법률(1평=3.3058㎡), 주택법 시행령 부속서류(전용면적) |
| `/freelance-tax/` | 프리랜서 3.3% 원천징수 · 실수령액 (10원 절사, 세후→세전 역산, 기타소득 8.8%, 5월 종합소득세 추정) | 소득세법 §129·§86·§70, 지방세법 §103의13, 국고금 관리법 §47, 국세청 경비율 고시 |
| `/dutch-pay/` | 모임 회비 · 더치페이 정산 (차수별 결제자·참석자, 끝전 처리, 서로 상계한 최소 송금, 카톡 문구) | 당사자 합의에 따른 정산(민법 §105), 계좌이체·간편송금 관행 |
| `/cheongyak/` | 청약 가점 · 무주택기간·부양가족·청약통장 84점 (기산일 자동 계산, 배점표, 다음 구간까지 남은 기간, 약한 항목 정리) | 「주택공급에 관한 규칙」 §28·별표 1, §10제6항(미성년 가입 5년 인정), 한국부동산원 청약홈 가점계산 |
| `/career/` | 경력기간 계산기 (경력별 기간, 재직 중 기준일까지, 수습 제외 인정 경력, 겹친 기간 중복 제거, 이력서용 요약 복사) | 인사 실무 관행(1개월=30일), 채용공고 경력요건 표기 기준 |

정책 페이지: `/about/` · `/privacy/` · `/contact/` · `404.html` · `robots.txt` · `sitemap.xml`

## 폴더 구조

```
.
├── .nojekyll                 # GitHub Pages Jekyll 처리 비활성화
├── index.html                # 홈(계산기 목록·카테고리 필터)
├── 404.html
├── robots.txt · sitemap.xml
├── assets/
│   ├── style.css             # 디자인 시스템 전체 + 모션 레이어(리빌·호버·토스트)
│   ├── site-config.js        # ★ 중앙 설정(애드센스·배너·임베드)
│   ├── app.js                # 공통 UI, 임베드 모드, 스크롤 리빌, 토스트, 카운트업
│   ├── favicon.svg · og-dotori.png
│   └── js/
│       ├── dotori-core.js    # 세금·포맷 공용 코어 (DOM 비의존)
│       ├── salary.js · sme-tax.js · housing.js · electricity.js · transit.js · rent-tax.js · ai-cost.js · heating.js
│       ├── severance.js · car-cost.js · unemployment.js · loan.js
│       ├── text-counter.js · dday.js  (문서·일정 도구, DOM 비의존)
│       ├── unit-price.js · msg-template.js  (단위가격·문자 템플릿, DOM 비의존)
│       ├── annual-leave.js · pyeong.js · freelance-tax.js · dutch-pay.js
│       ├── cheongyak.js · career.js  (청약 가점·경력기간, DOM 비의존)
│       └── page-*.js         # 각 페이지 입력 → 결과 연결
├── salary/ · sme-tax/ · housing/ · electricity/ · transit/ · rent-tax/ · ai-cost/ · heating/
├── text-counter/ · dday/ · unit-price/ · msg-template/ · annual-leave/ · pyeong/ · freelance-tax/ · dutch-pay/
├── cheongyak/ · career/
└── about/ · privacy/ · contact/
```

## 모션 · 접근성

- 히어로·페이지 제목은 진입 시 순차 페이드업, 그 아래 섹션은 `IntersectionObserver`로 스크롤 시 45ms 스태거 리빌(`.section-head`·`.calc-card`·`.faq details`·`.prose` 등).
- 리빌 사전 상태는 `html.reveal-ready` 하위에만 적용되므로 **JS 미실행·미지원 브라우저·임베드(`?embed=1`)·`prefers-reduced-motion: reduce`에서는 어떤 요소도 숨은 채 남지 않는다**.
- 헤더는 스크롤 8px 이상에서 `.is-scrolled`(블러·그림자), 드롭다운은 열기/닫기 스프링 모션, 홈 필터는 페이드-스케일 전환, 결과 복사·공유는 하단 플로팅 토스트(`.dotori-toast`)로 피드백.
- 숫자형 계산기 20종의 주 결과값은 `DotoriUI.countTo`로 카운트업하며, 종료값은 항상 실제 표기와 정확히 일치한다(포맷터·`finalText` 인자).

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
git add -A && git commit -m "도토리 툴즈 배포" && git push origin main
```

Settings → Pages → Source: `Deploy from a branch` / `main` / `/ (root)`.

## 검증

- 계산 로직: `tools/node/bin/node tools/dotori-build/tests/*.js` (전부 통과해야 배포)
- 링크: `python3 tools/dotori-build/check_links.py`
- 모션·반응형(로컬/라이브): `tools/dotori-build/qa_motion_1123.py`, `qa_motion_live.py`

계산 로직은 Node 단위 테스트로 검증합니다(저장소 밖 `tools/dotori-build/tests/calc.test.js`).
입력값은 브라우저 밖으로 나가지 않으며, 모든 계산은 방문자 기기에서 실행됩니다.
