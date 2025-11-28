# n8n Template Gallery (self-hosted)

공개 접근이 제한된 오너 템플릿을 한눈에 보고, JSON 복사 또는 내 n8n 인스턴스로 바로 가져오기까지 지원하는 프론트엔드입니다. 최신 트렌드의 반응형 UI로 구성되어 테스트/데모 용도로 바로 띄울 수 있습니다.

## 주요 기능
- 템플릿 검색과 태그 필터링
- 상세 모달에서 난이도/필요 자격증명/예상 셋업 시간 확인
- JSON 미리보기 및 클립보드 복사
- 호스트 URL + Personal Access Token(PAT) 입력 후 **POST /rest/workflows** 호출로 워크플로우 생성
- 예시 템플릿 3종 내장 (공지, 리드 처리, 데일리 리포트)

## 로컬 실행
```bash
npm install
npm run dev  # http://localhost:5173
```

## 프로덕션 빌드
```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

## Docker 이미지 빌드/실행
```bash
docker build -t n8n-template-gallery .
docker run -p 8080:80 n8n-template-gallery
```

## n8n API 연결 방법
1. 갤러리 페이지 우측 패널에 **n8n 호스트 URL** 과 **PAT** 을 입력합니다.
2. 카드 또는 모달의 "내 워크플로우로 가져오기" 버튼을 누르면 브라우저에서 직접 `POST /rest/workflows` 를 호출합니다.
3. CORS 설정이 필요할 수 있으며, 토큰은 클라이언트에 저장하지 않습니다.

## 구조
- `src/data/templates.ts` : 갤러리 노출용 템플릿 메타/JSON
- `src/utils/n8nClient.ts` : n8n REST API 호출 래퍼
- `src/components/` : 카드/모달 UI 컴포넌트
- `src/styles/global.css` : 글래스모피즘 기반의 글로벌 스타일
