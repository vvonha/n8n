# n8n Template Gallery (self-hosted)

공개 접근이 제한된 오너 템플릿을 한눈에 보고, JSON 복사 또는 내 n8n 인스턴스로 바로 가져오기까지 지원하는 프론트엔드입니다. 최신 트렌드의 반응형 UI로 구성되어 테스트/데모 용도로 바로 띄울 수 있습니다.

## 주요 기능
- 템플릿 검색과 태그 필터링
- 상세 모달에서 난이도/필요 자격증명/예상 셋업 시간 확인
- JSON 미리보기 및 클립보드 복사
- 브라우저는 갤러리 서버의 **/api/import-workflow**만 호출하고, 서버가 내부에서 n8n REST API(`POST /api/v1/workflows` 혹은
  `/rest/workflows`)를 대리 호출해 워크플로우를 생성 (사용자별 API Key를 전달 가능)
- 예시 템플릿 3종 내장 (공지, 리드 처리, 데일리 리포트)
- 각 사용자가 UI에서 **n8n API 주소**(예: `https://n8n.ldccai.com/api/v1`)와 **Personal API Key**를 입력하면 해당 계정으로 워크플로우가
  생성되며, 값은 브라우저 로컬에만 저장됩니다.

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
docker run -p 8080:3000 \
  -e N8N_API_BASE=https://n8n.ldccai.com \
  # 필요 시 직접 엔드포인트를 지정하려면 N8N_WORKFLOWS_ENDPOINT=https://n8n.ldccai.com/api/v1/workflows \
  n8n-template-gallery
```

## Helm 차트 배포(EKS 등)
- 차트 위치: `charts/n8n-template-gallery`
- 서버가 정적 파일과 `/api/import-workflow`를 함께 제공하므로 별도 PVC 없이 배포합니다.

```bash
helm upgrade --install template-gallery charts/n8n-template-gallery \
  --set image.repository=<레지스트리>/n8n-template-gallery \
  --set image.tag=<태그> \
  --set service.type=LoadBalancer \
  --set ingress.enabled=true \
  --set ingress.className=alb \
  --set ingress.hosts[0].host=gallery.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set env[0].name=N8N_API_BASE --set env[0].value=https://n8n.ldccai.com
```

- 기본 설정은 HPA(cpu/memory 75%)가 활성화된 상태이며, `values.yaml`을 통해 `replicaCount`, 추가 환경변수(`env`), `serviceMonitor` 등을 조정할 수 있습니다.
- 퍼블릭 도메인 노출 시 Ingress + TLS 설정을 추천합니다. 브라우저는 갤러리 서버에만 요청하므로 n8n REST API의 CORS 설정은 필요하지 않습니다.

## n8n API 연결 방법 (서버 중계)
1. **환경변수는 "템플릿 갤러리 컨테이너"에 넣습니다.** n8n 서버 자체에 넣는 값이 아닙니다. Docker `-e` 플래그나 Helm `values.yaml`의 `env` 목록에 넣으시면 됩니다.
2. UI에서 사용자가 **n8n API 주소**와 **Personal API Key**를 입력합니다. 주소는 브라우저 → 서버 요청 바디(`apiBase`)로 전달되며 서버가 그대로 n8n으로 대리 호출합니다. (값은 로컬스토리지에만 남습니다.)
3. 서버 차원에서 기본값을 주고 싶다면 **N8N_API_BASE** 또는 **N8N_WORKFLOWS_ENDPOINT** 환경변수를 설정해 두세요. 요청 바디에 `apiBase`가 있으면 이를 우선 사용합니다.
4. 각 사용자가 자신의 키를 입력하므로 생성된 워크플로우는 해당 사용자 소유로 등록됩니다. 서버에서 공용 키를 유지하지 않아도 됩니다.
5. 서버 간 호출이므로 CORS/세션 쿠키 문제 없이 `POST /api/v1/workflows`(또는 `/rest/workflows`)가 실행됩니다.

### Helm에서 환경변수 넣는 예시
`charts/n8n-template-gallery/values.yaml` 의 `env` 배열에 추가하면 됩니다.

```yaml
env:
  - name: N8N_API_BASE
    value: https://n8n.ldccai.com
  # 필요 시 완성된 엔드포인트를 직접 지정
  # - name: N8N_WORKFLOWS_ENDPOINT
  #   value: https://n8n.ldccai.com/api/v1/workflows
```

Docker 실행 시에는 컨테이너에 `-e N8N_API_BASE=...` 식으로 전달하면 동일하게 동작합니다.

## CORS 관련 참고
- n8n은 REST API에 CORS 헤더를 기본 제공하지 않으므로, 브라우저에서 직접 n8n REST API를 호출하면 해결할 수 없는 CORS 오류가 발생합니다.
- 이 갤러리는 브라우저 요청을 **서버가 대리 호출**하는 구조로 변경했으므로, n8n 측 CORS 환경변수를 수정해도 의미가 없습니다.

## 이 서비스에 DB가 필요한가요?
- 기본적으로 **DB가 필요 없습니다.** 템플릿 메타데이터와 JSON은 정적 파일(`src/data/templates.ts`)로 번들되어 있고, 서버는 이를 받아 n8n으로 전달만 합니다.
- 템플릿 CRUD나 사용자별 즐겨찾기/다운로드 집계 등이 필요하면 별도 DB/백엔드를 추가하세요.

## 쿠버네티스 배포 & 스토리지(PV) 고려사항
- **권장 구성:** `NodePort`/`LoadBalancer` 서비스로 80/443을 노출하거나, Ingress + TLS를 사용합니다. 애플리케이션은 정적 파일을 서빙하는 단일 컨테이너이므로 HPA로 손쉽게 수평 확장할 수 있습니다.
- **PersistentVolume 필요 여부:** 정적 애플리케이션이므로 기본적으로 PV가 필요 없습니다. 빌드 결과를 컨테이너 이미지에 포함하거나 ConfigMap/OCI Registry에서 직접 가져오면 됩니다.
- **ConfigMap 방식 예시:**
  1. `npm run build`로 생성된 `dist/`를 ConfigMap에 넣거나 Nginx-alpine 기반 이미지를 빌드합니다.
  2. Deployment에서 `/usr/share/nginx/html`을 ConfigMap/빈Dir로 마운트하면 코드 변경 시 롤링 업데이트만으로 반영 가능합니다.
- **환경변수 주입:** 최소한 `N8N_API_BASE`만 지정하면 됩니다. `/api/v1` 대신 `/rest` 경로를 쓰거나 완성된 URL을 쓰고 싶다면 `N8N_WORKFLOWS_ENDPOINT`를 사용하세요. 공용 키를 쓰고 싶다면 `N8N_API_KEY` 등을 넣을 수 있지만, 다중 사용자라면 UI에서 사용자 개인 키를 입력받아 전달하는 구성을 권장합니다.
- **네트워크:** EKS에서 퍼블릭 도메인으로 제공 시 Ingress(ALB/NGINX) + `https`를 적용합니다. 브라우저는 갤러리 서버에만 요청하므로 n8n API에 별도 CORS 설정이 필요 없습니다.

## 구조
- `src/data/templates.ts` : 갤러리 노출용 템플릿 메타/JSON
- `src/utils/n8nClient.ts` : 서버 중계 엔드포인트(`/api/import-workflow`) 호출 래퍼
- `src/components/` : 카드/모달 UI 컴포넌트
- `src/styles/global.css` : 글래스모피즘 기반의 글로벌 스타일
