/* ==========================================================================
   실무 문자·메일 템플릿 생성기 — 순수 로직
   - 11가지 상황 × 2가지 말투(정중한 업무용 / 부드러운 카톡용)
   - 입력값은 브라우저 메모리에서만 처리합니다. (서버 전송 0)
   - 법령·기한은 2026년 11월 기준 (법령 원문 링크는 페이지 하단 안내 표)
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DotoriMsg = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var BLANK = "○○";

  var COMMON_FIELDS = [
    {
      key: "to",
      label: "받는 분 호칭",
      placeholder: "예: 사장님, 김 팀장님, 고객센터 담당자님",
      example: "사장님"
    },
    {
      key: "from",
      label: "내 이름",
      placeholder: "예: 홍길동",
      example: "홍길동"
    }
  ];

  var GROUPS = [
    { id: "rent", label: "집주인·부동산", desc: "수리 요청, 월세·관리비 확인, 갱신 거절 통지" },
    { id: "work", label: "직장·업무", desc: "연차·병가 신청, 일정 리마인드, 정중한 거절" },
    { id: "quit", label: "퇴사·이직", desc: "퇴사 의사, 인수인계, 증명서 발급 요청" },
    { id: "buy", label: "소비·환불", desc: "오배송·파손 교환, 청약철회 환불" }
  ];

  function f(key, label, example, placeholder) {
    return { key: key, label: label, example: example, placeholder: placeholder || example };
  }

  var TEMPLATES = [
    {
      id: "repair",
      group: "rent",
      title: "하자 수리 요청",
      summary: "누수·곰팡이·보일러 고장을 사진과 함께 요청",
      fields: [
        f("room", "호실·주소", "101동 502호"),
        f("issue", "하자 내용", "욕실 천장에서 물이 새고 곰팡이가 번지고 있습니다"),
        f("since", "발생 시점", "11월 17일부터"),
        f("visit", "방문 가능 시간", "평일 저녁 7시 이후, 주말 오전")
      ],
      subject: function (v) {
        return "[수리 요청] " + v("room") + " " + v("issue").slice(0, 24) + "…";
      },
      official: function (v) {
        return [
          "안녕하세요, " + v("to") + ". " + v("room") + "에 거주하는 " + v("from") + "입니다.",
          "",
          v("since") + "부터 " + v("issue") + ". 사진을 함께 보내드리니 상태를 확인해 주세요.",
          "",
          "계약 기간 중 시설을 사용할 수 있는 상태로 유지하는 일은 임대인 책임으로 알고 있습니다. 수리 기사님 방문이 필요할 것 같아 요청드립니다. 일정이 어려우시면 제가 업체를 알아봐도 괜찮은지도 함께 알려주세요.",
          "",
          "방문이 가능하시면 " + v("visit") + "에 시간을 맞추겠습니다. 가능한 날짜를 알려주시면 제가 집에 있겠습니다.",
          "",
          "감사합니다.",
          v("from") + " 드림"
        ].join("\n");
      },
      casual: function (v) {
        return [
          v("to") + ", 안녕하세요! " + v("room") + "에 사는 " + v("from") + "이에요.",
          v("since") + "부터 " + v("issue") + ". 사진 같이 보내드려요.",
          "수리 기사님 방문이 필요할 것 같은데, " + v("visit") + "에 가능할까요?",
          "가능한 날 알려주시면 그날 맞춰서 집에 있을게요. 감사합니다!"
        ].join("\n");
      }
    },
    {
      id: "rent-check",
      group: "rent",
      title: "월세·관리비 확인",
      summary: "이번 달 청구 금액과 항목 내역을 확인",
      fields: [
        f("room", "호실", "101동 502호"),
        f("month", "확인할 달", "2026년 11월"),
        f("items", "청구 금액", "월세 55만 원, 관리비 8만 3천 원"),
        f("question", "확인할 내용", "관리비가 지난달보다 2만 원 늘어난 항목")
      ],
      subject: function (v) {
        return "[문의] " + v("room") + " " + v("month") + "분 청구 내역";
      },
      official: function (v) {
        return [
          "안녕하세요, " + v("to") + ". " + v("room") + "에 거주하는 " + v("from") + "입니다.",
          "",
          v("month") + "분으로 안내받은 금액은 " + v("items") + "입니다. " + v("question") + "을 확인하고 싶어 연락드렸습니다.",
          "",
          "가능하시면 관리비 세부 내역서를 문자나 메일로 보내주시면 감사하겠습니다. 확인 후 정상 청구라면 그대로 납부하겠습니다.",
          "",
          "감사합니다.",
          v("from") + " 드림"
        ].join("\n");
      },
      casual: function (v) {
        return [
          v("to") + ", 안녕하세요! " + v("room") + " " + v("from") + "입니다.",
          v("month") + "분 금액이 " + v("items") + "로 안내되어서요.",
          v("question") + "을 확인하고 싶은데, 관리비 내역서 보내주실 수 있을까요?",
          "확인하고 바로 납부하겠습니다. 감사합니다!"
        ].join("\n");
      }
    },
    {
      id: "renewal-decline",
      group: "rent",
      title: "계약 갱신 거절·퇴거 통지",
      summary: "만기 전에 갱신하지 않고 나간다는 통지 (임차인 → 임대인)",
      fields: [
        f("room", "호실·주소", "101동 502호"),
        f("expiry", "계약 만기일", "2027년 2월 28일"),
        f("moveout", "퇴거 예정일", "2027년 2월 27일"),
        f("deposit", "보증금", "1억 2,000만 원"),
        f("account", "보증금 반환 계좌", "○○은행 123-456-789012 (예금주 홍길동)")
      ],
      subject: function (v) {
        return "[통지] " + v("room") + " 임대차계약 갱신 거절 및 퇴거 안내";
      },
      official: function (v) {
        return [
          "안녕하세요, " + v("to") + ". " + v("room") + "에 거주하는 " + v("from") + "입니다.",
          "",
          v("expiry") + "로 예정된 임대차계약을 갱신하지 않고 " + v("moveout") + "부로 퇴거하려 합니다. 주택임대차보호법상 통지 기간(만기 6개월~2개월 전)에 맞춰 미리 알려드립니다.",
          "",
          "퇴거일에 보증금 " + v("deposit") + "을 반환받을 수 있도록 아래 계좌로 입금해 주시면 감사하겠습니다.",
          v("account"),
          "",
          "퇴거 전 점검 일정과 열쇠 반환 방법도 알려주시면 맞춰 준비하겠습니다. 이사 일정이 확정되면 다시 연락드리겠습니다.",
          "",
          "그동안 잘 챙겨주셔서 감사했습니다.",
          v("from") + " 드림"
        ].join("\n");
      },
      casual: function (v) {
        return [
          v("to") + ", 안녕하세요! " + v("room") + " " + v("from") + "입니다.",
          v("expiry") + " 만기인 계약을 연장하지 않고 " + v("moveout") + "에 이사하려고 해서 미리 말씀드려요.",
          "보증금 " + v("deposit") + "은 퇴거일에 돌려받을 수 있을까요?",
          "계좌는 " + v("account") + "입니다. 점검 일정과 열쇠 반환은 어떻게 하면 될까요?",
          "그동안 감사했습니다!"
        ].join("\n");
      }
    },
    {
      id: "leave",
      group: "work",
      title: "연차·반차·병가 신청",
      summary: "사용 일시와 인수인계를 한 번에 정리",
      fields: [
        f("type", "휴가 종류", "연차 1일"),
        f("when", "사용 일시", "2026년 11월 27일(금) 종일"),
        f("reason", "사유", "개인 사정"),
        f("handover", "인수인계", "오전 업무는 김 대리에게 인계했습니다")
      ],
      subject: function (v) {
        return "[" + v("type") + "] " + v("when") + " 사용 신청";
      },
      official: function (v) {
        return [
          v("to") + ", 안녕하세요. " + v("from") + "입니다.",
          "",
          v("when") + "에 " + v("type") + "을 사용하고자 미리 말씀드립니다. 사유는 " + v("reason") + "입니다.",
          "",
          "해당 시간 업무는 " + v("handover") + ". 급한 건은 휴대폰으로 연락 주시면 바로 확인하겠습니다.",
          "",
          "승인 부탁드립니다. 감사합니다.",
          v("from") + " 드림"
        ].join("\n");
      },
      casual: function (v) {
        return [
          v("to") + ", " + v("when") + "에 " + v("type") + " 쓸 수 있을까요?",
          "사유는 " + v("reason") + "이고, 업무는 " + v("handover") + ".",
          "급한 건은 연락 주시면 바로 볼게요!"
        ].join("\n");
      }
    },
    {
      id: "remind",
      group: "work",
      title: "일정 리마인드",
      summary: "회의·마감 일정과 준비물을 정중하게 다시 안내",
      fields: [
        f("what", "일정 이름", "주간 정산 회의"),
        f("when", "일시", "11월 24일(월) 오전 10시"),
        f("where", "장소·링크", "본관 3층 회의실"),
        f("todo", "준비물·요청 사항", "지난주 실적 표와 이번 주 계획 1장")
      ],
      subject: function (v) {
        return "[안내] " + v("what") + " " + v("when");
      },
      official: function (v) {
        return [
          v("to") + ", 안녕하세요. " + v("from") + "입니다.",
          "",
          v("when") + "에 " + v("what") + " 일정이 있어 다시 안내드립니다. 장소는 " + v("where") + "입니다.",
          "",
          "준비물은 " + v("todo") + "입니다. 참석이 어려우시면 미리 알려주시면 일정을 조정하거나 회의록으로 공유드리겠습니다.",
          "",
          "감사합니다.",
          v("from") + " 드림"
        ].join("\n");
      },
      casual: function (v) {
        return [
          v("to") + ", " + v("when") + " " + v("what") + " 일정 다시 알려드려요!",
          "장소는 " + v("where") + "이고, 준비물은 " + v("todo") + "입니다.",
          "참석이 어려우시면 미리 말씀 주세요. 회의록으로 공유드릴게요!"
        ].join("\n");
      }
    },
    {
      id: "decline",
      group: "work",
      title: "정중한 거절",
      summary: "관계를 지키면서 이번 요청은 어렵다고 전하기",
      fields: [
        f("request", "요청 사항", "이번 주말 추가 업무"),
        f("reason", "어려운 이유", "가족 일정이 이미 잡혀 있습니다"),
        f("alternative", "대안", "월요일 오전까지 처리하는 것")
      ],
      subject: function (v) {
        return "[회신] " + v("request") + " 건 관련";
      },
      official: function (v) {
        return [
          v("to") + ", 안녕하세요. " + v("from") + "입니다.",
          "",
          "말씀하신 " + v("request") + " 건은 이번에는 어렵게 되었습니다. " + v("reason") + ".",
          "",
          "대신 " + v("alternative") + "은 가능합니다. 이 방향이 괜찮으시면 바로 준비하겠습니다.",
          "",
          "불편을 끼쳐 죄송합니다. 다음에는 미리 여유를 두고 챙기겠습니다.",
          v("from") + " 드림"
        ].join("\n");
      },
      casual: function (v) {
        return [
          v("to") + ", " + v("from") + "입니다.",
          v("request") + " 건은 이번에 어려울 것 같아요. " + v("reason") + ".",
          "대신 " + v("alternative") + "은 가능한데, 이렇게 진행해도 괜찮을까요?",
          "죄송합니다. 다음엔 미리 챙길게요!"
        ].join("\n");
      }
    },
    {
      id: "resign",
      group: "quit",
      title: "퇴사 의사 전달",
      summary: "마지막 근무일과 인수인계 계획까지 한 번에",
      fields: [
        f("lastDay", "마지막 근무일", "2026년 12월 31일"),
        f("reason", "사유", "개인 사정"),
        f("plan", "남은 기간 계획", "담당 업무 정리표를 다음 주까지 만들고 인수인계 일정을 잡아 두겠습니다")
      ],
      subject: function (v) {
        return "[보고] 퇴사 의사 및 인수인계 일정 안내";
      },
      official: function (v) {
        return [
          v("to") + ", 안녕하세요. " + v("from") + "입니다.",
          "",
          "고민 끝에 " + v("lastDay") + "을 마지막 근무일로 두고 퇴사하고자 미리 말씀드립니다. 사유는 " + v("reason") + "입니다.",
          "",
          "남은 기간 동안 " + v("plan") + ". 인수인계 담당자와 일정을 맞춰 차질 없이 마무리하겠습니다.",
          "",
          "갑작스러운 결정으로 폐를 끼쳐 죄송합니다. 그동안 챙겨주셔서 감사했습니다.",
          v("from") + " 드림"
        ].join("\n");
      },
      casual: function (v) {
        return [
          v("to") + ", " + v("from") + "입니다. 말씀드릴 게 있어 연락드렸어요.",
          "고민 끝에 " + v("lastDay") + "까지 근무하고 퇴사하기로 했습니다. 사유는 " + v("reason") + "입니다.",
          v("plan") + ". 인수인계 일정은 편하신 시간에 맞출게요.",
          "갑작스러워 죄송하고, 그동안 감사했습니다."
        ].join("\n");
      }
    },
    {
      id: "handover",
      group: "quit",
      title: "인수인계 일정 안내",
      summary: "넘길 업무와 설명 일정을 정리해 공유",
      fields: [
        f("lastDay", "마지막 근무일", "2026년 12월 31일"),
        f("items", "인수인계 항목", "주간 리포트 작성, 거래처 A·B 연락, 진행 중인 견적 3건"),
        f("person", "인수자", "김 대리"),
        f("schedule", "설명 일정", "12월 26일~30일 오후 2시")
      ],
      subject: function (v) {
        return "[안내] " + v("lastDay") + " 퇴사 전 인수인계 일정";
      },
      official: function (v) {
        return [
          v("to") + ", 안녕하세요. " + v("from") + "입니다.",
          "",
          v("lastDay") + " 퇴사를 앞두고 인수인계 일정을 안내드립니다. 넘길 업무는 " + v("items") + "입니다.",
          "",
          v("schedule") + "에 시간을 내어 " + v("person") + "님께 직접 설명드릴 예정입니다. 정리 문서는 공유 드라이브에 올려 두겠습니다.",
          "",
          "빠진 항목이 있으면 알려주세요. 추가로 정리하겠습니다.",
          "",
          "감사합니다.",
          v("from") + " 드림"
        ].join("\n");
      },
      casual: function (v) {
        return [
          v("to") + ", " + v("from") + "입니다.",
          v("lastDay") + "까지 근무라서 인수인계 일정 먼저 공유드려요.",
          "넘길 업무는 " + v("items") + "이고, " + v("schedule") + "에 " + v("person") + "님께 설명드릴게요.",
          "정리 문서는 공유 드라이브에 올려둘게요. 빠진 것 있으면 알려주세요!"
        ].join("\n");
      }
    },
    {
      id: "cert-doc",
      group: "quit",
      title: "경력증명서·원천징수영수증 요청",
      summary: "필요한 서류와 기재 항목, 기한을 분명히",
      fields: [
        f("docs", "요청 서류", "경력증명서(근무 기간·담당 업무·최종 직위)와 2026년 귀속 근로소득 원천징수영수증"),
        f("purpose", "사용 목적", "이직 서류 제출"),
        f("deadline", "필요한 기한", "12월 5일까지"),
        f("method", "수령 방법", "PDF 파일 회신")
      ],
      subject: function (v) {
        return "[요청] " + v("docs").slice(0, 20) + " 발급";
      },
      official: function (v) {
        return [
          v("to") + ", 안녕하세요. " + v("from") + "입니다.",
          "",
          "아래 서류 발급을 요청드립니다. 사용 목적은 " + v("purpose") + "이고, " + v("deadline") + "까지 받을 수 있으면 합니다.",
          "",
          "- 요청 서류: " + v("docs"),
          "- 수령 방법: " + v("method"),
          "",
          "증명서에는 제가 요청한 항목만 기재해 주시면 됩니다. 발급에 필요한 추가 정보가 있으면 알려주세요.",
          "",
          "감사합니다.",
          v("from") + " 드림"
        ].join("\n");
      },
      casual: function (v) {
        return [
          v("to") + ", 안녕하세요! " + v("from") + "입니다.",
          v("docs") + " 발급을 요청드리고 싶어요. " + v("purpose") + " 때문에 " + v("deadline") + "까지 필요합니다.",
          v("method") + "로 받을 수 있을까요? 필요한 정보 있으면 알려주세요!",
          "감사합니다."
        ].join("\n");
      }
    },
    {
      id: "exchange",
      group: "buy",
      title: "오배송·파손 교환 요청",
      summary: "주문번호·사진과 함께 교환 요청",
      fields: [
        f("seller", "판매처", "○○스토어 고객센터"),
        f("orderNo", "주문번호", "20261118-1234567"),
        f("item", "상품명", "무선 이어폰 (블랙)"),
        f("received", "수령일", "11월 19일"),
        f("problem", "문제 내용", "왼쪽 유닛이 충전되지 않고, 포장 박스가 찌그러진 상태로 도착했습니다"),
        f("want", "원하는 처리", "동일 상품으로 교환")
      ],
      subject: function (v) {
        return "[교환 요청] 주문번호 " + v("orderNo");
      },
      official: function (v) {
        return [
          v("seller") + " 담당자님, 안녕하세요. " + v("from") + "입니다.",
          "",
          v("received") + "에 수령한 주문번호 " + v("orderNo") + " 상품(" + v("item") + ")에 문제가 있어 연락드립니다.",
          "",
          v("problem") + ". 사진을 함께 첨부드립니다.",
          "",
          v("want") + "을 요청드립니다. 표시·광고와 다르게 도착한 경우의 반품 배송비는 판매자 부담으로 알고 있습니다.",
          "",
          "교환 절차와 수거 일정을 안내해 주시면 바로 진행하겠습니다.",
          "",
          "감사합니다.",
          v("from") + " 드림"
        ].join("\n");
      },
      casual: function (v) {
        return [
          v("seller") + " 안녕하세요, " + v("from") + "입니다.",
          v("received") + "에 받은 주문 " + v("orderNo") + "(" + v("item") + ")에 문제가 있어요.",
          v("problem") + ". 사진 첨부했습니다.",
          v("want") + "으로 처리해 주실 수 있을까요? 수거 일정 알려주시면 맞출게요!",
          "감사합니다."
        ].join("\n");
      }
    },
    {
      id: "refund",
      group: "buy",
      title: "청약철회 환불 요청",
      summary: "수령 후 7일 이내 환불 요청 문구",
      fields: [
        f("seller", "판매처", "○○스토어 고객센터"),
        f("orderNo", "주문번호", "20261119-7654321"),
        f("item", "상품명", "겨울 니트 (M, 차콜)"),
        f("received", "수령일", "11월 19일"),
        f("reason", "환불 사유", "단순 변심 — 사이즈가 맞지 않습니다"),
        f("want", "환불 방법", "결제한 카드로 환불")
      ],
      subject: function (v) {
        return "[청약철회] 주문번호 " + v("orderNo") + " 환불 요청";
      },
      official: function (v) {
        return [
          v("seller") + " 담당자님, 안녕하세요. " + v("from") + "입니다.",
          "",
          v("received") + "에 수령한 주문번호 " + v("orderNo") + " 상품(" + v("item") + ")을 청약철회로 반품하고 환불을 요청드립니다. 사유는 " + v("reason") + "입니다.",
          "",
          "수령일부터 7일 이내 청약철회가 가능하고, 반품 상품을 받으신 날부터 3영업일 이내에 환급해 주셔야 하는 것으로 알고 있습니다. " + v("want") + "으로 부탁드립니다.",
          "",
          "반품 접수 방법과 반송 주소를 안내해 주세요. 상품은 개봉하지 않은 상태 그대로 보관하고 있습니다.",
          "",
          "감사합니다.",
          v("from") + " 드림"
        ].join("\n");
      },
      casual: function (v) {
        return [
          v("seller") + " 안녕하세요, " + v("from") + "입니다.",
          v("received") + "에 받은 " + v("orderNo") + "(" + v("item") + ")을 환불하고 싶어요. " + v("reason") + ".",
          "수령 후 7일 이내라 청약철회 가능한 걸로 알고 있습니다. " + v("want") + "으로 부탁드려요.",
          "반품 접수 방법이랑 주소 알려주시면 바로 보낼게요!",
          "감사합니다."
        ].join("\n");
      }
    }
  ];

  function templateById(id) {
    for (var i = 0; i < TEMPLATES.length; i += 1) {
      if (TEMPLATES[i].id === id) return TEMPLATES[i];
    }
    return null;
  }

  function groupById(id) {
    for (var i = 0; i < GROUPS.length; i += 1) {
      if (GROUPS[i].id === id) return GROUPS[i];
    }
    return null;
  }

  function templatesOf(groupId) {
    return TEMPLATES.filter(function (t) {
      return t.group === groupId;
    });
  }

  /** 값 채우기 — 비어 있으면 ○○ 로 남겨 무엇을 채워야 하는지 보이게 한다 */
  function makeFill(values) {
    var src = values || {};
    return function (key) {
      var raw = src[key];
      var text = raw == null ? "" : String(raw).trim();
      return text === "" ? BLANK : text;
    };
  }

  /** 문자 기준(EUC-KR 추정) 바이트 */
  function eucKrBytes(text) {
    var s = String(text == null ? "" : text);
    var points = Array.from(s);
    var total = 0;
    for (var i = 0; i < points.length; i += 1) {
      var cp = points[i].codePointAt ? points[i].codePointAt(0) : points[i].charCodeAt(0);
      total += cp <= 0x7f ? 1 : 2;
    }
    return total;
  }

  function chars(text) {
    return Array.from(String(text == null ? "" : text)).length;
  }

  function smsTier(bytes) {
    if (bytes <= 90) return { id: "sms", label: "SMS 한 건" };
    if (bytes <= 2000) return { id: "lms", label: "LMS 한 건" };
    return { id: "over", label: "LMS 초과 · 나눠 보내기" };
  }

  /**
   * 메시지 생성
   * @param {string} id 템플릿 id
   * @param {object} values 입력값
   * @param {"official"|"casual"} tone
   */
  function render(id, values, tone) {
    var tpl = templateById(id) || TEMPLATES[0];
    var v = makeFill(values);
    var kind = tone === "casual" ? "casual" : "official";
    var body = tpl[kind](v);
    var subject = typeof tpl.subject === "function" ? tpl.subject(v) : "";
    var bytes = eucKrBytes(body);

    return {
      ok: true,
      template: tpl,
      tone: kind,
      toneLabel: kind === "casual" ? "부드러운 카톡용" : "정중한 업무용",
      subject: subject,
      body: body,
      chars: chars(body),
      bytes: bytes,
      sms: smsTier(bytes),
      withSubject: subject ? "제목: " + subject + "\n\n" + body : body
    };
  }

  return {
    BLANK: BLANK,
    COMMON_FIELDS: COMMON_FIELDS,
    GROUPS: GROUPS,
    TEMPLATES: TEMPLATES,
    templateById: templateById,
    groupById: groupById,
    templatesOf: templatesOf,
    render: render,
    chars: chars,
    eucKrBytes: eucKrBytes,
    smsTier: smsTier
  };
});
